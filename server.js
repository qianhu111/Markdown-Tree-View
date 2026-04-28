const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const CONTENT_DIR = path.join(ROOT, "content");
const PORT = Number(process.env.PORT || 3000);

app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

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

app.get("/", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started: http://127.0.0.1:${PORT}`);
  console.log(`Server started: http://localhost:${PORT}`);
});
