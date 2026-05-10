const fs = require("fs");
const path = require("path");
const { getRoot } = require("./paths");

const FULL_DEFAULTS = Object.freeze({
  siteTitle: "Markdown Tree View",
  contentDir: "content",
  publicDir: "public",
  templatesDir: "templates",
  assetsDir: "assets",
  host: "127.0.0.1",
  port: 3000,
  enableEdit: true
});

function configFile() {
  return path.join(getRoot(), "config.json");
}

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

function pickString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function loadConfig(keys) {
  const want = Array.isArray(keys) && keys.length ? keys : Object.keys(FULL_DEFAULTS);
  const fallback = {};
  for (const k of want) fallback[k] = FULL_DEFAULTS[k];

  const file = configFile();
  if (!fs.existsSync(file)) return fallback;

  let cfg;
  try {
    const raw = readTextAuto(file).replace(/^﻿/, "");
    const cleaned = raw
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const normalized = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, '"');
    cfg = JSON.parse(normalized);
  } catch (err) {
    console.warn("[config] parse failed, fallback defaults:", err.message);
    return fallback;
  }

  const out = {};
  for (const k of want) {
    if (k === "port") out.port = Number(cfg.port) > 0 ? Number(cfg.port) : fallback.port;
    else if (k === "enableEdit") out.enableEdit = cfg.enableEdit !== false;
    else out[k] = pickString(cfg[k], fallback[k]);
  }
  return out;
}

function writeConfig(cfg) {
  const merged = { ...FULL_DEFAULTS };
  for (const k of Object.keys(FULL_DEFAULTS)) {
    if (k === "port") merged.port = Number(cfg.port) > 0 ? Number(cfg.port) : FULL_DEFAULTS.port;
    else if (k === "enableEdit") merged.enableEdit = cfg.enableEdit !== false;
    else merged[k] = pickString(cfg[k], FULL_DEFAULTS[k]);
  }
  fs.writeFileSync(configFile(), JSON.stringify(merged, null, 2) + "\n", "utf8");
  return merged;
}

module.exports = {
  DEFAULTS: FULL_DEFAULTS,
  get ROOT() { return getRoot(); },
  get CONFIG_FILE() { return configFile(); },
  readTextAuto,
  loadConfig,
  writeConfig
};
