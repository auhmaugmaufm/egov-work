'use strict';
let set = new Set();

function parseBugMode(str) {
  return new Set(String(str || '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^B\d{2}$/.test(s)));
}
function init(str, testMode) { set = testMode ? parseBugMode(str) : new Set(); }
function bug(code) { return set.has(code); }
function active() { return [...set].sort(); }
function setForTest(list) { set = new Set(list); }

module.exports = { parseBugMode, init, bug, active, setForTest };
