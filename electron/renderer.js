const form = document.getElementById("cfg");
const log = document.getElementById("log");
const status = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const openBtn = document.getElementById("openBtn");
const refreshBtn = document.getElementById("refreshBtn");
const stopBtn = document.getElementById("stopBtn");

function setLog(obj) {
  log.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

async function load() {
  const [cfg, st] = await Promise.all([window.api.getConfig(), window.api.getStatus()]);
  Object.entries(cfg).forEach(([k, v]) => {
    if (form.elements[k]) form.elements[k].value = String(v);
  });
  status.textContent = "PID: " + st.pid + " | 站点: " + (st.siteUrl || "(未启动)");
  setLog({ config: cfg, status: st });
}

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  try {
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.enableEdit = payload.enableEdit === "true";
    payload.port = Number(payload.port);
    const out = await window.api.saveConfig(payload);
    setLog(out);
    await load();
  } finally {
    saveBtn.disabled = false;
  }
});

openBtn.addEventListener("click", async () => {
  const out = await window.api.openSite();
  if (!out.ok) setLog(out);
});

refreshBtn.addEventListener("click", load);

stopBtn.addEventListener("click", async () => {
  stopBtn.disabled = true;
  setLog("stopping...");
  await window.api.stop();
});

load();
