'use strict';
const crypto = require('crypto');

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    let v = part.slice(i + 1).trim();
    try { v = decodeURIComponent(v); } catch (e) { /* keep raw */ }
    out[k] = v;
  }
  return out;
}

function makeAuth(ctx) {
  const store = new Map();

  function appendCookie(res, value) {
    const prev = res.getHeader('Set-Cookie');
    if (!prev) res.setHeader('Set-Cookie', value);
    else res.setHeader('Set-Cookie', [].concat(prev, value));
  }

  const sessions = {
    create(res, data) {
      const sid = crypto.randomBytes(16).toString('hex');
      store.set(sid, { ...data, createdAt: Date.now() });
      appendCookie(res, `sid=${sid}; HttpOnly; Path=/; SameSite=Lax`);
      return sid;
    },
    destroy(req, res) {
      if (req.sid) store.delete(req.sid);
      appendCookie(res, 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    },
    clearAll() { store.clear(); },
  };

  function sessionMiddleware(req, res, next) {
    const sid = parseCookies(req.headers.cookie).sid;
    const s = sid ? store.get(sid) : null;
    req.sid = s ? sid : null;
    req.user = (s && s.user) || null;
    req.pending = (s && s.pending) || null;
    next();
  }

  const requireApi = (...roles) => (req, res, next) => {
    if (!req.user) return ctx.fail(res, 'UNAUTHENTICATED');
    if (roles.length && !roles.includes(req.user.role)) return ctx.fail(res, 'FORBIDDEN');
    next();
  };

  const requirePage = (...roles) => (req, res, next) => {
    if (!req.user) return res.redirect(302, '/login');
    if (roles.length && !roles.includes(req.user.role)) return ctx.renderForbidden(req, res);
    next();
  };

  return { parseCookies, sessions, sessionMiddleware, requireApi, requirePage };
}

module.exports = { makeAuth, parseCookies };
