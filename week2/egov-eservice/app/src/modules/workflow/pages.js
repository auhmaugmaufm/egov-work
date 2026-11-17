'use strict';
// B07 · หน้า HTML 4 หน้า
function install(app, ctx) {
  const db = ctx.db;
  const esc = ctx.esc;
  const C = ctx.constants;

  app.get('/officer/queue', ctx.requirePage('officer', 'head'), (req, res) => {
    const u = req.user;
    const f = ['all', 'unclaimed', 'mine'].includes(req.query.filter) ? req.query.filter : 'all';
    const all = db.prepare('SELECT c.*, u.name AS applicant_name, u.id_enc FROM cases c JOIN users u ON u.id = c.applicant_id WHERE c.case_no IS NOT NULL').all();
    const rows = ctx.rules.selectQueue(all, u, f);
    const now = ctx.clock.now(); const hol = ctx.holidays();
    const V = ctx.views;
    const ownerName = new Map(ctx.db.prepare("SELECT username, name FROM users WHERE kind = 'staff'").all().map((x) => [x.username, x.name]));
    const trs = rows.map((r) => {
      const level = ctx.rules.slaLevel(r, now, hol);
      const idm = ctx.rules.maskId(ctx.crypto.decrypt(r.id_enc));
      return `<tr data-testid="queue-row" data-case-no="${esc(r.case_no)}" data-owner="${esc(r.owner ?? '')}" data-status="${esc(r.status)}" data-sla-level="${esc(level ?? '')}">
<td data-testid="row-case-no"><a href="/officer/cases/${esc(r.case_no)}">${esc(r.case_no)}</a></td>
<td data-testid="row-service">${esc(ctx.rules.serviceLabel(r.service_id))}</td><td data-testid="row-applicant">${esc(r.applicant_name)}</td>
<td data-testid="row-id-masked">${esc(idm)}</td><td>${V.statusBadge(r.status, 'row-status')}</td>
<td>${V.timeEl(r.due_at, 'row-due')}</td><td>${V.levelBadge(level, 'row-sla-level')}</td>
<td data-testid="row-owner">${esc(r.owner ? (ownerName.get(r.owner) || r.owner) : '')}</td>
<td>${ctx.rules.canClaim(u, r) ? `<button type="button" data-testid="claim-btn" data-case-no="${esc(r.case_no)}">รับเรื่อง</button>` : ''}</td></tr>`;
    }).join('\n');
    const title = u.role === 'head' ? 'ทุกแผนก (อ่านอย่างเดียว)' : C.DEPT_TH[u.dept];
    const wl = u.role === 'officer'
      ? `<p>งานในมือของฉัน <strong data-testid="workload-count">${db.prepare("SELECT COUNT(*) AS n FROM cases WHERE status='IN_REVIEW' AND owner=?").get(u.username).n}</strong> เรื่อง</p>` : '';
    const opt = (v, t) => `<option value="${v}"${f === v ? ' selected' : ''}>${t}</option>`;
    const bodyHtml = `<h1>คิวงาน · ${esc(title)}</h1>${wl}
<form method="get" action="/officer/queue" class="toolbar"><div class="form-row"><label for="qf">แสดง</label>
<select id="qf" name="filter" data-testid="queue-filter" onchange="this.form.submit()">${opt('all', 'ทั้งหมด')}${opt('unclaimed', 'ยังไม่มีผู้รับ')}${opt('mine', 'ของฉัน')}</select></div>
<button type="submit" class="btn-secondary">แสดง</button></form>
${rows.length ? '' : '<p data-testid="queue-empty">ไม่มีงานในคิว</p>'}
<div class="table-wrap" tabindex="0" role="region" aria-label="ตารางคิวงาน"><table data-testid="queue-table">
<thead><tr><th scope="col">เลขคำขอ</th><th scope="col">บริการ</th><th scope="col">ผู้ยื่น</th><th scope="col">เลขบัตร</th><th scope="col">สถานะ</th><th scope="col">กำหนดเสร็จ</th><th scope="col">ระดับ SLA</th><th scope="col">ผู้ถือเรื่อง</th><th scope="col">ดำเนินการ</th></tr></thead>
<tbody>${trs}</tbody></table></div>`;
    const script = `document.querySelectorAll('button[data-case-no]').forEach(function(b){b.addEventListener('click',async function(){
var r=await App.api('POST','/api/officer/cases/'+b.dataset.caseNo+'/claim');
if(r.ok){location.reload();}else{App.showError(r.data&&r.data.message||'เกิดข้อผิดพลาด');}});});`;
    ctx.render(req, res, { title: 'คิวงาน', body: bodyHtml, script });
  });

  app.get('/officer/cases/:caseNo', ctx.requirePage('officer', 'head'), (req, res) => {
    const u = req.user;
    const row = db.prepare('SELECT c.*, u.name AS applicant_name, u.id_enc FROM cases c JOIN users u ON u.id = c.applicant_id WHERE c.case_no = ?').get(req.params.caseNo);
    if (!row) return ctx.renderCaseNotFound(req, res);
    const V = ctx.views; const R = ctx.rules;
    const level = R.slaLevel(row, ctx.clock.now(), ctx.holidays());
    const isOwner = u.role === 'officer' && row.owner === u.username;
    const sv01 = row.service_id === 'SV-01';
    const btns = [];
    if (R.canClaim(u, row)) btns.push('<button type="button" data-testid="claim-btn">รับเรื่อง</button>');
    if (isOwner && row.status === 'IN_REVIEW' && (ctx.bug('B12') || row.return_count < 2)) btns.push('<button type="button" data-testid="return-btn">ตีกลับ</button>');
    if (isOwner && row.status === 'IN_REVIEW' && !sv01) {
      btns.push('<div class="form-row"><label for="fn">หมายเหตุส่งต่อ (ไม่บังคับ)</label><textarea id="fn" data-testid="forward-note"></textarea></div><button type="button" data-testid="forward-btn">ผ่าน/ส่งต่อ</button>');
    }
    const canDecide = (sv01 && isOwner && row.status === 'IN_REVIEW') || (!sv01 && u.role === 'head' && row.status === 'PENDING_APPROVAL');
    if (canDecide) {
      btns.push('<button type="button" data-testid="approve-btn">อนุมัติ</button>');
      btns.push('<button type="button" class="btn-danger" data-testid="reject-btn">ไม่อนุมัติ</button>');
    }
    if (u.role === 'officer' && row.status === 'APPROVED' && row.issuer === u.username) btns.push('<button type="button" data-testid="issue-btn">ออกเอกสาร</button>');
    btns.push('<button type="button" class="btn-secondary" data-testid="show-full-id-btn">แสดงเลขเต็ม</button>');
    const doc = db.prepare('SELECT * FROM documents WHERE case_id = ?').get(row.id);
    const files = db.prepare('SELECT id, doc_key, name FROM files WHERE case_id = ? ORDER BY uploaded_at, rowid').all(row.id);
    const events = db.prepare('SELECT at, text FROM case_events WHERE case_id = ? ORDER BY at, id').all(row.id);
    const step = R.stepLabel(row.service_id, row.step);
    const closed = ['COMPLETED', 'REJECTED'].includes(row.status) && row.closed_at;
    const html = `<h1>คำขอ <span data-testid="case-no">${esc(row.case_no)}</span></h1>
<dl class="card">
<dt>สถานะ</dt><dd>${V.statusBadge(row.status)}</dd>
${step ? `<dt>ขั้นตอน</dt><dd data-testid="case-step">${esc(step)}</dd>` : ''}
<dt>บริการ</dt><dd data-testid="case-service">${esc(R.serviceLabel(row.service_id))}</dd>
<dt>ค่าธรรมเนียม</dt><dd data-testid="case-fee">${esc(R.formatBaht(row.fee))}</dd>
<dt>ผู้ยื่น</dt><dd data-testid="applicant-name">${esc(row.applicant_name)}</dd>
<dt>เลขบัตรประชาชน</dt><dd><span data-testid="applicant-id">${esc(R.maskId(ctx.crypto.decrypt(row.id_enc)))}</span> <span id="full-id-slot"></span>
<div id="unmask-slot"></div></dd>
<dt>กำหนดเสร็จ</dt><dd>${V.timeEl(row.due_at, 'sla-due')}</dd>
<dt>ระดับ SLA</dt><dd>${V.levelBadge(level)}</dd>
<dt>ผู้ถือเรื่อง</dt><dd data-testid="case-owner">${esc(row.owner ?? 'ยังไม่มีผู้รับ')}</dd>
<dt>ตีกลับแล้ว (ครั้ง)</dt><dd data-testid="return-count">${row.return_count}</dd>
${closed ? `<dt>ปิดงานเมื่อ</dt><dd>${V.timeEl(row.closed_at, 'closed-at')}</dd>` : ''}
</dl>
<section class="card"><h2>ดำเนินการ</h2><div class="toolbar">${btns.join('\n')}</div><div id="form-slot"></div></section>
${doc ? `<section class="card"><h2>เอกสารที่ออก</h2><p>เลขเอกสาร <strong data-testid="doc-no">${esc(doc.doc_no)}</strong></p>
<p>รหัสตรวจสอบ <strong data-testid="verify-code">${esc(doc.verify_code)}</strong></p>${V.qrBox({ testid: 'doc-qr', label: 'QR ตรวจสอบเอกสาร', dataUrl: ctx.baseUrl(req) + '/verify/' + doc.verify_code, seed: doc.verify_code })}</section>` : ''}
<section><h2>เอกสารแนบ</h2>${R.canViewCaseFiles(u, row) === 'ok' ? V.docItemsHtml(files) : '<p class="muted">ไม่มีสิทธิ์เปิดไฟล์แนบของคำขอนี้</p>'}</section>
<section><h2>ไทม์ไลน์</h2>${V.timelineHtml(events)}</section>`;
    const script = `(function(){var NO=${ctx.jsonForScript(row.case_no)};var $=function(s){return document.querySelector(s)};
function on(t,fn){var b=$('[data-testid="'+t+'"]');if(b)b.addEventListener('click',fn);}
async function act(m,url,body){var r=await App.api(m,url,body);if(r.ok){location.reload();}else{App.showError(r.data&&r.data.message||'เกิดข้อผิดพลาด');}}
on('claim-btn',function(){act('POST','/api/officer/cases/'+NO+'/claim');});
on('return-btn',function(){$('#form-slot').innerHTML='<div class="form-row"><label for="rr">เหตุผลการตีกลับ (อย่างน้อย 10 ตัวอักษร)</label><textarea id="rr" data-testid="return-reason"></textarea></div><button type="button" data-testid="return-submit">ยืนยันตีกลับ</button><div id="rr-err"></div>';
 on('return-submit',async function(){var r=await App.api('POST','/api/officer/cases/'+NO+'/return',{reason:$('#rr').value});
  if(r.ok)location.reload();else if(r.status===400)$('#rr-err').innerHTML='<p data-testid="return-reason-error" role="alert" class="alert-error">'+App.esc(r.data.message)+'</p>';else App.showError(r.data&&r.data.message);});});
on('forward-btn',function(){act('POST','/api/officer/cases/'+NO+'/forward',{note:$('#fn').value});});
on('approve-btn',function(){act('POST','/api/cases/'+NO+'/approve');});
on('reject-btn',function(){$('#form-slot').innerHTML='<div class="form-row"><label for="rj">เหตุผลที่ไม่อนุมัติ (อย่างน้อย 10 ตัวอักษร)</label><textarea id="rj" data-testid="reject-reason"></textarea></div><button type="button" data-testid="reject-submit">ยืนยันไม่อนุมัติ</button><div id="rj-err"></div>';
 on('reject-submit',async function(){var r=await App.api('POST','/api/cases/'+NO+'/reject',{reason:$('#rj').value});
  if(r.ok)location.reload();else if(r.status===400)$('#rj-err').innerHTML='<p data-testid="reject-reason-error" role="alert" class="alert-error">'+App.esc(r.data.message)+'</p>';else App.showError(r.data&&r.data.message);});});
on('issue-btn',function(){act('POST','/api/officer/cases/'+NO+'/issue');});
on('show-full-id-btn',function(){$('#unmask-slot').innerHTML='<div class="form-row"><label for="ur">เหตุผลที่ขอดูเลขเต็ม</label><input id="ur" data-testid="unmask-reason"></div><button type="button" data-testid="unmask-submit">ยืนยัน</button><div id="ur-err"></div>';
 on('unmask-submit',async function(){var r=await App.api('POST','/api/officer/cases/'+NO+'/unmask',{reason:$('#ur').value});
  if(r.ok){$('#full-id-slot').innerHTML='<span data-testid="full-id">'+App.esc(App.fmtId(r.data.idNo))+'</span>';}
  else if(r.status===400)$('#ur-err').innerHTML='<p data-testid="unmask-error" role="alert" class="alert-error">'+App.esc(r.data.message)+'</p>';else App.showError(r.data&&r.data.message);});});
})();`;
    ctx.render(req, res, { title: 'คำขอ ' + row.case_no, body: html, script });
  });

  app.get('/head/approvals', ctx.requirePage('head'), (req, res) => {
    const rows = db.prepare("SELECT c.*, u.name AS applicant_name FROM cases c JOIN users u ON u.id=c.applicant_id WHERE c.status='PENDING_APPROVAL' ORDER BY c.due_at, c.case_no").all();
    const V = ctx.views;
    const trs = rows.map((r) => `<tr data-testid="approval-row" data-case-no="${esc(r.case_no)}"><td data-testid="row-case-no">${esc(r.case_no)}</td><td data-testid="row-service">${esc(ctx.rules.serviceLabel(r.service_id))}</td>
<td data-testid="row-applicant">${esc(r.applicant_name)}</td><td>${V.timeEl(r.due_at, 'row-due')}</td><td><a data-testid="approval-open" href="/officer/cases/${esc(r.case_no)}">เปิดคำขอ</a></td></tr>`).join('\n');
    const html = `<h1>รายการรออนุมัติ</h1><div class="table-wrap" tabindex="0" role="region" aria-label="รายการรออนุมัติ"><table>
<thead><tr><th scope="col">เลขคำขอ</th><th scope="col">บริการ</th><th scope="col">ผู้ยื่น</th><th scope="col">กำหนดเสร็จ</th><th scope="col">ดำเนินการ</th></tr></thead><tbody>${trs}</tbody></table></div>${rows.length ? '' : '<p>ไม่มีคำขอรออนุมัติ</p>'}`;
    ctx.render(req, res, { title: 'รายการรออนุมัติ', body: html });
  });

  app.get('/notifications', ctx.requirePage('officer', 'head'), (req, res) => {
    const rows = db.prepare('SELECT * FROM notifications WHERE username=? ORDER BY created_at DESC, id DESC').all(req.user.username);
    const html = '<h1>แจ้งเตือน</h1>' + (rows.length
      ? '<ul>' + rows.map((r) => `<li data-testid="noti-item" data-case-no="${esc(r.case_no)}" data-level="${esc(r.level)}"><a href="/officer/cases/${esc(r.case_no)}">${esc(r.text)}</a></li>`).join('') + '</ul>'
      : '<p data-testid="noti-empty">ไม่มีแจ้งเตือน</p>');
    ctx.render(req, res, { title: 'แจ้งเตือน', body: html });
  });
}
module.exports = { install };
