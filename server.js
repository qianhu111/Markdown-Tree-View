const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, "config.json");

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

function loadConfig() {
  const fallback = {
    contentDir: "content",
    publicDir: "public",
    host: "127.0.0.1",
    port: 3000,
    enableEdit: true
  };
  if (!fs.existsSync(CONFIG_FILE)) return fallback;
  try {
    const raw = readTextAuto(CONFIG_FILE).replace(/^\uFEFF/, "");
    const cleaned = raw
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const normalized = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, '"');
    const cfg = JSON.parse(normalized);
    return {
      contentDir: typeof cfg.contentDir === "string" && cfg.contentDir.trim() ? cfg.contentDir.trim() : fallback.contentDir,
      publicDir: typeof cfg.publicDir === "string" && cfg.publicDir.trim() ? cfg.publicDir.trim() : fallback.publicDir,
      host: typeof cfg.host === "string" && cfg.host.trim() ? cfg.host.trim() : fallback.host,
      port: Number(cfg.port) > 0 ? Number(cfg.port) : fallback.port,
      enableEdit: cfg.enableEdit !== false
    };
  } catch (err) {
    console.warn("[config] parse failed, fallback defaults:", err.message);
    return fallback;
  }
}

const cfg = loadConfig();
const PUBLIC_DIR = path.resolve(ROOT, cfg.publicDir);
const CONTENT_DIR = path.resolve(ROOT, cfg.contentDir);
const PORT = Number(process.env.PORT || cfg.port || 3000);
const HOST = process.env.HOST || cfg.host || "127.0.0.1";

app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

if (cfg.enableEdit) {
  app.get("/edit", (req, res) => {
    const rel = String(req.query.file || "notes/intro.md").replace(/\\/g, "/");
    const file = path.join(CONTENT_DIR, rel);
    if (!file.startsWith(CONTENT_DIR)) return res.status(400).send("Invalid path");

    let text = "";
    if (fs.existsSync(file)) text = fs.readFileSync(file, "utf8");

    res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>编辑 ${rel}</title>
<style>body{font-family:Segoe UI,sans-serif;max-width:980px;margin:16px auto;padding:0 12px}textarea{width:100%;height:70vh}input,button{padding:8px}</style>
</head><body>
<h1>编辑: ${rel}</h1>
<form method="post" action="/edit/save">
  <input type="text" name="file" value="${rel}" style="width:100%;margin-bottom:8px" />
  <textarea name="content">${text.replace(/</g, "&lt;")}</textarea>
  <div style="margin-top:10px"><button type="submit">保存并重建</button> <a href="/">返回站点</a></div>
</form>
</body></html>`);
  });

  app.post("/edit/save", (req, res) => {
    const rel = String(req.body.file || "").replace(/\\/g, "/");
    const file = path.join(CONTENT_DIR, rel);
    if (!rel.endsWith(".md") || !file.startsWith(CONTENT_DIR)) return res.status(400).send("Invalid file");

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(req.body.content || ""), "utf8");

    execFile(process.execPath, [path.join(ROOT, "build.js")], { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) return res.status(500).send(`<pre>${stderr || err.message}</pre>`);
      res.send(`<p>保存成功，构建完成。</p><pre>${stdout}</pre><p><a href="/${rel.replace(/\.md$/i, ".html")}">查看页面</a></p>`);
    });
  });
}

app.get("/", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`Server started: http://${HOST}:${PORT}`);
  if (HOST !== "127.0.0.1") console.log(`Local access: http://127.0.0.1:${PORT}`);
});

