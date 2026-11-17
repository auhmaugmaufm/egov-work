'use strict';
const pages = require('./pages');

const LANDING = {
  citizen: '/citizen', officer: '/officer/queue', head: '/head/approvals',
  executive: '/dashboard', auditor: '/audit', admin: '/admin/services',
};
const MAX_FAILS = 3;
const LOCK_MS = 15 * 60 * 1000;

module.exports = function register(app, ctx) {
  const landingOf = (role) => LANDING[role] || '/';
  const str = (v) => (typeof v === 'string' ? v : '');

  // ---------- หน้า ----------
  app.get('/', (req, res) => {
    if (req.user) return res.redirect(302, landingOf(req.user.role));
    if (req.pending) return res.redirect(302, '/register');
    res.redirect(302, '/login');
  });
  app.get('/login', (req, res) => ctx.render(req, res, pages.loginPage()));
  app.get('/register', (req, res) => {
    if (req.user) return res.redirect(302, landingOf(req.user.role));
    if (!req.pending) return res.redirect(302, '/login');
    ctx.render(req, res, pages.registerPage(req.pending.name, ctx.esc));
  });
  app.post('/logout', (req, res) => {
    ctx.sessions.destroy(req, res);
    res.redirect(303, '/login');
  });

  // ---------- OTP ----------
  // คืน null ถ้าผ่านด่านล็อก (และเคลียร์ล็อกที่หมดอายุ) หรือ lockedUntil ถ้ายังล็อก
  function checkLock(h, now) {
    const row = ctx.db.prepare('SELECT fail_count, locked_until FROM otp_attempts WHERE id_hash = ?').get(h);
    if (row && row.locked_until) {
      if (now.getTime() < Date.parse(row.locked_until)) return row.locked_until;
      ctx.db.prepare('UPDATE otp_attempts SET locked_until = NULL, fail_count = 0 WHERE id_hash = ?').run(h);
      return null;
    }
    return null;
  }
  const setAttempt = (h, fail, lockedUntil) =>
    ctx.db.prepare(`INSERT INTO otp_attempts(id_hash, fail_count, locked_until) VALUES(?,?,?)
      ON CONFLICT(id_hash) DO UPDATE SET fail_count = excluded.fail_count, locked_until = excluded.locked_until`)
      .run(h, fail, lockedUntil);

  app.post('/api/auth/thaid/start', (req, res) => {
    const idNo = (req.body || {}).idNo;
    if (!ctx.rules.isValidThaiId(idNo)) return ctx.fail(res, 'INVALID_ID');
    const h = ctx.crypto.hashId(idNo);
    const locked = ctx.tx(() => checkLock(h, ctx.clock.now()));
    if (locked) return ctx.fail(res, 'LOCKED', { lockedUntil: locked });
    res.status(200).json({ status: 'OTP_SENT' });
  });

  app.post('/api/auth/thaid/verify', (req, res) => {
    const body = req.body || {};
    const idNo = body.idNo;
    if (!ctx.rules.isValidThaiId(idNo)) return ctx.fail(res, 'INVALID_ID');
    const otp = body.otp;
    const h = ctx.crypto.hashId(idNo);
    const out = ctx.tx(() => {
      const now = ctx.clock.now();
      const locked = checkLock(h, now);
      if (locked) return { err: 'LOCKED', extra: { lockedUntil: locked } };
      if (otp !== ctx.constants.OTP_CODE) {
        const row = ctx.db.prepare('SELECT fail_count FROM otp_attempts WHERE id_hash = ?').get(h);
        const fail = (row ? row.fail_count : 0) + 1;
        if (fail >= MAX_FAILS) {
          const until = ctx.clock.toIso(now.getTime() + LOCK_MS);
          setAttempt(h, 0, until);
          return { err: 'LOCKED', extra: { lockedUntil: until } };
        }
        setAttempt(h, fail, null);
        return { err: 'OTP_INVALID', extra: { attemptsLeft: MAX_FAILS - fail } };
      }
      setAttempt(h, 0, null);
      return { user: ctx.db.prepare('SELECT * FROM users WHERE id_hash = ?').get(h) };
    });
    if (out.err) return ctx.fail(res, out.err, out.extra);
    const u = out.user;
    if (u && u.registered === 1) {
      ctx.sessions.create(res, { user: { id: u.id, kind: 'citizen', username: null, name: u.name, role: 'citizen', dept: null } });
      return res.status(200).json({ registered: true });
    }
    ctx.sessions.create(res, { pending: { userId: u ? u.id : null, idNo, idHash: h, name: u ? u.name : 'ผู้ใช้ ThaiD (จำลอง)' } });
    res.status(200).json({ registered: false });
  });

  // ---------- ลงทะเบียน ----------
  app.post('/api/auth/register', (req, res) => {
    const p = req.pending;
    if (!p) return ctx.fail(res, 'UNAUTHENTICATED');
    const body = req.body || {};
    const mobile = body.mobile;
    if (typeof mobile !== 'string' || !/^0\d{9}$/.test(mobile)) return ctx.fail(res, 'INVALID_MOBILE');
    if (body.consent !== true) return ctx.fail(res, 'CONSENT_REQUIRED');
    const email = String(body.email ?? '').trim();
    const user = ctx.tx(() => {
      const now = ctx.clock.nowIso();
      let id = p.userId;
      const mob = ctx.crypto.encrypt(mobile);
      if (id) {
        ctx.db.prepare('UPDATE users SET mobile_enc = ?, email = ?, registered = 1, consent_at = ? WHERE id = ?')
          .run(mob, email, now, id);
      } else {
        const ex = ctx.db.prepare('SELECT id FROM users WHERE id_hash = ?').get(p.idHash);
        if (ex) {
          id = ex.id;
          ctx.db.prepare('UPDATE users SET mobile_enc = ?, email = ?, registered = 1, consent_at = ? WHERE id = ?')
            .run(mob, email, now, id);
        } else {
          id = ctx.db.prepare(`INSERT INTO users(kind, username, name, role, dept, id_hash, id_enc, mobile_enc, email, registered, consent_at, created_at)
            VALUES('citizen', NULL, ?, 'citizen', NULL, ?, ?, ?, ?, 1, ?, ?)`)
            .run(p.name, p.idHash, ctx.crypto.encrypt(p.idNo), mob, email, now, now).lastInsertRowid;
        }
      }
      const row = ctx.db.prepare('SELECT id, name FROM users WHERE id = ?').get(Number(id));
      return { id: row.id, kind: 'citizen', username: null, name: row.name, role: 'citizen', dept: null };
    });
    ctx.sessions.destroy(req, res);
    ctx.sessions.create(res, { user });
    res.status(201).json({ registered: true, landing: '/citizen' });
  });

  // ---------- เจ้าหน้าที่ ----------
  app.post('/api/auth/staff/login', (req, res) => {
    const body = req.body || {};
    const username = str(body.username), password = str(body.password);
    const u = username
      ? ctx.db.prepare("SELECT * FROM users WHERE kind = 'staff' AND username = ?").get(username) : null;
    if (!u || !ctx.crypto.verifyPassword(password, u.password_hash)) return ctx.fail(res, 'INVALID_CREDENTIALS');
    ctx.sessions.destroy(req, res);
    ctx.sessions.create(res, { user: { id: u.id, kind: 'staff', username: u.username, name: u.name, role: u.role, dept: u.dept || null } });
    ctx.audit({ username: u.username, role: u.role }, { event: 'STAFF_LOGIN' });
    res.status(200).json({ role: u.role, dept: u.role === 'officer' ? (u.dept || null) : null, landing: landingOf(u.role) });
  });

  app.post('/api/auth/logout', (req, res) => {
    ctx.sessions.destroy(req, res);
    res.status(204).end();
  });

  app.get('/api/me', ctx.requireApi(), (req, res) => {
    const u = req.user;
    res.status(200).json({ username: u.username || null, name: u.name, role: u.role, dept: u.dept || null });
  });
};
