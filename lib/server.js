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
  const cfg = loadConfig(["siteTitle", "contentDir", "publicDir", "host", "port", "enableEdit"]);
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
      if (!rel.toLowerCase().endsWith(".md")) return res.status(400).send("Only .md files are editable");

      let text = "";
      let exists = false;
      if (fs.existsSync(file)) { text = fs.readFileSync(file, "utf8"); exists = true; }

      const safeRel = escapeHtml(rel);
      const safeText = escapeHtml(text);
      const articleUrl = "/" + rel.replace(/\.md$/i, ".html");
      const safeArticleUrl = escapeHtml(articleUrl);
      const safeSiteTitle = escapeHtml(cfg.siteTitle || "Markdown Tree View");

      res.send(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>编辑 ${safeRel} - ${safeSiteTitle}</title>
<link rel="stylesheet" href="/assets/styles.css" />
</head>
<body class="editor-page">
<div class="bg-orb orb-a"></div>
<div class="bg-orb orb-b"></div>
<header class="topbar">
  <div class="brand-wrap">
    <a class="brand" href="/index.html">${safeSiteTitle}</a>
    <div class="toolbar">
      <a href="${safeArticleUrl}">← 返回文章</a>
      <a href="/index.html">首页</a>
    </div>
  </div>
  <div class="editor-path" title="${safeRel}">${safeRel}${exists ? "" : ' <span class="badge new">新建</span>'}</div>
  <div class="actions">
    <button id="themeToggle" type="button">切换主题</button>
  </div>
</header>
<main class="editor-main">
  <div class="editor-tabs" role="tablist">
    <button type="button" class="tab active" data-tab="edit" role="tab" aria-selected="true">✏️ 编辑</button>
    <button type="button" class="tab" data-tab="preview" role="tab" aria-selected="false">👁 预览</button>
    <div class="editor-status" id="editorStatus" aria-live="polite"></div>
    <button type="button" class="save-btn" id="saveBtn" title="Ctrl+S">保存</button>
  </div>
  <div class="editor-pane edit-pane" data-pane="edit">
    <textarea id="editorTextarea" spellcheck="false" autocomplete="off">${safeText}</textarea>
  </div>
  <div class="editor-pane preview-pane hidden" data-pane="preview">
    <article id="previewBody"><p class="muted">切到此 tab 时会渲染预览…</p></article>
  </div>
</main>
<script>window.__EDIT_REL__ = ${JSON.stringify(rel)}; window.__ARTICLE_URL__ = ${JSON.stringify(articleUrl)};</script>
<script src="/assets/edit.js"></script>
</body>
</html>`);
    });

    app.post("/edit/preview", (req, res) => {
      const rel = String((req.body && req.body.rel) || "preview.md").replace(/\\/g, "/");
      // Path validation is best-effort here: even if rel is "../whatever",
      // renderPreview only uses it for wiki-link/asset path resolution; no
      // filesystem read happens with the rel itself.
      const content = String((req.body && req.body.content) || "");
      try {
        const { renderPreview } = require("./builder");
        res.json({ ok: true, html: renderPreview(content, rel) });
      } catch (err) {
        res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
      }
    });

    app.post("/edit/save", async (req, res) => {
      const rel = String((req.body && req.body.file) || "").replace(/\\/g, "/");
      if (!rel.toLowerCase().endsWith(".md")) return res.status(400).json({ ok: false, error: "Only .md files are editable" });
      const file = resolveContentFile(rel, CONTENT_DIR);
      if (!file) return res.status(400).json({ ok: false, error: "Invalid file path" });

      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, String((req.body && req.body.content) || ""), "utf8");
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }

      const articleUrl = "/" + rel.replace(/\.md$/i, ".html");

      if (onSaveRebuild) {
        try {
          await onSaveRebuild(rel);
          return res.json({ ok: true, articleUrl, mode: "rebuild" });
        } catch (err) {
          return res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
        }
      }

      if (watcherActive) {
        return res.json({ ok: true, articleUrl, mode: "watcher" });
      }

      execFile(process.execPath, [path.join(ROOT, "build.js")], { cwd: ROOT }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ ok: false, error: stderr || err.message });
        res.json({ ok: true, articleUrl, mode: "child", build: String(stdout || "").trim() });
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
