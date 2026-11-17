'use strict';

module.exports = function register(app, ctx) {
  const QR_MS = 15 * 60 * 1000;

  // จุดฝัง BUG_MODE B05: อายุ 15:00 พอดียังจ่ายได้
  function qrUsable(p, now) {
    const age = now.getTime() - Date.parse(p.qr_created_at);
    return ctx.bug('B05') ? age <= QR_MS : age < QR_MS;
  }

  app.post('/api/drafts/:id/payment', ctx.requireApi('citizen'), (req, res) => {
    const out = ctx.tx(() => {
      const row = ctx.db.prepare('SELECT * FROM cases WHERE draft_id = ? AND applicant_id = ?')
        .get(req.params.id, req.user.id);
      if (!row) return { err: ['NOT_FOUND'] };
      if (row.status !== 'DRAFT' && row.status !== 'PENDING_PAYMENT') return { err: ['INVALID_STATE'] };
      const docKeys = ctx.db.prepare('SELECT doc_key FROM files WHERE case_id = ?').all(row.id).map((r) => r.doc_key);
      const missing = ctx.rules.missingDocs(row.service_id, docKeys);
      if (missing.length) {
        return { err: ['MISSING_DOCS', { missing, message: 'ยังขาดเอกสาร: ' + missing.join(', ') }] };
      }
      const now = ctx.clock.now();
      const nowIso = ctx.clock.nowIso();
      let fee = row.fee;
      if (row.status === 'DRAFT') {
        const r = ctx.rules.calcFee(row.service_id, { qty: row.qty, areaSqm: row.area_sqm }, ctx.getService(row.service_id));
        if (!r.ok) return { err: [r.code] };
        fee = r.fee;
        ctx.db.prepare("UPDATE cases SET fee = ?, status = 'PENDING_PAYMENT', fee_locked_at = ?, updated_at = ? WHERE id = ?")
          .run(fee, nowIso, nowIso, row.id);
      } else {
        ctx.db.prepare("UPDATE payments SET status = 'SUPERSEDED' WHERE case_id = ? AND status = 'PENDING'").run(row.id);
      }
      const ref = ctx.rules.fmtPayRef(ctx.nextCounter('PP'));
      const expires = ctx.clock.toIso(now.getTime() + QR_MS);
      ctx.db.prepare("INSERT INTO payments(ref, case_id, amount, status, qr_created_at, qr_expires_at, paid_at) VALUES(?,?,?,'PENDING',?,?,NULL)")
        .run(ref, row.id, fee, nowIso, expires);
      return { body: { ref, amount: fee, qrCreatedAt: nowIso, qrExpiresAt: expires } };
    });
    if (out.err) return ctx.fail(res, out.err[0], out.err[1]);
    return res.status(201).json(out.body);
  });

  app.get('/api/payments/:ref', ctx.requireApi('citizen'), (req, res) => {
    const p = ctx.db.prepare(
      'SELECT p.*, c.case_no, c.receipt_no FROM payments p JOIN cases c ON c.id = p.case_id WHERE p.ref = ? AND c.applicant_id = ?'
    ).get(req.params.ref, req.user.id);
    if (!p) return ctx.fail(res, 'NOT_FOUND');
    let status;
    if (p.status === 'PAID') status = 'PAID';
    else if (p.status === 'PENDING' && qrUsable(p, ctx.clock.now())) status = 'PENDING';
    else status = 'EXPIRED';
    const paid = status === 'PAID';
    res.json({
      ref: p.ref, amount: p.amount, status,
      qrCreatedAt: p.qr_created_at, qrExpiresAt: p.qr_expires_at,
      caseNo: paid ? p.case_no : null, receiptNo: paid ? p.receipt_no : null, paidAt: paid ? p.paid_at : null,
    });
  });

  app.post('/api/test/payments/:ref/pay', (req, res) => {
    const amount = req.body && req.body.amount;
    const out = ctx.tx(() => {
      const p = ctx.db.prepare('SELECT * FROM payments WHERE ref = ?').get(req.params.ref);
      if (!p) return { err: 'NOT_FOUND' };
      const row = ctx.db.prepare('SELECT * FROM cases WHERE id = ?').get(p.case_id);
      if (!row) return { err: 'NOT_FOUND' };
      if (p.status === 'PAID') {
        return { body: { status: 'PAID', caseNo: row.case_no, receiptNo: row.receipt_no, duplicate: true } };
      }
      const now = ctx.clock.now();
      if (p.status === 'SUPERSEDED' || !qrUsable(p, now)) return { err: 'QR_EXPIRED' };
      if (row.status !== 'PENDING_PAYMENT') return { err: 'INVALID_STATE' };
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount !== p.amount) return { err: 'AMOUNT_MISMATCH' };

      const nowIso = ctx.clock.nowIso();
      const be = ctx.rules.beYear(now);
      const seq = ctx.nextCounter('EG-' + be);
      const caseNo = ctx.rules.fmtCaseNo(be, seq);
      const receiptNo = ctx.rules.fmtReceiptNo(be, seq);
      const svc = ctx.getService(row.service_id);
      const dueAt = ctx.rules.computeDueAt(now, svc.sla, ctx.holidays());
      ctx.db.prepare(
        "UPDATE cases SET case_no = ?, receipt_no = ?, status = 'SUBMITTED', paid_at = ?, due_at = ?, current_dept = 'registry', step = ?, visited_depts = 'registry', owner = NULL, updated_at = ? WHERE id = ?"
      ).run(caseNo, receiptNo, nowIso, dueAt, row.service_id === 'SV-03' ? 1 : null, nowIso, row.id);
      ctx.db.prepare("UPDATE payments SET status = 'PAID', paid_at = ? WHERE ref = ?").run(nowIso, p.ref);
      ctx.caseEvent(row.id, 'PAID', 'ชำระเงินสำเร็จ ได้รับเลขคำขอ');
      return { body: { status: 'PAID', caseNo, receiptNo, duplicate: false } };
    });
    if (out.err) return ctx.fail(res, out.err);
    return res.json(out.body);
  });
};
