'use strict';
// B07 · Workflow API
module.exports = function register(app, ctx) {
  const db = ctx.db;
  const getCase = (no) => db.prepare('SELECT * FROM cases WHERE case_no = ?').get(no);
  const workload = (u) => db.prepare("SELECT COUNT(*) AS n FROM cases WHERE status='IN_REVIEW' AND owner=?").get(u).n;
  const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

  app.post('/api/officer/cases/:caseNo/claim', ctx.requireApi('officer'), (req, res) => {
    ctx.tx(() => {
      const row = getCase(req.params.caseNo);
      if (!row) return ctx.fail(res, 'NOT_FOUND');
      if (row.current_dept !== req.user.dept) return ctx.fail(res, 'FORBIDDEN');
      if (!['SUBMITTED', 'IN_REVIEW'].includes(row.status)) return ctx.fail(res, 'INVALID_STATE');
      if (row.owner && !ctx.bug('B08')) return ctx.fail(res, 'ALREADY_CLAIMED');
      if (workload(req.user.username) >= 10) return ctx.fail(res, 'WORKLOAD_LIMIT');
      const me = req.user.username;
      const issuer = row.service_id !== 'SV-01' && row.current_dept === 'registry' ? me : row.issuer;
      db.prepare("UPDATE cases SET owner=?, status='IN_REVIEW', issuer=?, updated_at=? WHERE id=?")
        .run(me, issuer, ctx.clock.nowIso(), row.id);
      ctx.caseEvent(row.id, 'CLAIM', `เจ้าหน้าที่รับเรื่อง (${me})`);
      ctx.audit(req.user, { event: 'CLAIM', caseNo: row.case_no, fromStatus: row.status, toStatus: 'IN_REVIEW', detail: '' });
      res.json({ owner: me });
    });
  });

  app.post('/api/officer/cases/:caseNo/return', ctx.requireApi('officer'), (req, res) => {
    ctx.tx(() => {
      const row = getCase(req.params.caseNo);
      if (!row) return ctx.fail(res, 'NOT_FOUND');
      if (row.owner !== req.user.username) return ctx.fail(res, 'FORBIDDEN');
      if (row.status !== 'IN_REVIEW') return ctx.fail(res, 'INVALID_STATE');
      if (!ctx.bug('B12') && row.return_count >= 2) return ctx.fail(res, 'RETURN_LIMIT');
      const raw = body(req).reason;
      if (!ctx.rules.reasonOk(raw)) return ctx.fail(res, 'REASON_TOO_SHORT');
      const reason = String(raw).trim();
      const nowIso = ctx.clock.nowIso();
      const cnt = row.return_count + 1;
      db.prepare("UPDATE cases SET status='NEED_FIX', return_count=?, returned_at=?, return_reason=?, fix_deadline=?, updated_at=? WHERE id=?")
        .run(cnt, nowIso, reason, ctx.rules.fixDeadline(nowIso), nowIso, row.id);
      ctx.caseEvent(row.id, 'RETURN', 'ตีกลับให้แก้ไข: ' + reason);
      ctx.audit(req.user, { event: 'RETURN', caseNo: row.case_no, fromStatus: 'IN_REVIEW', toStatus: 'NEED_FIX', detail: reason });
      res.json({ status: 'NEED_FIX', returnCount: cnt });
    });
  });

  app.post('/api/officer/cases/:caseNo/forward', ctx.requireApi('officer'), (req, res) => {
    ctx.tx(() => {
      const row = getCase(req.params.caseNo);
      if (!row) return ctx.fail(res, 'NOT_FOUND');
      if (row.owner !== req.user.username) return ctx.fail(res, 'FORBIDDEN');
      if (row.status !== 'IN_REVIEW') return ctx.fail(res, 'INVALID_STATE');
      if (row.service_id === 'SV-01') return ctx.fail(res, 'INVALID_STATE');
      const n = body(req).note;
      const note = typeof n === 'string' ? n.trim() : '';
      const nowIso = ctx.clock.nowIso();
      let out, text, to;
      if (row.service_id === 'SV-02' || row.step === 3) {
        db.prepare("UPDATE cases SET status='PENDING_APPROVAL', current_dept='head', owner=NULL, updated_at=? WHERE id=?").run(nowIso, row.id);
        out = { status: 'PENDING_APPROVAL', step: row.service_id === 'SV-02' ? null : 3 };
        text = 'ส่งต่อไปหัวหน้าฝ่าย'; to = 'PENDING_APPROVAL';
      } else if (row.step === 2) {
        db.prepare("UPDATE cases SET step=3, status='PENDING_APPROVAL', current_dept='head', owner=NULL, updated_at=? WHERE id=?").run(nowIso, row.id);
        out = { status: 'PENDING_APPROVAL', step: 3 };
        text = 'ส่งต่อไปหัวหน้าฝ่าย'; to = 'PENDING_APPROVAL';
      } else {
        db.prepare("UPDATE cases SET step=2, current_dept='works', owner=NULL, visited_depts='registry,works', updated_at=? WHERE id=?").run(nowIso, row.id);
        out = { status: 'IN_REVIEW', step: 2 };
        text = 'ส่งต่อไปฝ่ายโยธา'; to = 'IN_REVIEW';
      }
      ctx.caseEvent(row.id, 'FORWARD', text);
      ctx.audit(req.user, { event: 'FORWARD', caseNo: row.case_no, fromStatus: 'IN_REVIEW', toStatus: to, detail: note });
      res.json(out);
    });
  });

  // approve / reject
  function decision(kind) {
    return (req, res) => {
      ctx.tx(() => {
        const row = getCase(req.params.caseNo);
        if (!row) return ctx.fail(res, 'NOT_FOUND');
        const sv01 = row.service_id === 'SV-01';
        if (sv01) {
          if (!(req.user.role === 'officer' && row.owner === req.user.username)) return ctx.fail(res, 'FORBIDDEN');
        } else if (req.user.role !== 'head' && !(kind === 'approve' && ctx.bug('B07'))) return ctx.fail(res, 'FORBIDDEN');
        if (row.status !== (sv01 ? 'IN_REVIEW' : 'PENDING_APPROVAL')) return ctx.fail(res, 'INVALID_STATE');
        const nowIso = ctx.clock.nowIso();
        const me = req.user.username;
        if (kind === 'approve') {
          db.prepare("UPDATE cases SET status='APPROVED', approved_by=?, approved_at=?, owner=NULL, current_dept='registry', issuer=?, updated_at=? WHERE id=?")
            .run(me, nowIso, sv01 ? me : row.issuer, nowIso, row.id);
          ctx.caseEvent(row.id, 'APPROVE', 'อนุมัติแล้ว');
          ctx.audit(req.user, { event: 'APPROVE', caseNo: row.case_no, fromStatus: row.status, toStatus: 'APPROVED', detail: '' });
          return res.json({ status: 'APPROVED' });
        }
        const raw = body(req).reason;
        if (!ctx.rules.reasonOk(raw)) return ctx.fail(res, 'REASON_TOO_SHORT');
        const reason = String(raw).trim();
        db.prepare("UPDATE cases SET status='REJECTED', closed_at=?, reject_reason=?, owner=NULL, updated_at=? WHERE id=?")
          .run(nowIso, reason, nowIso, row.id);
        ctx.caseEvent(row.id, 'REJECT', 'ไม่อนุมัติ: ' + reason);
        ctx.audit(req.user, { event: 'REJECT', caseNo: row.case_no, fromStatus: row.status, toStatus: 'REJECTED', detail: reason });
        res.json({ status: 'REJECTED', closedAt: nowIso });
      });
    };
  }
  app.post('/api/cases/:caseNo/approve', ctx.requireApi('officer', 'head'), decision('approve'));
  app.post('/api/cases/:caseNo/reject', ctx.requireApi('officer', 'head'), decision('reject'));

  app.post('/api/cases/:caseNo/resubmit', ctx.requireApi('citizen'), ctx.multipartArray('file', 5), (req, res) => {
    ctx.tx(() => {
      const row = getCase(req.params.caseNo);
      if (!row || row.applicant_id !== req.user.id) return ctx.fail(res, 'NOT_FOUND');
      if (row.status === 'CANCELLED' && row.cancel_reason === 'FIX_EXPIRED') return ctx.fail(res, 'FIX_WINDOW_EXPIRED');
      if (row.status !== 'NEED_FIX') return ctx.fail(res, 'INVALID_STATE');
      const now = ctx.clock.now();
      const nowIso = ctx.clock.nowIso();
      if (row.fix_deadline && now.getTime() >= Date.parse(row.fix_deadline)) {
        db.prepare("UPDATE cases SET status='CANCELLED', cancelled_at=?, cancel_reason='FIX_EXPIRED', updated_at=? WHERE id=?")
          .run(row.fix_deadline, nowIso, row.id);
        ctx.caseEvent(row.id, 'AUTO_CANCEL', 'ระบบยกเลิกอัตโนมัติ (เลยเวลาแก้ไข 168 ชั่วโมง)', row.fix_deadline);
        return ctx.fail(res, 'FIX_WINDOW_EXPIRED');
      }
      const files = req.files || [];
      const existing = db.prepare('SELECT COUNT(*) AS n FROM files WHERE case_id=?').get(row.id).n;
      if (existing + files.length > ctx.rules.MAX_FILES) return ctx.fail(res, 'FILE_COUNT');
      for (const f of files) if (f.size > ctx.rules.MAX_FILE_BYTES) return ctx.fail(res, 'FILE_TOO_LARGE');
      const types = [];
      for (const f of files) {
        const t = ctx.rules.detectFileType(f.buffer);
        if (!t) return ctx.fail(res, 'FILE_TYPE');
        types.push(t);
      }
      files.forEach((f, i) => {
        db.prepare("INSERT INTO files(id, case_id, doc_key, name, mime, size, data, uploaded_at) VALUES (?,?,'extra',?,?,?,?,?)")
          .run('f' + ctx.crypto.randomLetters(15), row.id, f.originalname, ctx.rules.MIME[types[i]], f.size, f.buffer, nowIso);
      });
      const due = ctx.rules.extendDueForPause(row.due_at, row.returned_at, nowIso, ctx.holidays());
      db.prepare("UPDATE cases SET due_at=?, status='IN_REVIEW', fix_deadline=NULL, updated_at=? WHERE id=?").run(due, nowIso, row.id);
      ctx.caseEvent(row.id, 'RESUBMIT', 'ผู้ยื่นส่งแก้ไขแล้ว');
      res.json({ status: 'IN_REVIEW', dueAt: due });
    });
  });

  app.get('/api/notifications', ctx.requireApi('officer', 'head'), (req, res) => {
    const items = db.prepare('SELECT id, case_no, level, text, created_at FROM notifications WHERE username=? ORDER BY created_at DESC, id DESC')
      .all(req.user.username)
      .map((r) => ({ id: r.id, caseNo: r.case_no, level: r.level, text: r.text, createdAt: r.created_at }));
    res.json({ items });
  });

  require('./hooks').install(ctx);
  require('./pages').install(app, ctx);
};
