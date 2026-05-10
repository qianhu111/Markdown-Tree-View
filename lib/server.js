const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { getRoot } = require("./paths");
const { loadConfig } = require("./config");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveContentFile(rel, contentDir) {
  const safeRel = String(rel || "").replace(/\\/g, "/");
  const abs = path.resolve(contentDir, safeRel);
  if (abs !== contentDir && !abs.startsWith(contentDir + path.sep)) return null;
  return abs;
}

/**
 * Build an express app for serving the built site and (optionally) the editor.
 * - opts.watcherActive: if true, /edit/save skips the explicit child build and
 *   relies on the caller's watcher to rebuild.
 * - opts.onSaveRebuild: optional async hook for in-process rebuilds (Electron).
 */
function createServer(opts = {}) {
  const ROOT = getRoot();
  const cfg = loadConfig(["contentDir", "publicDir", "host", "port", "enableEdit"]);
  const PUBLIC_DIR = path.resolve(ROOT, cfg.publicDir);
  const CONTENT_DIR = path.resolve(ROOT, cfg.contentDir);

  const watcherActive = !!opts.watcherActive || process.env.RUNNER_WATCH === "1";
  const onSaveRebuild = typeof opts.onSaveRebuild === "function" ? opts.onSaveRebuild : null;

  const app = express();
  app.use(express.urlencoded({ extended: false, limit: "2mb" }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(PUBLIC_DIR));

  if (cfg.enableEdit) {
    app.get("/edit", (req, res) => {
      const rel = String(req.query.file || "notes/intro.md").replace(/\\/g, "/");
      const file = resolveContentFile(rel, CONTENT_DIR);
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

    app.post("/edit/save", async (req, res) => {
      const rel = String(req.body.file || "").replace(/\\/g, "/");
      if (!rel.toLowerCase().endsWith(".md")) return res.status(400).send("Invalid file");
      const file = resolveContentFile(rel, CONTENT_DIR);
      if (!file) return res.status(400).send("Invalid file");

      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, String(req.body.content || ""), "utf8");

      const viewLink = `<p><a href="/${escapeHtml(rel.replace(/\.md$/i, ".html"))}">查看页面</a></p>`;

      if (onSaveRebuild) {
        try {
          await onSaveRebuild(rel);
          return res.send(`<p>保存成功，构建完成。</p>${viewLink}`);
        } catch (err) {
          return res.status(500).send(`<pre>${escapeHtml(err && err.message ? err.message : String(err))}</pre>`);
        }
      }

      if (watcherActive) {
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

  let server = null;

  function listen(port, host) {
    const PORT = Number(port || process.env.PORT || cfg.port || 3000);
    const HOST = host || process.env.HOST || cfg.host || "127.0.0.1";
    return new Promise((resolve, reject) => {
      server = app.listen(PORT, HOST, () => {
        console.log(`Server started: http://${HOST}:${PORT}`);
        if (HOST !== "127.0.0.1") console.log(`Local access: http://127.0.0.1:${PORT}`);
        resolve({ host: HOST, port: PORT });
      });
      server.once("error", reject);
    });
  }

  function close() {
    return new Promise((resolve) => {
      if (!server) return resolve();
      // Drop keep-alive HTTP connections so close() doesn't hang on them.
      if (typeof server.closeAllConnections === "function") {
        try { server.closeAllConnections(); } catch {}
      }
      server.close(() => resolve());
    });
  }

  return { app, listen, close };
}

module.exports = { createServer };
