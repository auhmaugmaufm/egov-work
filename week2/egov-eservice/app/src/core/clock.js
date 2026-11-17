'use strict';
const { DEFAULT_CLOCK } = require('./constants');

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const p2 = (n) => String(n).padStart(2, '0');

function toIso(d) {
  const ms = typeof d === 'number' ? d : d.getTime();
  const t = new Date(Math.floor(ms / 1000) * 1000 + 7 * 3600 * 1000);
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}` +
    `T${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}:${p2(t.getUTCSeconds())}+07:00`;
}

function parse(s) {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return null;
  const ms = Date.parse(s);
  return isNaN(ms) ? null : new Date(ms);
}

function createClock(testMode) {
  let frozenMs = testMode ? Date.parse(DEFAULT_CLOCK) : null;
  return {
    now() { return new Date(frozenMs ?? Date.now()); },
    nowIso() { return toIso(this.now()); },
    toIso,
    parse,
    set(d) { if (testMode) frozenMs = d.getTime(); },
    reset() { if (testMode) frozenMs = Date.parse(DEFAULT_CLOCK); },
  };
}

module.exports = { createClock, toIso, parse };
