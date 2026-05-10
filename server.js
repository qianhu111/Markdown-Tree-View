const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { ROOT, loadConfig } = require("./lib/config");

const app = express();

const cfg = loadConfig(["contentDir", "publicDir", "host", "port", "enableEdit"]);
const PUBLIC_DIR = path.resolve(ROOT, cfg.publicDir);
const CONTENT_DIR = path.resolve(ROOT, cfg.contentDir);
const PORT = Number(process.env.PORT || cfg.port || 3000);
const HOST = process.env.HOST || cfg.host || "127.0.0.1";
const RUNNER_WATCH = process.env.RUNNER_WATCH === "1";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveContentFile(rel) {
  const safeRel = String(rel || "").replace(/\\/g, "/");
  const abs = path.resolve(CONTENT_DIR, safeRel);
  if (abs !== CONTENT_DIR && !abs.startsWith(CONTENT_DIR + path.sep)) return null;
  return abs;
}

app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

if (cfg.enableEdit) {
  app.get("/edit", (req, res) => {
    const rel = String(req.query.file || "notes/intro.md").replace(/\\/g, "/");
    const file = resolveContentFile(rel);
    if (!file) return res.status(400).send("Invalid path");

    let text = "";
    if (fs.existsSync(file)) text = fs.readFileSync(file, "utf8");

    const safeRel = escapeHtml(rel);
    const safeText = escapeHtml(text);
    res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>编辑 ${safeRel}</title>
<style>body{font-family:Segoe UI,sans-serif;max-width:980px;margin:16px auto;padding:0 12px}textarea{width:100%;height:70vh}input,button{padding:8px}</style>
</head><body>
<h1>编辑: ${safeRel}</h1>
<form method="post" action="/edit/save">
  <input type="text" name="file" value="${safeRel}" style="width:100%;margin-bottom:8px" />
  <textarea name="content">${safeText}</textarea>
  <div style="margin-top:10px"><button type="submit">保存并重建</button> <a href="/">返回站点</a></div>
</form>
</body></html>`);
  });

  app.post("/edit/save", (req, res) => {
    const rel = String(req.body.file || "").replace(/\\/g, "/");
    if (!rel.toLowerCase().endsWith(".md")) return res.status(400).send("Invalid file");
    const file = resolveContentFile(rel);
    if (!file) return res.status(400).send("Invalid file");

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(req.body.content || ""), "utf8");

    const viewLink = `<p><a href="/${escapeHtml(rel.replace(/\.md$/i, ".html"))}">查看页面</a></p>`;

    if (RUNNER_WATCH) {
      // Launcher's build watcher will rebuild — skip explicit build to avoid duplicate work.
      return res.send(`<p>保存成功，watcher 将自动重建。</p>${viewLink}`);
    }

    execFile(process.execPath, [path.join(ROOT, "build.js")], { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) return res.status(500).send(`<pre>${escapeHtml(stderr || err.message)}</pre>`);
      res.send(`<p>保存成功，构建完成。</p><pre>${escapeHtml(stdout)}</pre>${viewLink}`);
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
