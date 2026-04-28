const fs = require("fs");
const path = require("path");
const MarkdownIt = require("markdown-it");

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, "config.json");
const WATCH_MODE = process.argv.includes("--watch");

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
    siteTitle: "Markdown Tree View",
    contentDir: "content",
    publicDir: "public",
    templatesDir: "templates",
    assetsDir: "assets"
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
      siteTitle: typeof cfg.siteTitle === "string" && cfg.siteTitle.trim() ? cfg.siteTitle.trim() : fallback.siteTitle,
      contentDir: typeof cfg.contentDir === "string" && cfg.contentDir.trim() ? cfg.contentDir.trim() : fallback.contentDir,
      publicDir: typeof cfg.publicDir === "string" && cfg.publicDir.trim() ? cfg.publicDir.trim() : fallback.publicDir,
      templatesDir: typeof cfg.templatesDir === "string" && cfg.templatesDir.trim() ? cfg.templatesDir.trim() : fallback.templatesDir,
      assetsDir: typeof cfg.assetsDir === "string" && cfg.assetsDir.trim() ? cfg.assetsDir.trim() : fallback.assetsDir
    };
  } catch (err) {
    console.warn("[config] parse failed, fallback defaults:", err.message);
    return fallback;
  }
}

const config = loadConfig();
const CONTENT_DIR = path.resolve(ROOT, config.contentDir);
const PUBLIC_DIR = path.resolve(ROOT, config.publicDir);
const TEMPLATE_FILE = path.resolve(ROOT, config.templatesDir, "page.html");
const ASSETS_DIR = path.resolve(ROOT, config.assetsDir);

const md = new MarkdownIt({ html: false, linkify: true, typographer: false });

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function removeDirContent(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
}
function walkContent(baseDir) {
  const out = [];
  function walk(cur) {
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const abs = path.join(cur, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) out.push({ abs, rel: path.relative(baseDir, abs).replace(/\\/g, "/") });
    }
  }
  if (fs.existsSync(baseDir)) walk(baseDir);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}
function fileToUrl(mdRel) { return "/" + mdRel.replace(/\.md$/i, ".html"); }
function titleFromText(text, fallback) {
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^#\s+(.+)/);
    if (m) return m[1].trim();
  }
  return fallback;
}
function slugifyTag(tag) { return tag.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]/gi, "-"); }

function makeTreeItems(mdFiles) {
  const root = { type: "dir", name: "root", children: new Map() };
  for (const f of mdFiles) {
    const parts = f.rel.split("/");
    let node = root;
    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1;
      const key = `${isLast ? "file" : "dir"}:${part}`;
      if (!node.children.has(key)) {
        if (isLast) node.children.set(key, { type: "file", name: part, rel: f.rel, url: fileToUrl(f.rel) });
        else node.children.set(key, { type: "dir", name: part, children: new Map() });
      }
      const next = node.children.get(key);
      if (next.type === "dir") node = next;
    });
  }
  return root;
}

function treeToHtml(node) {
  const items = [...node.children.values()].sort((a, b) => (a.type !== b.type ? (a.type === "dir" ? -1 : 1) : a.name.localeCompare(b.name)));
  if (!items.length) return "";
  const html = items.map((it) => {
    if (it.type === "dir") return `<li><details open><summary>${it.name}</summary>${treeToHtml(it)}</details></li>`;
    return `<li><a href="${it.url}">${it.name.replace(/\.md$/i, "")}</a></li>`;
  }).join("");
  return `<ul>${html}</ul>`;
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  ensureDir(dst);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, entry.name);
    const b = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else { ensureDir(path.dirname(b)); fs.copyFileSync(a, b); }
  }
}

function transformWikiLinks(text, byName) {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, raw) => {
    const name = raw.trim();
    const found = byName.get(name.toLowerCase());
    if (!found) return `[[${name}]]`;
    return `[${name}](${found.url})`;
  });
}

function normalizeMdAssetPath(mdRelDir, p) {
  if (!p || /^(https?:)?\/\//i.test(p) || p.startsWith("data:")) return p;
  if (p.startsWith("/assets/")) return p;
  if (/^\.\/?assets\//i.test(p) || /^assets\//i.test(p)) return "/assets/" + p.replace(/^\.\/?assets\//i, "").replace(/^assets\//i, "");
  if (p.startsWith("./") || p.startsWith("../")) {
    const resolved = path.posix.normalize(path.posix.join(mdRelDir, p));
    const at = resolved.indexOf("/assets/");
    if (at >= 0) return resolved.slice(at);
  }
  return p;
}

function rewriteAssetLinks(mdRaw, mdRel) {
  const mdRelDir = path.posix.dirname(mdRel);
  return mdRaw
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, p) => `![${alt}](${normalizeMdAssetPath(mdRelDir, p)})`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, p) => `[${txt}](${normalizeMdAssetPath(mdRelDir, p)})`);
}

function extractTags(mdRaw) {
  const tags = new Set();
  const noCode = mdRaw.replace(/```[\s\S]*?```/g, "");
  const re = /(^|\s)#([\p{L}\p{N}_-]+)/gu;
  let m;
  while ((m = re.exec(noCode)) !== null) tags.add(m[2]);
  return [...tags];
}

function renderPage(template, title, treeHtml, contentHtml) {
  return template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{siteTitle\}\}/g, config.siteTitle)
    .replace(/\{\{tree\}\}/g, treeHtml)
    .replace(/\{\{content\}\}/g, contentHtml);
}

