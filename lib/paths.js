const path = require("path");

let _override = null;

function setRoot(p) {
  if (typeof p === "string" && p.length) _override = path.resolve(p);
}

function getRoot() {
  return _override || path.resolve(__dirname, "..");
}

module.exports = { setRoot, getRoot };
