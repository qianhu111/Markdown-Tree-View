const fs = require("fs");
const path = require("path");
const { spawn, exec, execFile } = require("child_process");
const express = require("express");

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, "config.json");
const PID_FILE = path.join(ROOT, ".runner-pids.json");

const GUI_MODE = process.argv.includes("--gui");
const HEADLESS_MODE = process.argv.includes("--headless");
const GUI_PORT = Number(process.env.GUI_PORT || 3900);

let watchProc = null;
let serverProc = null;

function readTextAuto(file) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buf.length - 2);
    for (let i = 2; i < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return swapped.toString("utf16le");
  }
  return buf.toString("utf8");
}

function parseConfig() {
  const fallback = {
    siteTitle: "Markdown Tree View",
    contentDir: "content",
    publicDir: "public",
    templatesDir: "templates",
    assetsDir: "assets",
    host: "127.0.0.1",
    port: 3000,
    enableEdit: true
  };
  if (!fs.existsSync(CONFIG_FILE)) return fallback;

  try {
    const raw = readTextAuto(CONFIG_FILE).replace(/^\uFEFF/, "");
    const cleaned = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const normalized = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, '"');
    const cfg = JSON.parse(normalized);
    return {
      siteTitle: String(cfg.siteTitle || fallback.siteTitle),
      contentDir: String(cfg.contentDir || fallback.contentDir),
      publicDir: String(cfg.publicDir || fallback.publicDir),
      templatesDir: String(cfg.templatesDir || fallback.templatesDir),
      assetsDir: String(cfg.assetsDir || fallback.assetsDir),
      host: String(cfg.host || fallback.host),
      port: Number(cfg.port) > 0 ? Number(cfg.port) : fallback.port,
      enableEdit: cfg.enableEdit !== false
    };
  } catch {
    return fallback;
  }
}

function writeConfig(cfg) {
  const normalized = {
    siteTitle: String(cfg.siteTitle || "Markdown Tree View"),
    contentDir: String(cfg.contentDir || "content"),
    publicDir: String(cfg.publicDir || "public"),
    templatesDir: String(cfg.templatesDir || "templates"),
    assetsDir: String(cfg.assetsDir || "assets"),
    host: String(cfg.host || "127.0.0.1"),
    port: Number(cfg.port) > 0 ? Number(cfg.port) : 3000,
    enableEdit: cfg.enableEdit !== false
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(normalized, null, 2) + "\n", "utf8");
}

function spawnNode(args, label) {
  const proc = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: HEADLESS_MODE ? "ignore" : "inherit",
    windowsHide: HEADLESS_MODE
  });
  proc.on("exit", (code) => {
    if (!HEADLESS_MODE) console.log(`[runner] ${label} exited (${code})`);
  });
  return proc;
}

function startWatch() {
  if (watchProc && !watchProc.killed) return;
  watchProc = spawnNode([path.join(ROOT, "build.js"), "--watch"], "watch");
}

function startServer() {
  if (serverProc && !serverProc.killed) return;
  serverProc = spawnNode([path.join(ROOT, "server.js")], "server");
}

function stopServer() {
  if (serverProc && !serverProc.killed) {
    serverProc.kill();
  }
}

function restartServer() {
  stopServer();
  setTimeout(startServer, 200);
}