function buildSite() {
  ensureDir(CONTENT_DIR);
  ensureDir(PUBLIC_DIR);
  ensureDir(ASSETS_DIR);
  removeDirContent(PUBLIC_DIR);
  copyDir(ASSETS_DIR, path.join(PUBLIC_DIR, "assets"));

  const template = fs.readFileSync(TEMPLATE_FILE, "utf8");
  const mdFiles = walkContent(CONTENT_DIR);

  const byName = new Map();
  for (const f of mdFiles) byName.set(path.basename(f.rel, ".md").toLowerCase(), { rel: f.rel, url: fileToUrl(f.rel) });

  const treeHtml = treeToHtml(makeTreeItems(mdFiles));
  const pages = [];
  const backlinks = new Map();
  const tagMap = new Map();

  for (const f of mdFiles) {
    const raw = fs.readFileSync(f.abs, "utf8");
    const pageTitle = titleFromText(raw, path.basename(f.rel, ".md"));

    const wikiTargets = [...raw.matchAll(/\[\[([^\]]+)\]\]/g)].map((x) => x[1].trim());
    for (const t of wikiTargets) {
      const hit = byName.get(t.toLowerCase());
      if (!hit) continue;
      if (!backlinks.has(hit.rel)) backlinks.set(hit.rel, new Set());
      backlinks.get(hit.rel).add(f.rel);
    }

    const tags = extractTags(raw);
    for (const t of tags) {
      if (!tagMap.has(t)) tagMap.set(t, []);
      tagMap.get(t).push({ rel: f.rel, url: fileToUrl(f.rel), title: pageTitle });
    }

    pages.push({ rel: f.rel, url: fileToUrl(f.rel), title: pageTitle, raw, md: rewriteAssetLinks(transformWikiLinks(raw, byName), f.rel), tags });
  }

  for (const p of pages) {
    const bl = backlinks.get(p.rel);
    const backlinksHtml = bl && bl.size
      ? `<h3>Backlinks</h3><ul>${[...bl].sort().map((rel) => `<li><a href="${fileToUrl(rel)}">${pages.find((x) => x.rel === rel)?.title || path.basename(rel, ".md")}</a></li>`).join("")}</ul>`
      : "<h3>Backlinks</h3><p>暂无反向链接</p>";
    const tagsHtml = p.tags.length ? `<p>标签：${p.tags.map((t) => `<a href="/tags/${slugifyTag(t)}.html">#${t}</a>`).join(" ")}</p>` : "<p>标签：无</p>";
    const wrapped = `<article>${md.render(p.md)}<section class="meta">${tagsHtml}${backlinksHtml}</section></article>`;
    const outFile = path.join(PUBLIC_DIR, p.rel.replace(/\.md$/i, ".html"));
    ensureDir(path.dirname(outFile));
    fs.writeFileSync(outFile, renderPage(template, `${p.title} - ${config.siteTitle}`, treeHtml, wrapped), "utf8");
  }

  const indexContent = `<h1>首页</h1><p>共 ${pages.length} 篇文档</p><ul>${pages.map((p) => `<li><a href="${p.url}">${p.title}</a> <small>${p.rel}</small></li>`).join("")}</ul>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, "index.html"), renderPage(template, `${config.siteTitle} - 首页`, treeHtml, indexContent), "utf8");

  const tagDir = path.join(PUBLIC_DIR, "tags");
  ensureDir(tagDir);
  const tagIndexList = [...tagMap.keys()].sort((a, b) => a.localeCompare(b)).map((t) => `<li><a href="/tags/${slugifyTag(t)}.html">#${t}</a> (${tagMap.get(t).length})</li>`).join("");
  fs.writeFileSync(path.join(tagDir, "index.html"), renderPage(template, `${config.siteTitle} - 标签`, treeHtml, `<h1>标签页</h1><ul>${tagIndexList}</ul>`), "utf8");

  for (const [tag, items] of tagMap.entries()) {
    const content = `<h1>#${tag}</h1><ul>${items.map((it) => `<li><a href="${it.url}">${it.title}</a></li>`).join("")}</ul>`;
    fs.writeFileSync(path.join(tagDir, `${slugifyTag(tag)}.html`), renderPage(template, `${config.siteTitle} - #${tag}`, treeHtml, content), "utf8");
  }

  const search = pages.map((p) => ({ title: p.title, path: p.url, content: p.raw.replace(/```[\s\S]*?```/g, " ").replace(/[#>*`\[\]\(\)!_-]/g, " ").replace(/\s+/g, " ").trim() }));
  fs.writeFileSync(path.join(PUBLIC_DIR, "search.json"), JSON.stringify(search, null, 2), "utf8");

  console.log(`[build] done at ${new Date().toLocaleString()} | pages=${pages.length} | title=${config.siteTitle}`);
}

function startWatch() {
  let chokidar;
  try { chokidar = require("chokidar"); }
  catch { console.log("[watch] chokidar 未安装，跳过 watch 模式。"); return; }

  buildSite();

  // Watch config.json explicitly and debounce rebuilds to support editors that save via temp-file replace.
  const watchTargets = [CONTENT_DIR, TEMPLATE_FILE, ASSETS_DIR, CONFIG_FILE];
  const watcher = chokidar.watch(watchTargets, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 30 }
  });

  let timer = null;
  let reason = "";
  const scheduleRebuild = (event, changedPath) => {
    reason = `${event}: ${changedPath}`;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        buildSite();
        console.log(`[watch] rebuilt <- ${reason}`);
      } catch (err) {
        console.error("[build] failed:", err.message);
      }
    }, 80);
  };

  watcher.on("all", (event, changedPath) => {
    scheduleRebuild(event, changedPath);
  });

  console.log("[watch] listening for file changes...");
  console.log(`[watch] includes config: ${CONFIG_FILE}`);
}

if (WATCH_MODE) startWatch();
else buildSite();




