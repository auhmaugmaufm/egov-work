'use strict';
// B08 · ออกเอกสาร HMAC + /verify + PDPA + Audit Trail (อ่านอย่างเดียว)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

module.exports = function register(app, ctx) {
  const rules = () => ctx.rules;

  // ---------- helpers ----------
  function verifyDoc(code) {
    const doc = ctx.db.prepare('SELECT * FROM documents WHERE verify_code = ?').get(String(code));
    if (!doc) return { result: 'NOT_FOUND' };
    const sig = ctx.crypto.hmacDoc([doc.doc_no, doc.case_no, doc.applicant, doc.service_id, doc.issued_at, doc.valid_until, doc.signer]);
    if (sig !== doc.signature) return { result: 'TAMPERED' };
    const result = rules().isDocExpired(doc.valid_until, ctx.clock.now()) ? 'EXPIRED' : 'VALID';
    return { result, doc };
  }

  // คืน {where, params, errors:{from,to}} · วันที่ผิดรูปแบบ → ไม่ใช้ตัวกรอง + errors
  function auditFilter(q) {
    const where = []; const params = []; const bad = [];
    const actor = String(q.actor ?? '').trim();
    const event = String(q.event ?? '').trim();
    if (actor) { where.push('username = ?'); params.push(actor); }
    if (event) { where.push('event = ?'); params.push(event); }
    const from = String(q.from ?? '').trim();
    const to = String(q.to ?? '').trim();
    if (from) { if (DATE_RE.test(from)) { where.push('time >= ?'); params.push(from + 'T00:00:00+07:00'); } else bad.push('from'); }
    if (to) { if (DATE_RE.test(to)) { where.push('time <= ?'); params.push(to + 'T23:59:59+07:00'); } else bad.push('to'); }
    return { where, params, bad };
  }
  function auditRows(f) {
    const sql = 'SELECT * FROM audit_log' + (f.where.length ? ' WHERE ' + f.where.join(' AND ') : '') + ' ORDER BY time DESC, id DESC';
    return ctx.db.prepare(sql).all(...f.params);
  }

  require('./pages')(app, ctx, { verifyDoc, auditFilter, auditRows });

  // ---------- 405 ของ /api/audit (ก่อน GET · ก่อนสิทธิ์) ----------
  const notAllowed = (req, res) => {
    res.set('Allow', 'GET');
    return ctx.fail(res, 'METHOD_NOT_ALLOWED');
  };
  for (const m of ['put', 'patch', 'delete', 'post']) {
    app[m]('/api/audit', notAllowed);
    app[m]('/api/audit/:id', notAllowed);
  }

  // ---------- คิว (B09) ----------
  app.get('/api/officer/queue', ctx.requireApi('officer', 'head'), (req, res) => {
    const rows = ctx.db.prepare(`SELECT c.*, u.name AS applicant_name, u.id_enc FROM cases c
      JOIN users u ON u.id = c.applicant_id WHERE c.case_no IS NOT NULL`).all();
    const now = ctx.clock.now(); const hol = ctx.holidays();
    const filter = ['all', 'unclaimed', 'mine'].includes(req.query.filter) ? req.query.filter : 'all';
    const items = rules().selectQueue(rows, req.user, filter).map((r) => {
      const idNo = ctx.crypto.decrypt(r.id_enc);
      const item = { caseNo: r.case_no, serviceId: r.service_id, applicantName: r.applicant_name, idMasked: rules().maskId(idNo),
        status: r.status, step: r.step, owner: r.owner, dueAt: r.due_at, slaLevel: rules().slaLevel(r, now, hol) };
      if (ctx.bug('B09')) item.idNo = idNo;
      return item;
    });
    res.json({ items });
  });

  // ---------- unmask (B11) ----------
  app.post('/api/officer/cases/:caseNo/unmask', ctx.requireApi('officer', 'head'), (req, res) => {
    const row = ctx.db.prepare(`SELECT c.case_no, u.id_enc FROM cases c JOIN users u ON u.id = c.applicant_id WHERE c.case_no = ?`).get(req.params.caseNo);
    if (!row) return ctx.fail(res, 'NOT_FOUND');
    const reason = String((req.body || {}).reason ?? '').trim();
    if (reason === '') return ctx.fail(res, 'REASON_REQUIRED');
    const idNo = ctx.crypto.decrypt(row.id_enc);
    if (!ctx.bug('B11')) ctx.audit(req.user, { event: 'UNMASK', caseNo: row.case_no, detail: reason });
    return res.json({ idNo });
  });

  // ---------- ออกเอกสาร ----------
  app.post('/api/officer/cases/:caseNo/issue', ctx.requireApi('officer', 'head'), (req, res) => {
    if (req.user.role !== 'officer') return ctx.fail(res, 'FORBIDDEN');
    const out = ctx.tx(() => {
      const c = ctx.db.prepare('SELECT * FROM cases WHERE case_no = ?').get(req.params.caseNo);
      if (!c) return { err: 'NOT_FOUND' };
      if (c.issuer !== req.user.username) return { err: 'FORBIDDEN' };
      if (c.status !== 'APPROVED') return { err: 'INVALID_STATE' };
      const now = ctx.clock.now(); const nowIso = ctx.clock.nowIso();
      const be = rules().beYear(now);
      const docNo = rules().fmtDocNo(be, ctx.nextCounter('DOC-' + be));
      let verifyCode;
      do { verifyCode = ctx.crypto.randomCode8(); }
      while (ctx.db.prepare('SELECT 1 FROM documents WHERE verify_code = ?').get(verifyCode));
      const applicant = ctx.db.prepare('SELECT name FROM users WHERE id = ?').get(c.applicant_id).name;
      const validUntil = rules().docValidUntil(c.service_id, nowIso);
      const s = ctx.db.prepare('SELECT name FROM users WHERE username = ?').get(c.approved_by);
      const signer = s ? s.name : String(c.approved_by ?? '');
      const signature = ctx.crypto.hmacDoc([docNo, c.case_no, applicant, c.service_id, nowIso, validUntil, signer]);
      ctx.db.prepare(`INSERT INTO documents(doc_no, case_id, case_no, verify_code, applicant, service_id, issued_at, valid_until, signer, signature, issued_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(docNo, c.id, c.case_no, verifyCode, applicant, c.service_id, nowIso, validUntil, signer, signature, req.user.username);
      ctx.db.prepare(`UPDATE cases SET status='COMPLETED', closed_at=?, owner=NULL, updated_at=? WHERE id = ?`).run(nowIso, nowIso, c.id);
      ctx.caseEvent(c.id, 'ISSUE', 'ออกเอกสารดิจิทัลแล้ว (เสร็จสิ้น)');
      ctx.audit(req.user, { event: 'ISSUE', caseNo: c.case_no, fromStatus: 'APPROVED', toStatus: 'COMPLETED', detail: docNo });
      return { docNo, verifyCode, status: 'COMPLETED' };
    });
    if (out.err) return ctx.fail(res, out.err);
    return res.json(out);
  });

  // ---------- PDF ----------
  app.get('/api/documents/:docNo/pdf', ctx.requireApi(), (req, res) => {
    const d = ctx.db.prepare('SELECT d.*, c.applicant_id, c.approved_by FROM documents d JOIN cases c ON c.id = d.case_id WHERE d.doc_no = ?').get(req.params.docNo);
    const u = req.user;
    const ok = d && ((u.role === 'citizen' && d.applicant_id === u.id) || u.role === 'officer' || u.role === 'head');
    if (!ok) return ctx.fail(res, 'NOT_FOUND');
    const buf = ctx.pdf.makeSimplePdf([
      'e-Service (simulated municipality) - Digital document',
      `docNo=${d.doc_no} caseNo=${d.case_no} verify=${d.verify_code} validUntil=${d.valid_until}`,
      `service=${d.service_id} issuedAt=${d.issued_at} signer=${d.approved_by ?? ''}`,
      `verifyUrl=${ctx.baseUrl(req)}/verify/${d.verify_code}`,
    ]);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${d.doc_no}.pdf"`);
    return res.status(200).send(buf);
  });

  // ---------- verify API ----------
  app.get('/api/verify/:code', (req, res) => {
    const v = verifyDoc(req.params.code);
    if (v.result === 'NOT_FOUND') return res.status(404).json({ result: 'NOT_FOUND' });
    if (v.result === 'TAMPERED') return res.status(200).json({ result: 'TAMPERED' });
    const d = v.doc;
    return res.status(200).json({ result: v.result, docNo: d.doc_no, applicantMasked: rules().maskName(d.applicant),
      serviceId: d.service_id, issuedAt: d.issued_at, validUntil: d.valid_until, signer: d.signer });
  });

  // ---------- tamper (TEST_MODE · guard ของ B01) ----------
  app.post('/api/test/documents/:docNo/tamper', (req, res) => {
    const r = ctx.db.prepare("UPDATE documents SET applicant = applicant || ' (แก้ไข)' WHERE doc_no = ?").run(req.params.docNo);
    if (!r.changes) return ctx.fail(res, 'NOT_FOUND');
    return res.json({ ok: true });
  });

  // ---------- Audit API ----------
  app.get('/api/audit', ctx.requireApi('auditor'), (req, res) => {
    const f = auditFilter(req.query);
    if (f.bad.length) return ctx.fail(res, 'INVALID_DATE');
    const items = auditRows(f).map((r) => ({ id: r.id, time: r.time, username: r.username, role: r.role, event: r.event,
      caseNo: r.case_no, fromStatus: r.from_status, toStatus: r.to_status, detail: r.detail }));
    res.json({ count: items.length, items });
  });

  app.get('/api/audit/export.csv', ctx.requireApi('auditor'), (req, res) => {
    const f = auditFilter(req.query);
    if (f.bad.length) return ctx.fail(res, 'INVALID_DATE');
    const cell = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    let csv = 'time,username,role,event,caseNo,fromStatus,toStatus,detail\n';
    for (const r of auditRows(f)) {
      csv += [r.time, r.username, r.role, r.event, r.case_no, r.from_status, r.to_status, r.detail].map(cell).join(',') + '\n';
    }
    ctx.audit(req.user, { event: 'EXPORT', detail: 'audit-csv' });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="audit.csv"');
    return res.status(200).send(csv);
  });
};
