'use strict';
// B07 · hook ทุก request: 4.1 ยกเลิกอัตโนมัติ · 4.2 แจ้งเตือน SLA
function runHooks(ctx) {
  ctx.tx(() => {
    const now = ctx.clock.now();
    const nowIso = ctx.clock.nowIso();
    // 4.1
    const exp = ctx.db.prepare("SELECT id, fix_deadline FROM cases WHERE status='NEED_FIX' AND fix_deadline IS NOT NULL").all();
    for (const r of exp) {
      if (now.getTime() >= Date.parse(r.fix_deadline)) {
        ctx.db.prepare("UPDATE cases SET status='CANCELLED', cancelled_at=?, cancel_reason='FIX_EXPIRED', updated_at=? WHERE id=?")
          .run(r.fix_deadline, nowIso, r.id);
        ctx.caseEvent(r.id, 'AUTO_CANCEL', 'ระบบยกเลิกอัตโนมัติ (เลยเวลาแก้ไข 168 ชั่วโมง)', r.fix_deadline);
      }
    }
    // 4.2
    const hol = ctx.holidays();
    const staff = ctx.db.prepare("SELECT username, role, dept FROM users WHERE kind='staff'").all();
    const heads = staff.filter((s) => s.role === 'head').map((s) => s.username);
    const officersOf = (d) => staff.filter((s) => s.role === 'officer' && s.dept === d).map((s) => s.username);
    const cases = ctx.db.prepare(`SELECT id, case_no, status, current_dept, owner, issuer, due_at FROM cases
      WHERE status IN ('SUBMITTED','IN_REVIEW','PENDING_APPROVAL','APPROVED') AND due_at IS NOT NULL`).all();
    const ins = ctx.db.prepare('INSERT OR IGNORE INTO notifications(username, case_id, case_no, level, text, created_at) VALUES (?,?,?,?,?,?)');
    for (const c of cases) {
      const level = ctx.rules.slaLevel(c, now, hol);
      if (level !== 'near' && level !== 'overdue') continue;
      let to;
      if (c.status === 'PENDING_APPROVAL') to = heads.slice();
      else if (c.status === 'APPROVED') to = c.issuer ? [c.issuer] : officersOf('registry');
      else if (c.owner) to = [c.owner];
      else to = officersOf(c.current_dept);
      if (level === 'overdue') for (const h of heads) if (!to.includes(h)) to.push(h);
      const text = 'คำขอ ' + c.case_no + ' ' + (level === 'near' ? 'ใกล้ครบกำหนด' : 'เกินกำหนด');
      for (const u of to) ins.run(u, c.id, c.case_no, level, text, nowIso);
    }
  });
}
function install(ctx) { ctx.onRequest(() => runHooks(ctx)); }
module.exports = { install, runHooks };
