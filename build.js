const { buildSite, startWatch } = require("./lib/builder");

if (process.argv.includes("--watch")) {
  startWatch();
} else {
  buildSite();
}
