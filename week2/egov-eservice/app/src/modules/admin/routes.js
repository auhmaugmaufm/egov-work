'use strict';
// B10 · ผู้ดูแลระบบ: บริการ (ค่าธรรมเนียม · SLA) · วันหยุด · ผู้ใช้/บทบาท
// ทุก API ต้องเป็นบทบาท admin · ทุกการแก้ที่เปลี่ยนค่าจริงบันทึก ADMIN_CHANGE (1 แถวต่อฟิลด์)

const ARROW = ' → '; // U+2192 มีช่องว่างสองข้าง
const ROLES = ['officer', 'head', 'executive', 'auditor', 'admin'];
const DEPTS = ['registry', 'works'];

function isValidFee(v) {
  return Number.isInteger(v) && v >= 0 && v <= 100000;
}

function isValidSla(v) {
  return Number.isInteger(v) && v >= 1 && v <= 60;
}

function isRealDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function serviceRow(s) {
  return { id: s.id, fee: s.fee, feePerSqm: s.fee_per_sqm ?? null, sla: s.sla };
}

module.exports = function register(app, ctx) {
  const admin = ctx.requireApi('admin');
  const hasField = (b, k) => Object.prototype.hasOwnProperty.call(b, k) && b[k] !== undefined;

  // ---------- บริการ ----------
  app.get('/api/admin/services', admin, (req, res) => {
    const rows = ctx.db.prepare('SELECT id, fee, fee_per_sqm, sla FROM services ORDER BY id').all();
    res.status(200).json({ items: rows.map(serviceRow) });
  });

  app.put('/api/admin/services/:id', admin, (req, res) => {
    const body = req.body || {};
    const svc = ctx.getService(req.params.id);
    if (!svc) return ctx.fail(res, 'NOT_FOUND', { message: 'ไม่พบบริการนี้' });

    // SV-03 รับ feeBase (หรือ fee เป็นชื่อแทน) · SV-01/02 รับ fee · feePerSqm เฉพาะ SV-03
    const isSv03 = svc.id === 'SV-03';
    const feeName = isSv03 && hasField(body, 'feeBase') ? 'feeBase' : 'fee';
    const hasFee = hasField(body, feeName);
    const feeVal = body[feeName];
    const hasPerSqm = isSv03 && hasField(body, 'feePerSqm');
    const hasSla = hasField(body, 'sla');

    if (!hasFee && !hasPerSqm && !hasSla) return ctx.fail(res, 'BAD_REQUEST');

    // ตรวจค่าธรรมเนียมทุกฟิลด์ที่ส่งก่อน (ผิดข้อใดข้อหนึ่ง = ไม่แก้อะไรเลย)
    if (hasFee && !isValidFee(feeVal)) return ctx.fail(res, 'INVALID_FEE');
    if (hasPerSqm && !isValidFee(body.feePerSqm)) return ctx.fail(res, 'INVALID_FEE');
    if (hasSla && !isValidSla(body.sla)) return ctx.fail(res, 'INVALID_SLA');

    const updated = ctx.tx(() => {
      const sets = [];
      const vals = [];
      const details = [];
      const actor = req.user;

      if (hasFee && feeVal !== svc.fee) {
        sets.push('fee = ?');
        vals.push(feeVal);
        const label = isSv03 ? 'feeBase' : 'fee';
        details.push(`${svc.id} ${label} ${svc.fee}${ARROW}${feeVal}`);
      }
      if (hasPerSqm && body.feePerSqm !== svc.fee_per_sqm) {
        sets.push('fee_per_sqm = ?');
        vals.push(body.feePerSqm);
        details.push(`${svc.id} feePerSqm ${svc.fee_per_sqm}${ARROW}${body.feePerSqm}`);
      }
      if (hasSla && body.sla !== svc.sla) {
        sets.push('sla = ?');
        vals.push(body.sla);
        details.push(`${svc.id} sla ${svc.sla}${ARROW}${body.sla}`);
      }

      if (sets.length) {
        ctx.db.prepare(`UPDATE services SET ${sets.join(', ')} WHERE id = ?`).run(...vals, svc.id);
      }
      for (const detail of details) {
        ctx.audit(actor, { event: 'ADMIN_CHANGE', detail });
      }
      return ctx.db.prepare('SELECT id, fee, fee_per_sqm, sla FROM services WHERE id = ?').get(svc.id);
    });

    res.status(200).json(serviceRow(updated));
  });

  // ---------- วันหยุด ----------
  app.get('/api/admin/holidays', admin, (req, res) => {
    const rows = ctx.db.prepare('SELECT date, name FROM holidays ORDER BY date ASC').all();
    res.status(200).json({ items: rows.map((r) => ({ date: r.date, name: r.name })) });
  });

  app.post('/api/admin/holidays', admin, (req, res) => {
    const body = req.body || {};
    const date = body.date;
    if (!isRealDate(date)) return ctx.fail(res, 'INVALID_DATE');

    const rawName = typeof body.name === 'string' ? body.name.trim() : '';
    const name = rawName || 'วันหยุด';

    const result = ctx.tx(() => {
      const exists = ctx.db.prepare('SELECT date FROM holidays WHERE date = ?').get(date);
      if (exists) return { duplicate: true };
      ctx.db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?)').run(date, name);
      ctx.audit(req.user, { event: 'ADMIN_CHANGE', detail: `holiday add ${date}` });
      return { duplicate: false };
    });

    if (result.duplicate) return ctx.fail(res, 'DUPLICATE_HOLIDAY');
    res.status(201).json({ date, name });
  });

  app.delete('/api/admin/holidays/:date', admin, (req, res) => {
    const date = req.params.date;
    const found = ctx.tx(() => {
      const exists = ctx.db.prepare('SELECT date FROM holidays WHERE date = ?').get(date);
      if (!exists) return false;
      ctx.db.prepare('DELETE FROM holidays WHERE date = ?').run(date);
      ctx.audit(req.user, { event: 'ADMIN_CHANGE', detail: `holiday delete ${date}` });
      return true;
    });

    if (!found) return ctx.fail(res, 'NOT_FOUND', { message: 'ไม่พบวันหยุดนี้' });
    res.status(200).json({ ok: true });
  });

  // ---------- ผู้ใช้ / บทบาท ----------
  app.get('/api/admin/users', admin, (req, res) => {
    const rows = ctx.db
      .prepare("SELECT username, name, role, dept FROM users WHERE kind = 'staff' ORDER BY id")
      .all();
    res.status(200).json({
      items: rows.map((r) => ({ username: r.username, name: r.name, role: r.role, dept: r.dept ?? null })),
    });
  });

  app.put('/api/admin/users/:username', admin, (req, res) => {
    const body = req.body || {};
    const username = req.params.username;
    const user = ctx.db
      .prepare("SELECT id, username, role, dept FROM users WHERE kind = 'staff' AND username = ?")
      .get(username);
    if (!user) return ctx.fail(res, 'NOT_FOUND', { message: 'ไม่พบผู้ใช้' });

    if (username === req.user.username) return ctx.fail(res, 'SELF_ROLE_CHANGE');

    const newRole = body.role;
    if (!ROLES.includes(newRole)) return ctx.fail(res, 'INVALID_ROLE');

    let newDept = null;
    if (newRole === 'officer') {
      if (!DEPTS.includes(body.dept)) return ctx.fail(res, 'INVALID_DEPT');
      newDept = body.dept;
    }

    const result = ctx.tx(() => {
      const actor = req.user;
      const details = [];
      if (user.role !== newRole) {
        details.push(`${user.username} role ${user.role}${ARROW}${newRole}`);
      }
      const oldDept = user.dept ?? null;
      if (oldDept !== newDept) {
        details.push(`${user.username} dept ${oldDept ?? '-'}${ARROW}${newDept ?? '-'}`);
      }
      if (details.length) {
        ctx.db.prepare('UPDATE users SET role = ?, dept = ? WHERE id = ?').run(newRole, newDept, user.id);
        for (const detail of details) {
          ctx.audit(actor, { event: 'ADMIN_CHANGE', detail });
        }
      }
      return ctx.db.prepare('SELECT username, role, dept FROM users WHERE id = ?').get(user.id);
    });

    res.status(200).json({ username: result.username, role: result.role, dept: result.dept ?? null });
  });

  require('./pages')(app, ctx);
};
