'use strict';
const { validateUpload } = require('./upload');
const pages = require('./pages');

const SERVICES = ['SV-01', 'SV-02', 'SV-03'];

// จุด B06: ประชาชนเปิดคำขอของคนอื่นได้เมื่อเปิดบั๊ก
function loadCaseForCitizen(ctx, user, caseNo) {
  const row = ctx.db.prepare(
    `SELECT c.*, u.name AS applicant_name, u.id_enc FROM cases c JOIN users u ON u.id = c.applicant_id WHERE c.case_no = ?`
  ).get(caseNo);
  if (!row) return null;
  if (row.applicant_id !== user.id && !ctx.bug('B06')) return null;
  return row;
}

module.exports = function register(app, ctx) {
  const db = () => ctx.db;
  const OPEN = ['DRAFT', 'PENDING_PAYMENT'];

  const myDraft = (user, id) => db().prepare('SELECT * FROM cases WHERE draft_id = ? AND applicant_id = ?').get(id, user.id);
  const draftFee = (row) => {
    if (row.status !== 'DRAFT') return row.fee;
    const r = ctx.rules.calcFee(row.service_id, { qty: row.qty, areaSqm: row.area_sqm }, ctx.getService(row.service_id));
    return r.ok ? r.fee : row.fee;
  };
  const filesOf = (caseId) => db().prepare('SELECT id, doc_key, name, size FROM files WHERE case_id = ? ORDER BY uploaded_at, id').all(caseId)
    .map((f) => ({ fileId: f.id, name: f.name, docKey: f.doc_key, size: f.size }));
  const draftJson = (row) => {
    const files = filesOf(row.id);
    const last = db().prepare('SELECT ref FROM payments WHERE case_id = ? ORDER BY ref DESC LIMIT 1').get(row.id);
    return {
      draftId: row.draft_id, serviceId: row.service_id, status: row.status, fee: draftFee(row),
      qty: row.qty ?? null, areaSqm: row.area_sqm ?? null, files,
      missing: ctx.rules.missingDocs(row.service_id, files.map((f) => f.docKey)),
      latestRef: last ? last.ref : null,
    };
  };
  const quote = (body) => {
    const b = body || {};
    return ctx.rules.calcFee(b.serviceId, { qty: b.qty, areaSqm: b.areaSqm }, ctx.getService(b.serviceId));
  };
  const toIntOrNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

  // ---------- หน้า ----------
  app.get('/citizen', ctx.requirePage('citizen'), (req, res) => {
    const u = req.user;
    const drafts = db().prepare("SELECT * FROM cases WHERE applicant_id = ? AND status IN ('DRAFT','PENDING_PAYMENT') ORDER BY draft_id").all(u.id);
    const cases = db().prepare('SELECT * FROM cases WHERE applicant_id = ? AND case_no IS NOT NULL ORDER BY case_no DESC').all(u.id);
    const now = ctx.clock.now(); const hol = ctx.holidays();
    const items = cases.map((c) => ({ ...c, slaLevel: ctx.rules.slaLevel(c, now, hol) }));
    ctx.render(req, res, { title: 'บริการของฉัน', body: pages.citizenHome(ctx, u, drafts, items) });
  });

  app.get('/citizen/new/:service', ctx.requirePage('citizen'), (req, res) => {
    const u = req.user;
    const draftId = req.query.draft;
    if (draftId !== undefined) {
      const d = myDraft(u, String(draftId));
      if (!d) return ctx.renderCaseNotFound(req, res);
      if (!OPEN.includes(d.status)) return res.redirect(302, '/citizen/cases/' + d.case_no);
      return ctx.render(req, res, { title: ctx.constants.SERVICE_NAME[d.service_id], body: pages.wizard(ctx, d.service_id, draftJson(d)), script: pages.wizardScript(ctx, d.service_id, draftJson(d)) });
    }
    if (!SERVICES.includes(req.params.service)) return ctx.renderCaseNotFound(req, res);
    ctx.render(req, res, { title: ctx.constants.SERVICE_NAME[req.params.service], body: pages.wizard(ctx, req.params.service, null), script: pages.wizardScript(ctx, req.params.service, null) });
  });

  app.get('/citizen/cases/:caseNo', ctx.requirePage('citizen'), (req, res) => {
    const row = loadCaseForCitizen(ctx, req.user, req.params.caseNo);
    if (!row) return ctx.renderCaseNotFound(req, res);
    const files = db().prepare('SELECT id, doc_key, name FROM files WHERE case_id = ? ORDER BY uploaded_at, id').all(row.id)
      .map((f) => ({ id: f.id, doc_key: f.doc_key, name: f.name, fileId: f.id, docKey: f.doc_key }));
    const events = db().prepare('SELECT * FROM case_events WHERE case_id = ? ORDER BY at, id').all(row.id);
    const doc = db().prepare('SELECT * FROM documents WHERE case_id = ?').get(row.id);
    const slaLevel = ctx.rules.slaLevel(row, ctx.clock.now(), ctx.holidays());
    ctx.render(req, res, { title: 'คำขอ ' + row.case_no, body: pages.casePage(ctx, req, row, { files, events, doc, slaLevel }), script: pages.caseScript() });
  });

  // ---------- API: ค่าธรรมเนียม / ร่าง ----------
  app.post('/api/fee/quote', ctx.requireApi('citizen'), (req, res) => {
    const r = quote(req.body);
    if (!r.ok) return ctx.fail(res, r.code);
    res.status(200).json({ fee: r.fee });
  });

  app.post('/api/drafts', ctx.requireApi('citizen'), (req, res) => {
    const r = quote(req.body);
    if (!r.ok) return ctx.fail(res, r.code);
    const b = req.body;
    const out = ctx.tx(() => {
      const draftId = ctx.rules.fmtDraftId(ctx.nextCounter('DR'));
      const now = ctx.clock.nowIso();
      const qty = b.serviceId === 'SV-01' ? Number(b.qty) : null;
      const area = b.serviceId === 'SV-03' ? Number(b.areaSqm) : null;
      db().prepare(`INSERT INTO cases (draft_id, service_id, applicant_id, qty, area_sqm, fee, status, visited_depts, return_count, created_at, updated_at)
        VALUES (?,?,?,?,?,?, 'DRAFT', '', 0, ?, ?)`).run(draftId, b.serviceId, req.user.id, qty, area, r.fee, now, now);
      return draftId;
    });
    res.status(201).json({ draftId: out, fee: r.fee });
  });

  app.get('/api/drafts', ctx.requireApi('citizen'), (req, res) => {
    const rows = db().prepare("SELECT * FROM cases WHERE applicant_id = ? AND status IN ('DRAFT','PENDING_PAYMENT') ORDER BY draft_id").all(req.user.id);
    res.json({ items: rows.map((r) => ({ draftId: r.draft_id, serviceId: r.service_id, status: r.status, fee: r.fee })) });
  });

  app.get('/api/drafts/:id', ctx.requireApi('citizen'), (req, res) => {
    const d = myDraft(req.user, req.params.id);
    if (!d || !OPEN.includes(d.status)) return ctx.fail(res, 'NOT_FOUND');
    res.json(draftJson(d));
  });

  app.put('/api/drafts/:id', ctx.requireApi('citizen'), (req, res) => {
    const d = myDraft(req.user, req.params.id);
    if (!d) return ctx.fail(res, 'NOT_FOUND');
    if (d.status !== 'DRAFT') return ctx.fail(res, 'INVALID_STATE');
    const b = req.body || {};
    const qty = b.qty !== undefined ? toIntOrNull(b.qty) : d.qty;
    const area = b.areaSqm !== undefined ? toIntOrNull(b.areaSqm) : d.area_sqm;
    const r = ctx.rules.calcFee(d.service_id, { qty, areaSqm: area }, ctx.getService(d.service_id));
    if (!r.ok) return ctx.fail(res, r.code);
    db().prepare('UPDATE cases SET qty = ?, area_sqm = ?, fee = ?, updated_at = ? WHERE id = ?')
      .run(d.service_id === 'SV-01' ? qty : null, d.service_id === 'SV-03' ? area : null, r.fee, ctx.clock.nowIso(), d.id);
    res.json({ draftId: d.draft_id, fee: r.fee });
  });

  app.delete('/api/drafts/:id', ctx.requireApi('citizen'), (req, res) => {
    const d = myDraft(req.user, req.params.id);
    if (!d) return ctx.fail(res, 'NOT_FOUND');
    if (!OPEN.includes(d.status)) return ctx.fail(res, 'INVALID_STATE');
    ctx.tx(() => {
      db().prepare('DELETE FROM files WHERE case_id = ?').run(d.id);
      db().prepare('DELETE FROM payments WHERE case_id = ?').run(d.id);
      db().prepare('DELETE FROM case_events WHERE case_id = ?').run(d.id);
      db().prepare('DELETE FROM cases WHERE id = ?').run(d.id);
    });
    res.status(204).end();
  });

  app.post('/api/drafts/:id/files', ctx.requireApi('citizen'), (req, res, next) => {
    // ตรวจเจ้าของ/สถานะก่อน parse ไม่ได้ทั้งหมด แต่ 404 ต้องมาก่อน validate
    next();
  }, ctx.multipartSingle('file'), (req, res) => {
    const d = myDraft(req.user, req.params.id);
    if (!d) return ctx.fail(res, 'NOT_FOUND');
    if (!OPEN.includes(d.status)) return ctx.fail(res, 'INVALID_STATE');
    const out = ctx.tx(() => {
      const existing = db().prepare('SELECT COUNT(*) AS n FROM files WHERE case_id = ?').get(d.id).n;
      const docKey = String((req.body && req.body.docKey) ?? '');
      const v = validateUpload(ctx, { serviceId: d.service_id, docKey, file: req.file, existingCount: existing });
      if (!v.ok) return { err: v.code };
      const id = 'f' + ctx.crypto.randomLetters(15);
      const raw = Buffer.from(req.file.originalname || '', 'latin1').toString('utf8');
      const name = raw.split(/[\\/]/).pop() || 'file';
      db().prepare('INSERT INTO files (id, case_id, doc_key, name, mime, size, data, uploaded_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(id, d.id, docKey, name, ctx.rules.MIME[v.type], req.file.size, req.file.buffer, ctx.clock.nowIso());
      return { id, name, docKey, size: req.file.size };
    });
    if (out.err) return ctx.fail(res, out.err);
    res.status(201).json({ fileId: out.id, name: out.name, docKey: out.docKey, size: out.size });
  });

  app.delete('/api/drafts/:id/files/:fileId', ctx.requireApi('citizen'), (req, res) => {
    const d = myDraft(req.user, req.params.id);
    if (!d) return ctx.fail(res, 'NOT_FOUND');
    const f = db().prepare('SELECT id FROM files WHERE id = ? AND case_id = ?').get(req.params.fileId, d.id);
    if (!f) return ctx.fail(res, 'NOT_FOUND');
    if (!OPEN.includes(d.status)) return ctx.fail(res, 'INVALID_STATE');
    db().prepare('DELETE FROM files WHERE id = ?').run(f.id);
    res.status(204).end();
  });

  // ---------- API: คำขอ ----------
  app.get('/api/cases', ctx.requireApi('citizen'), (req, res) => {
    const rows = db().prepare('SELECT * FROM cases WHERE applicant_id = ? AND case_no IS NOT NULL ORDER BY case_no DESC').all(req.user.id);
    const now = ctx.clock.now(); const hol = ctx.holidays();
    res.json({ items: rows.map((r) => ({ caseNo: r.case_no, serviceId: r.service_id, status: r.status, dueAt: r.due_at, slaLevel: ctx.rules.slaLevel(r, now, hol) })) });
  });

  app.get('/api/cases/:caseNo', ctx.requireApi('citizen', 'officer', 'head'), (req, res) => {
    let row;
    if (req.user.role === 'citizen') row = loadCaseForCitizen(ctx, req.user, req.params.caseNo);
    else row = db().prepare(`SELECT c.*, u.name AS applicant_name, u.id_enc FROM cases c JOIN users u ON u.id = c.applicant_id WHERE c.case_no = ?`).get(req.params.caseNo);
    if (!row) return ctx.fail(res, 'NOT_FOUND');
    const doc = db().prepare('SELECT doc_no, verify_code FROM documents WHERE case_id = ?').get(row.id);
    const idNo = ctx.crypto.decrypt(row.id_enc);
    const out = {
      caseNo: row.case_no, serviceId: row.service_id, status: row.status, step: row.step ?? null, fee: row.fee,
      paidAt: row.paid_at ?? null, dueAt: row.due_at ?? null,
      slaLevel: ctx.rules.slaLevel(row, ctx.clock.now(), ctx.holidays()),
      owner: row.owner ?? null, returnCount: row.return_count, closedAt: row.closed_at ?? null,
      applicantName: row.applicant_name,
    };
    if (req.user.role === 'citizen') out.idNo = idNo; else out.idMasked = ctx.rules.maskId(idNo);
    out.fixDeadline = row.fix_deadline ?? null;
    out.docNo = doc ? doc.doc_no : null;
    out.verifyCode = doc ? doc.verify_code : null;
    res.json(out);
  });

  app.post('/api/cases/:caseNo/cancel', ctx.requireApi('citizen'), (req, res) => {
    const out = ctx.tx(() => {
      const row = db().prepare('SELECT * FROM cases WHERE case_no = ? AND applicant_id = ?').get(req.params.caseNo, req.user.id);
      if (!row) return 'NOT_FOUND';
      if (['COMPLETED', 'REJECTED', 'CANCELLED'].includes(row.status)) return 'INVALID_STATE';
      if (!(row.status === 'SUBMITTED' && !row.owner)) return 'CANNOT_CANCEL';
      const now = ctx.clock.nowIso();
      db().prepare("UPDATE cases SET status='CANCELLED', cancelled_at=?, cancel_reason='CITIZEN', updated_at=? WHERE id=?").run(now, now, row.id);
      ctx.caseEvent(row.id, 'CANCEL', 'ผู้ยื่นยกเลิกคำขอ');
      return null;
    });
    if (out) return ctx.fail(res, out);
    res.json({ status: 'CANCELLED' });
  });

  // ---------- API: ไฟล์ ----------
  app.get('/api/cases/:caseNo/files', ctx.requireApi('citizen', 'officer', 'head'), (req, res) => {
    const row = db().prepare('SELECT * FROM cases WHERE case_no = ?').get(req.params.caseNo);
    if (!row) return ctx.fail(res, 'NOT_FOUND');
    const v = ctx.rules.canViewCaseFiles(req.user, row);
    if (v === 'notfound') return ctx.fail(res, 'NOT_FOUND');
    if (v === 'forbidden') return ctx.fail(res, 'FORBIDDEN');
    res.json({ items: filesOf(row.id) });
  });

  app.get('/api/files/:fileId', ctx.requireApi(), (req, res) => {
    const f = db().prepare('SELECT * FROM files WHERE id = ?').get(req.params.fileId);
    if (!f) return ctx.fail(res, 'NOT_FOUND');
    const row = db().prepare('SELECT * FROM cases WHERE id = ?').get(f.case_id);
    if (!row) return ctx.fail(res, 'NOT_FOUND');
    if (!row.case_no && row.applicant_id !== req.user.id) return ctx.fail(res, 'NOT_FOUND');
    const v = ctx.rules.canViewCaseFiles(req.user, row);
    if (v === 'notfound') return ctx.fail(res, 'NOT_FOUND');
    if (v === 'forbidden') return ctx.fail(res, 'FORBIDDEN');
    const buf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    const asciiName = encodeURIComponent(f.name);
    res.status(200);
    res.set('Content-Type', f.mime);
    const plain = /^[\x20-\x7e]*$/.test(f.name) ? f.name.replace(/"/g, '_') : null;
    res.set('Content-Disposition', plain !== null ? `inline; filename="${plain}"` : `inline; filename="file"; filename*=UTF-8''${asciiName}`);
    res.set('Content-Length', String(buf.length));
    res.end(buf);
  });
};
module.exports.loadCaseForCitizen = loadCaseForCitizen;
