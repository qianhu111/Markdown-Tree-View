const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (cfg) => ipcRenderer.invoke("config:save", cfg),
  getStatus: () => ipcRenderer.invoke("status:get"),
  openSite: () => ipcRenderer.invoke("site:open"),
  stop: () => ipcRenderer.invoke("app:stop")
});
