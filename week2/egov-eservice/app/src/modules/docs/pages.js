'use strict';
const EVENTS = ['STAFF_LOGIN', 'CLAIM', 'RETURN', 'FORWARD', 'APPROVE', 'REJECT', 'ISSUE', 'UNMASK', 'EXPORT', 'ADMIN_CHANGE'];

module.exports = function pages(app, ctx, h) {
  const esc = ctx.esc;

  app.get('/verify/:code', (req, res) => {
    const v = h.verifyDoc(req.params.code);
    const META = {
      VALID: ['เอกสารถูกต้อง', 'lv-normal'], EXPIRED: ['เอกสารหมดอายุ', 'lv-near'],
      TAMPERED: ['ลายเซ็นไม่ถูกต้อง', 'lv-overdue'], NOT_FOUND: ['ไม่พบเอกสาร', 'lv-closed'],
    };
    const [text, cls] = META[v.result];
    let body = `<h1>ตรวจสอบเอกสารดิจิทัล</h1>
<p><span data-testid="verify-result" data-result="${v.result}" class="badge ${cls}">${text}</span></p>`;
    if (v.doc) {
      const d = v.doc; const V = ctx.views;
      body += `<dl class="card">
  <dt>เลขเอกสาร</dt><dd data-testid="verify-doc-no">${esc(d.doc_no)}</dd>
  <dt>ผู้ยื่น</dt><dd data-testid="verify-applicant">${esc(ctx.rules.maskName(d.applicant))}</dd>
  <dt>บริการ</dt><dd data-testid="verify-service">${esc(ctx.rules.serviceLabel(d.service_id))}</dd>
  <dt>วันออก</dt><dd>${V.timeEl(d.issued_at, 'verify-issued')}</dd>
  <dt>ใช้ได้ถึง</dt><dd>${V.dateEl(d.valid_until, 'verify-expires')}</dd>
  <dt>ผู้ลงนาม</dt><dd data-testid="verify-signer">${esc(d.signer)}</dd>
</dl>`;
    }
    ctx.render(req, res, { title: 'ตรวจสอบเอกสารดิจิทัล', body, status: v.result === 'NOT_FOUND' ? 404 : 200 });
  });

  app.get('/audit', ctx.requirePage('auditor'), (req, res) => {
    const f = h.auditFilter(req.query);
    const rows = h.auditRows(f);
    const actor = String(req.query.actor ?? '').trim();
    const event = String(req.query.event ?? '').trim();
    const from = f.bad.includes('from') ? '' : String(req.query.from ?? '').trim();
    const to = f.bad.includes('to') ? '' : String(req.query.to ?? '').trim();
    const qs = new URLSearchParams({ actor, event, from, to }).toString().replace(/&/g, '&amp;');
    const V = ctx.views;
    const opts = EVENTS.map((e) => `<option value="${e}"${e === event ? ' selected' : ''}>${e}</option>`).join('');
    const trs = rows.map((r) => `<tr data-testid="audit-row" data-id="${r.id}" data-event="${esc(r.event)}" data-actor="${esc(r.username)}" data-case-no="${esc(r.case_no ?? '')}">
  <td>${V.timeEl(r.time, 'audit-time')}</td><td data-testid="audit-actor">${esc(r.username)}</td><td data-testid="audit-role">${esc(r.role)}</td>
  <td data-testid="audit-event">${esc(r.event)}</td><td data-testid="audit-case-no">${esc(r.case_no ?? '–')}</td>
  <td data-testid="audit-transition">${r.from_status && r.to_status ? esc(r.from_status) + ' → ' + esc(r.to_status) : '–'}</td><td data-testid="audit-detail">${esc(r.detail)}</td></tr>`).join('\n');
    const body = `<h1>Audit Trail</h1>
${f.bad.length ? '<p data-testid="action-error" role="alert" class="alert-error">รูปแบบวันที่ไม่ถูกต้อง</p>' : ''}
<form method="get" action="/audit" class="toolbar">
  <div class="form-row"><label for="fa">ผู้ทำรายการ (username)</label><input id="fa" name="actor" data-testid="audit-filter-actor" value="${esc(actor)}"></div>
  <div class="form-row"><label for="fe">เหตุการณ์</label><select id="fe" name="event" data-testid="audit-filter-event">
      <option value="">ทั้งหมด</option>${opts}</select></div>
  <div class="form-row"><label for="ff">ตั้งแต่วันที่</label><input type="date" id="ff" name="from" data-testid="audit-filter-from" value="${esc(from)}"></div>
  <div class="form-row"><label for="ft">ถึงวันที่</label><input type="date" id="ft" name="to" data-testid="audit-filter-to" value="${esc(to)}"></div>
  <button type="submit" data-testid="audit-apply-btn">ค้นหา</button></form>
<p>จำนวนรายการ <strong data-testid="audit-count">${rows.length}</strong></p>
<p><a class="btn" data-testid="audit-export-csv-btn" href="/api/audit/export.csv?${qs}" download>ส่งออก CSV</a></p>
<div class="table-wrap" tabindex="0" role="region" aria-label="ตาราง Audit"><table>
<thead><tr><th scope="col">เวลา</th><th scope="col">ผู้ทำ</th><th scope="col">บทบาท</th><th scope="col">เหตุการณ์</th><th scope="col">เลขคำขอ</th><th scope="col">สถานะก่อน → หลัง</th><th scope="col">รายละเอียด</th></tr></thead><tbody>
${trs}
</tbody></table></div>`;
    ctx.render(req, res, { title: 'Audit Trail', body });
  });
};
