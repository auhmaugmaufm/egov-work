'use strict';
const multer = require('multer');
const { openDb, createSchema, clearAll } = require('./db');
const { createClock } = require('./clock');
const bugmode = require('./bugmode');
const { makeAuth } = require('./auth');
const { makeAudit, makeCaseEvent } = require('./audit');
const { makeLayout, esc } = require('./layout');
const ERRORS = require('./errors');
const constants = require('./constants');
const cryptoLib = require('./crypto');
const pdf = require('./pdf');

function loadSeed() {
  try { return require('../seed'); } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' && String(e.message).includes("'../seed'")) return null;
    throw e;
  }
}

function createContext({ dbPath, testMode, bugMode }) {
  const db = openDb(dbPath);
  createSchema(db);
  bugmode.init(bugMode, testMode);
  const clock = createClock(testMode);

  const ctx = {
    db, testMode: !!testMode, clock, crypto: cryptoLib, pdf, constants, esc,
    bug: bugmode.bug, bugActive: bugmode.active,
    _hooks: [],
  };
  Object.defineProperty(ctx, 'rules', { enumerable: true, get() { return require('./rules'); } });
  Object.defineProperty(ctx, 'views', { enumerable: true, get() { return require('./views'); } });

  ctx.tx = (fn) => db.transaction(fn)();
  ctx.nextCounter = (name) => ctx.tx(() => {
    db.prepare('INSERT INTO counters(name,value) VALUES(?,1) ON CONFLICT(name) DO UPDATE SET value = value + 1').run(name);
    return db.prepare('SELECT value FROM counters WHERE name = ?').get(name).value;
  });
  ctx.holidays = () => new Set(db.prepare('SELECT date FROM holidays').all().map((r) => r.date));
  ctx.getService = (id) => db.prepare('SELECT id,name,fee,fee_per_sqm,sla FROM services WHERE id = ?').get(id);
  ctx.audit = makeAudit(db, clock);
  ctx.caseEvent = makeCaseEvent(db, clock);
  ctx.fail = (res, code, extra = {}) => {
    const [st, msg] = ERRORS[code] || ERRORS.INTERNAL;
    return res.status(st).json({ code, message: msg, ...extra });
  };
  ctx.jsonForScript = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
  ctx.baseUrl = (req) => process.env.PUBLIC_BASE_URL || (req.protocol + '://' + req.get('host'));
  ctx.onRequest = (fn) => { ctx._hooks.push(fn); };

  const auth = makeAuth(ctx);
  ctx.sessions = auth.sessions;
  ctx.requireApi = auth.requireApi;
  ctx.requirePage = auth.requirePage;
  ctx._auth = auth;

  const layout = makeLayout(ctx);
  ctx.render = layout.render;
  ctx.renderForbidden = layout.renderForbidden;
  ctx.renderCaseNotFound = layout.renderCaseNotFound;

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
  const wrap = (mw, post) => (req, res, next) => mw(req, res, (err) => {
    if (err) {
      const code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE'
        : (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') ? 'FILE_COUNT' : 'BAD_REQUEST';
      return ctx.fail(res, code);
    }
    if (post) post(req);
    next();
  });
  ctx.multipartSingle = (field) => wrap(upload.single(field));
  ctx.multipartArray = (field, max) => wrap(upload.array(field, max), (req) => { req.files = req.files || []; });

  ctx.resetAll = () => {
    ctx.tx(() => {
      clearAll(db);
      clock.reset(); // ก่อน seed เพื่อให้ created_at ใช้ 09:00
      const seed = loadSeed();
      if (seed) seed(ctx);
    });
    ctx.sessions.clearAll();
    clock.reset();
  };

  // ไม่ใช่ TEST_MODE: seed เมื่อ users ว่าง
  if (!testMode && db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) ctx.resetAll();

  return ctx;
}

module.exports = { createContext };
