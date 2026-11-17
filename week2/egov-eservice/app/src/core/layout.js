'use strict';
const { ROLE_TH } = require('./constants');

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,"Noto Sans Thai",sans-serif;line-height:1.5;color:#1a1a1a;background:#fff;overflow-wrap:anywhere}
main{padding:16px;max-width:1200px;margin:0 auto}
footer{padding:16px;text-align:center}
.app-header{background:#0b3d6e;color:#fff;display:flex;flex-wrap:wrap;gap:8px 16px;padding:8px 16px;align-items:center}
.app-header a{color:#fff;text-decoration:underline}
.app-header .who{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-left:auto}
.app-header form{margin:0}
nav ul{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}
.table-wrap{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #8a8a8a;padding:6px;text-align:left;vertical-align:top}
input,select,textarea{font:inherit;max-width:100%;padding:6px;border:1px solid #5a5a5a}
textarea{width:100%}
button,.btn{font:inherit;padding:8px 14px;border-radius:4px;border:1px solid #0b3d6e;background:#0b5394;color:#fff;cursor:pointer;display:inline-block;text-decoration:none}
.btn-secondary{background:#fff;color:#0b3d6e}
.btn-danger{background:#a4161a;border-color:#7a0f12;color:#fff}
button:disabled{background:#d6d6d6;color:#3d3d3d;border-color:#8a8a8a;cursor:not-allowed}
:focus{outline:3px solid #f0a400;outline-offset:2px}
.skip-link{position:absolute;left:-9999px}
.skip-link:focus{left:8px;top:8px;background:#fff;color:#0b3d6e;padding:8px;z-index:10}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;border:1px solid currentColor;font-weight:600}
.st-DRAFT,.st-PENDING_PAYMENT,.st-CANCELLED{color:#3d3d3d;background:#e6e6e6}
.st-SUBMITTED{color:#0b4a8b;background:#e3eefa}
.st-IN_REVIEW{color:#6a3d00;background:#fff1d6}
.st-NEED_FIX{color:#8a1c00;background:#ffe4d6}
.st-PENDING_APPROVAL{color:#4b2a7a;background:#efe6fb}
.st-APPROVED,.st-COMPLETED{color:#0f5323;background:#e2f3e6}
.st-REJECTED{color:#8b0000;background:#fde7e9}
.lv-normal{color:#0f5323;background:#e2f3e6}
.lv-near{color:#6a4a00;background:#fff4c2}
.lv-overdue{color:#8b0000;background:#fde7e9}
.lv-paused,.lv-closed{color:#3d3d3d;background:#e6e6e6}
.alert-error{background:#fde7e9;color:#8b0000;border:1px solid #8b0000;padding:8px;margin:8px 0}
.alert-success{background:#e2f3e6;color:#0f5323;border:1px solid #0f5323;padding:8px;margin:8px 0}
.muted{color:#555}
.card{border:1px solid #c4c4c4;border-radius:6px;padding:12px;margin:12px 0}
.form-row{margin:8px 0;display:flex;flex-direction:column;gap:4px;max-width:480px}
.grid-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:end}
.dialog{border:2px solid #0b3d6e;background:#fff;padding:16px;margin:12px 0}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`.trim();

const APP_JS = `
window.App = (function () {
  var TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function flash() { return document.getElementById('flash'); }
  function api(method, url, body) {
    var opts = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined && body !== null) {
      if (typeof FormData !== 'undefined' && body instanceof FormData) { opts.body = body; }
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    return fetch(url, opts).then(function (r) {
      var ct = r.headers.get('content-type') || '';
      var p = ct.indexOf('json') >= 0 ? r.json().catch(function () { return null; }) : Promise.resolve(null);
      return p.then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
    });
  }
  function showError(msg) {
    var f = flash(); if (!f) return;
    f.innerHTML = '<div data-testid="action-error" role="alert" class="alert-error">' + esc(msg) + '</div>';
  }
  function showSuccess(msg) {
    var f = flash(); if (!f) return;
    f.innerHTML = '<div data-testid="action-success" role="status" class="alert-success">' + esc(msg) + '</div>';
  }
  function clearFlash() { var f = flash(); if (f) f.innerHTML = ''; }
  function baht(n) { return '\\u0E3F' + Number(n).toLocaleString('en-US'); }
  function fmtId(s) {
    s = String(s || '');
    if (s.length !== 13) return s;
    return s[0] + '-' + s.slice(1, 5) + '-' + s.slice(5, 10) + '-' + s.slice(10, 12) + '-' + s[12];
  }
  function thaiDate(d) {
    var m = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(String(d || ''));
    if (!m) return '';
    return parseInt(m[3], 10) + ' ' + TH[parseInt(m[2], 10) - 1] + ' ' + (parseInt(m[1], 10) + 543);
  }
  function thaiDateTime(iso) {
    var m = /^(\\d{4}-\\d{2}-\\d{2})T(\\d{2}):(\\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    return thaiDate(m[1]) + ' ' + m[2] + ':' + m[3];
  }
  return { api: api, showError: showError, showSuccess: showSuccess, clearFlash: clearFlash,
    esc: esc, baht: baht, fmtId: fmtId, thaiDateTime: thaiDateTime, thaiDate: thaiDate };
})();
`.trim();

const MENUS = {
  citizen: [['nav-my-cases', '/citizen', 'คำขอของฉัน']],
  officer: [['nav-queue', '/officer/queue', 'คิวงาน'], 'bell'],
  head: [['nav-queue', '/officer/queue', 'คิวงาน'], ['nav-approvals', '/head/approvals', 'รออนุมัติ'], 'bell'],
  executive: [['nav-dashboard', '/dashboard', 'Dashboard']],
  auditor: [['nav-audit', '/audit', 'Audit Trail']],
  admin: [['nav-admin-services', '/admin/services', 'บริการ'], ['nav-admin-holidays', '/admin/holidays', 'วันหยุด'],
    ['nav-admin-users', '/admin/users', 'ผู้ใช้']],
};

function makeLayout(ctx) {
  function header(user) {
    const items = (MENUS[user.role] || []).map((m) => {
      if (m === 'bell') {
        const n = ctx.db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE username = ?').get(user.username).n;
        return `<li><a data-testid="nav-bell" href="/notifications">แจ้งเตือน <span data-testid="bell-count">${n}</span></a></li>`;
      }
      return `<li><a data-testid="${m[0]}" href="${m[1]}">${esc(m[2])}</a></li>`;
    }).join('');
    const dept = user.role === 'officer' && user.dept ? ` data-dept="${esc(user.dept)}"` : '';
    return `<header data-testid="app-header" class="app-header">
  <a class="brand" href="/">e-Service เทศบาลนครตัวอย่าง</a>
  <nav aria-label="เมนูหลัก"><ul>${items}</ul></nav>
  <div class="who"><span data-testid="user-name">${esc(user.name)}</span>
    <span data-testid="user-role" data-role="${esc(user.role)}"${dept}>${esc(ROLE_TH[user.role] || user.role)}</span>
    <form method="post" action="/logout"><button type="submit" data-testid="logout-btn" class="btn-secondary">ออกจากระบบ</button></form></div>
</header>`;
  }

  function render(req, res, opts) {
    const { title = '', body = '', status = 200, script = '' } = opts || {};
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · e-Service เทศบาลนครตัวอย่าง</title><style>${CSS}</style></head>
<body><a class="skip-link" href="#main">ข้ามไปเนื้อหาหลัก</a>
${req.user ? header(req.user) : ''}
<main id="main" tabindex="-1"><div id="flash" aria-live="polite"></div>${body}</main>
<footer class="muted">เทศบาลนครตัวอย่าง (หน่วยงานสมมติ) · ระบบจำลองเพื่อการทดสอบ</footer>
<script>${APP_JS}</script><script>${script}</script></body></html>`;
    res.status(status).type('text/html; charset=utf-8').send(html);
  }

  function renderForbidden(req, res) {
    render(req, res, { status: 403, title: 'ไม่มีสิทธิ์',
      body: '<h1>ไม่มีสิทธิ์</h1><p data-testid="forbidden-msg">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>' });
  }

  function renderCaseNotFound(req, res) {
    render(req, res, { status: 404, title: 'ไม่พบข้อมูล',
      body: '<h1>ไม่พบข้อมูล</h1><p data-testid="not-found-msg">ไม่พบคำขอ</p>' });
  }

  return { render, renderForbidden, renderCaseNotFound };
}

module.exports = { makeLayout, esc, CSS, APP_JS };
