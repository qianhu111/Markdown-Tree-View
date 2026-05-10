const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Resolve where the user-facing files live (config.json, content/, templates/, assets/).
function userDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(app.getPath("exe"));
  return path.resolve(__dirname, "..");
}

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dst, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

// First run: extract bundled defaults (config.json, content/, templates/, assets/)
// next to the .exe if the user hasn't placed any yet.
function ensureDefaults(root) {
  if (!app.isPackaged) return;
  const src = path.join(process.resourcesPath, "defaults");
  if (!fs.existsSync(src)) return;
  for (const name of ["config.json", "content", "templates", "assets"]) {
    const from = path.join(src, name);
    const to = path.join(root, name);
    if (fs.existsSync(to)) continue;
    if (!fs.existsSync(from)) continue;
    try {
      copyRecursive(from, to);
      console.log(`[init] extracted ${name}`);
    } catch (err) {
      console.error(`[init] failed extracting ${name}:`, err.message);
    }
  }
}

const state = {
  win: null,
  watcher: null,
  server: null,
  siteUrl: ""
};

let modules = null;
function getModules() {
  if (modules) return modules;
  modules = {
    paths: require("../lib/paths"),
    config: require("../lib/config"),
    builder: require("../lib/builder"),
    server: require("../lib/server")
  };
  return modules;
}

async function startBackend() {
  const { builder, server, config } = getModules();

  // startWatch performs the initial build itself.
  state.watcher = builder.startWatch({
    onRebuild: () => { /* could push toast via IPC; out of scope for v1 */ }
  });

  const cfg = config.loadConfig(["host", "port"]);
  state.server = server.createServer({
    watcherActive: true,
    onSaveRebuild: async () => {
      // Watcher will pick up the .md write; trigger an immediate rebuild for snappy UX.
      try { builder.buildSite(); } catch (err) { throw err; }
    }
  });
  try {
    const { host, port } = await state.server.listen(cfg.port, cfg.host);
    state.siteUrl = `http://${host}:${port}`;
  } catch (err) {
    state.siteUrl = "";
    dialog.showErrorBox("无法启动服务", `端口 ${cfg.port} 启动失败：${err.message}\n请在控制台修改端口后保存。`);
  }
}

async function restartBackend() {
  if (state.server) { try { await state.server.close(); } catch {} state.server = null; }
  // Watcher stays — it watches by absolute path which doesn't change with port.
  const { server, config } = getModules();
  const cfg = config.loadConfig(["host", "port"]);
  state.server = server.createServer({
    watcherActive: true,
    onSaveRebuild: async () => { getModules().builder.buildSite(); }
  });
  try {
    const { host, port } = await state.server.listen(cfg.port, cfg.host);
    state.siteUrl = `http://${host}:${port}`;
    return { ok: true, siteUrl: state.siteUrl };
  } catch (err) {
    state.siteUrl = "";
    return { ok: false, error: err.message };
  }
}

function createWindow() {
  state.win = new BrowserWindow({
    width: 980,
    height: 720,
    title: "Markdown Tree View · Runner",
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    autoHideMenuBar: true,
    backgroundColor: "#eff5ff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  state.win.removeMenu();
  state.win.loadFile(path.join(__dirname, "renderer.html"));
}

app.whenReady().then(async () => {
  const root = userDir();
  ensureDefaults(root);
  getModules().paths.setRoot(root);

  await startBackend();
  createWindow();
});

app.on("window-all-closed", () => {
  shutdown();
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  // Best-effort cleanup. Don't await — we want the process to die fast and
  // unconditionally, even if a watcher or HTTP keep-alive holds a handle.
  try { state.watcher && state.watcher.close(); } catch {}
  try { state.server && state.server.close().catch(() => {}); } catch {}
  // Hard backstop: if anything (chokidar, pending sockets, dialogs) still keeps
  // the event loop alive after a short grace, exit unconditionally.
  setTimeout(() => app.exit(0), 400);
  app.quit();
}

ipcMain.handle("config:get", () => {
  return getModules().config.loadConfig();
});

ipcMain.handle("config:save", async (_, body) => {
  const { config } = getModules();
  const current = config.loadConfig();
  const incoming = body || {};
  const next = config.writeConfig({
    ...current,
    ...incoming,
    port: Number(incoming.port || current.port),
    enableEdit: incoming.enableEdit === true || incoming.enableEdit === "true"
  });

  // Re-build with new config (siteTitle, dirs may have changed) and restart the server.
  try { getModules().builder.buildSite(); } catch (err) { return { ok: false, error: err.message, config: next }; }
  const r = await restartBackend();
  return { ok: r.ok, error: r.error, config: next, siteUrl: r.siteUrl };
});

ipcMain.handle("status:get", () => {
  return { siteUrl: state.siteUrl, pid: process.pid };
});

ipcMain.handle("site:open", async () => {
  if (!state.siteUrl) return { ok: false, error: "site not running" };
  await shell.openExternal(state.siteUrl);
  return { ok: true };
});

ipcMain.handle("app:stop", () => {
  // Respond immediately so the renderer doesn't sit on "stopping...".
  // shutdown() schedules a hard exit on its own.
  setImmediate(shutdown);
  return { ok: true };
});