function writePidFile() {
  const payload = {
    managerPid: process.pid,
    watchPid: watchProc ? watchProc.pid : null,
    serverPid: serverProc ? serverProc.pid : null,
    startedAt: new Date().toISOString()
  };
  fs.writeFileSync(PID_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function ensureCleanup() {
  const cleanup = () => {
    try {
      if (watchProc && !watchProc.killed) watchProc.kill();
      if (serverProc && !serverProc.killed) serverProc.kill();
      if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    } catch {}
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

function openBrowser(url) {
  if (process.platform === "win32") exec(`start "" "${url}"`);
}

function startGui() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get("/api/config", (_, res) => {
    res.json(parseConfig());
  });

  app.post("/api/config", (req, res) => {
    const current = parseConfig();
    const next = {
      ...current,
      ...req.body,
      port: Number(req.body.port || current.port),
      enableEdit: req.body.enableEdit === true || req.body.enableEdit === "true"
    };

    writeConfig(next);

    // Equivalent to stop-runner: stop child processes managed by launcher.
    if (watchProc && !watchProc.killed) watchProc.kill();
    if (serverProc && !serverProc.killed) serverProc.kill();
    watchProc = null;
    serverProc = null;

    // Force one full rebuild, then start server again.
    execFile(process.execPath, [path.join(ROOT, "build.js")], { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({ ok: false, error: stderr || err.message, config: next });
      }

      startServer();
      startWatch();
      writePidFile();

      res.json({ ok: true, config: next, build: String(stdout || "").trim(), restarted: true });
    });
  });

  app.get("/api/status", (_, res) => {
    const cfg = parseConfig();
    res.json({
      managerPid: process.pid,
      watchPid: watchProc ? watchProc.pid : null,
      serverPid: serverProc ? serverProc.pid : null,
      siteUrl: `http://${cfg.host}:${cfg.port}`
    });
  });

  app.get("/", (_, res) => {
    res.send(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>KnowledgeBase Runner</title>
<style>
body{margin:0;font-family:"Segoe UI","PingFang SC",sans-serif;background:linear-gradient(120deg,#eff5ff,#eefaf4);color:#1d2433}
.wrap{max-width:920px;margin:24px auto;padding:0 14px}
.card{background:#fff;border:1px solid #d8e2f0;border-radius:14px;padding:16px;box-shadow:0 14px 30px rgba(23,34,60,.08)}
h1{margin:0 0 6px} .muted{color:#60708b}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
label{font-size:13px;color:#4a5b77;display:block;margin-bottom:5px}
input,select{width:100%;padding:9px 10px;border:1px solid #cfd9ea;border-radius:10px;background:#fff}
.row{margin-top:12px;display:flex;gap:10px;flex-wrap:wrap}
button,a.btn{padding:9px 13px;border-radius:10px;border:1px solid #c7d6ee;background:#0b63d7;color:#fff;text-decoration:none;cursor:pointer}
a.btn.alt,button.alt{background:#fff;color:#1d2433}
pre{background:#0f1724;color:#dce7ff;border-radius:10px;padding:10px;overflow:auto}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>运行控制台</h1>
    <p class="muted">已启动 build watch + server。修改后点击保存可即时生效。</p>
    <div id="status" class="muted"></div>
    <form id="cfg" class="grid">
      <div><label>站点标题 siteTitle</label><input name="siteTitle" /></div>
      <div><label>监听地址 host</label><input name="host" /></div>
      <div><label>服务端口 port</label><input name="port" type="number" min="1" /></div>
      <div><label>在线编辑 enableEdit</label><select name="enableEdit"><option value="true">true</option><option value="false">false</option></select></div>
      <div><label>内容目录 contentDir</label><input name="contentDir" /></div>
      <div><label>输出目录 publicDir</label><input name="publicDir" /></div>
      <div><label>模板目录 templatesDir</label><input name="templatesDir" /></div>
      <div><label>资源目录 assetsDir</label><input name="assetsDir" /></div>
    </form>
    <div class="row">
      <button id="saveBtn">保存配置</button>
      <a id="openSite" class="btn alt" href="#" target="_blank">打开站点</a>
      <button id="refreshBtn" class="alt">刷新状态</button>
    </div>
    <pre id="log"></pre>
  </div>
</div>
<script>
const form = document.getElementById('cfg');
const log = document.getElementById('log');
const status = document.getElementById('status');
const openSite = document.getElementById('openSite');

async function load(){
  const [cfgRes, stRes] = await Promise.all([fetch('/api/config'), fetch('/api/status')]);
  const cfg = await cfgRes.json();
  const st = await stRes.json();
  Object.entries(cfg).forEach(([k,v])=>{ if(form.elements[k]) form.elements[k].value=String(v); });
  status.textContent = "manager PID: " + st.managerPid + " | watch PID: " + st.watchPid + " | server PID: " + st.serverPid;
  openSite.href = st.siteUrl;
  log.textContent = JSON.stringify({config:cfg,status:st}, null, 2);
}

document.getElementById('saveBtn').addEventListener('click', async (e)=>{
  e.preventDefault();
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.enableEdit = payload.enableEdit === 'true';
  payload.port = Number(payload.port);
  const res = await fetch('/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const out = await res.json();
  log.textContent = JSON.stringify(out, null, 2);
  await load();
});

document.getElementById('refreshBtn').addEventListener('click', async (e)=>{e.preventDefault(); await load();});
load();
</script>
</body>
</html>`);
  });

  app.listen(GUI_PORT, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${GUI_PORT}`;
    if (!HEADLESS_MODE) console.log(`[runner] GUI ready: ${url}`);
    openBrowser(url);
  });
}

startWatch();
startServer();
writePidFile();
ensureCleanup();

if (GUI_MODE) {
  startGui();
} else if (!HEADLESS_MODE) {
  const cfg = parseConfig();
  console.log(`[runner] started | site: http://${cfg.host}:${cfg.port}`);
  console.log(`[runner] mode: console`);
}







