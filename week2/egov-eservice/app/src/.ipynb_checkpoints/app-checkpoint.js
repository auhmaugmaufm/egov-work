'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const { createContext } = require('./core/context');
const { removeDbFiles } = require('./core/db');

const testMode = process.env.TEST_MODE === '1';
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

// TEST_MODE: ลบ DB เดิมก่อนเปิด (กัน schema เก่าค้าง)
if (testMode) removeDbFiles(dbPath);

const ctx = createContext({ dbPath, testMode, bugMode: process.env.BUG_MODE || '' });
if (testMode) ctx.resetAll();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', false);

const isApi = (req) => req.path.startsWith('/api/');

// body parsers
app.use(express.json({ limit: '7mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.type === 'entity.too.large' || err.type === 'entity.parse.failed' || err.status === 400 || err.type) {
    return ctx.fail(res, 'BAD_REQUEST');
  }
  return next(err);
});

// session
app.use(ctx._auth.sessionMiddleware);

// guard /api/test/*
app.use('/api/test', (req, res, next) => (ctx.testMode ? next() : ctx.fail(res, 'NOT_FOUND')));

// request hooks
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/test/')) {
    for (const fn of ctx._hooks) {
      try { fn(req); } catch (e) { console.error('hook error:', e && e.stack); }
    }
  }
  next();
});

// core routes
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.post('/api/test/reset', (req, res) => {
  ctx.resetAll();
  res.status(200).json({ ok: true, now: ctx.clock.nowIso() });
});

app.get('/api/test/clock', (req, res) => res.status(200).json({ now: ctx.clock.nowIso() }));

app.put('/api/test/clock', (req, res) => {
  const now = req.body && req.body.now;
  const d = ctx.clock.parse(now);
  if (!d) return ctx.fail(res, 'INVALID_TIME');
  ctx.clock.set(d);
  res.status(200).json({ now: ctx.clock.toIso(d) });
});

app.post('/api/test/login-as', (req, res) => {
  const b = req.body || {};
  let row = null;
  if (typeof b.username === 'string') {
    row = ctx.db.prepare("SELECT * FROM users WHERE username = ? AND kind = 'staff'").get(b.username);
  } else if (typeof b.idNo === 'string') {
    row = ctx.db.prepare("SELECT * FROM users WHERE id_hash = ? AND kind = 'citizen'").get(ctx.crypto.hashId(b.idNo));
  }
  if (!row) return ctx.fail(res, 'NOT_FOUND');
  if (row.kind === 'citizen' && !row.registered) {
    const idNo = ctx.crypto.decrypt(row.id_enc);
    ctx.sessions.create(res, { pending: { userId: row.id, idNo, idHash: row.id_hash, name: row.name } });
    return res.status(200).json({ ok: true, role: 'citizen', registered: false });
  }
  ctx.sessions.create(res, {
    user: { id: row.id, kind: row.kind, username: row.username || null, name: row.name, role: row.role, dept: row.dept || null },
  });
  res.status(200).json({ ok: true, role: row.role, registered: true });
});

// modules (ตามตัวอักษร)
const modulesDir = path.join(__dirname, 'modules');
if (fs.existsSync(modulesDir)) {
  for (const name of fs.readdirSync(modulesDir).sort()) {
    const routes = path.join(modulesDir, name, 'routes.js');
    if (!fs.existsSync(routes)) continue;
    require(routes)(app, ctx);
    console.log('module loaded: ' + name);
  }
}

// 404
app.use((req, res) => {
  if (isApi(req)) return ctx.fail(res, 'NOT_FOUND');
  ctx.render(req, res, { status: 404, title: 'ไม่พบหน้า', body: '<h1>ไม่พบหน้าที่ต้องการ</h1>' });
});

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err && err.stack);
  if (res.headersSent) return;
  if (isApi(req)) return ctx.fail(res, 'INTERNAL');
  try {
    ctx.render(req, res, { status: 500, title: 'เกิดข้อผิดพลาด', body: '<h1>เกิดข้อผิดพลาดภายในระบบ</h1>' });
  } catch (e) {
    res.status(500).type('text/html; charset=utf-8').send('<h1>เกิดข้อผิดพลาดภายในระบบ</h1>');
  }
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    const active = ctx.bugActive();
    console.log(`listening on :${port} TEST_MODE=${testMode ? 1 : 0} BUG_MODE active: ${active.length ? active.join(',') : '(none)'}`);
  });
}

module.exports = { app, ctx };
