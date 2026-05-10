const { createServer } = require("./lib/server");
const { loadConfig } = require("./lib/config");

const cfg = loadConfig(["host", "port"]);
const PORT = Number(process.env.PORT || cfg.port || 3000);
const HOST = process.env.HOST || cfg.host || "127.0.0.1";

createServer().listen(PORT, HOST).catch((err) => {
  console.error("[server] failed to start:", err.message);
  process.exit(1);
});
