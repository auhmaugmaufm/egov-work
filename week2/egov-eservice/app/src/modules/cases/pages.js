'use strict';

function citizenHome(ctx, user, drafts, cases) {
  const { esc } = ctx; const v = ctx.views; const r = ctx.rules;
  const draftRows = drafts.length ? drafts.map((d) => `<tr data-testid="my-draft-row" data-draft-id="${esc(d.draft_id)}" data-status="${esc(d.status)}"><td data-testid="row-draft-id">${esc(d.draft_id)}</td><td data-testid="row-service">${esc(r.serviceLabel(d.service_id))}</td><td>${v.statusBadge(d.status, 'row-status')}</td><td>${esc(r.formatBaht(d.fee))}</td><td><a data-testid="open-draft-btn" href="/citizen/new/${esc(d.service_id)}?draft=${esc(d.draft_id)}">เปิดร่าง</a></td></tr>`).join('')
    : '<tr><td colspan="5">ยังไม่มีรายการ</td></tr>';
  const caseRows = cases.length ? cases.map((c) => `<tr data-testid="my-case-row" data-case-no="${esc(c.case_no)}" data-status="${esc(c.status)}"><td data-testid="row-case-no"><a href="/citizen/cases/${esc(c.case_no)}">${esc(c.case_no)}</a></td><td data-testid="row-service">${esc(r.serviceLabel(c.service_id))}</td><td>${v.statusBadge(c.status, 'row-status')}</td><td>${v.timeEl(c.due_at, 'row-due')}</td><td>${v.levelBadge(c.slaLevel, 'row-sla-level')}</td></tr>`).join('')
    : '<tr><td colspan="5">ยังไม่มีรายการ</td></tr>';
  return `<h1 data-testid="citizen-welcome">สวัสดี ${esc(user.name)}</h1>
<section class="card"><h2>เริ่มบริการ</h2><div class="toolbar">
  <a class="btn" data-testid="start-service-SV-01" href="/citizen/new/SV-01">SV-01 ขอหนังสือรับรอง</a>
  <a class="btn" data-testid="start-service-SV-02" href="/citizen/new/SV-02">SV-02 ขออนุญาตประกอบกิจการ</a>
  <a class="btn" data-testid="start-service-SV-03" href="/citizen/new/SV-03">SV-03 ขออนุญาตก่อสร้าง/ต่อเติมอาคาร</a></div></section>
<section><h2>ร่างและรอชำระเงิน</h2> <div class="table-wrap" tabindex="0" role="region" aria-label="ร่างของฉัน"><table>
  <thead><tr><th scope="col">รหัสร่าง</th><th scope="col">บริการ</th><th scope="col">สถานะ</th><th scope="col">ค่าธรรมเนียม</th><th scope="col">ดำเนินการ</th></tr></thead>
  <tbody>${draftRows}</tbody></table></div></section>
<section><h2>คำขอของฉัน</h2> <div class="table-wrap" tabindex="0" role="region" aria-label="คำขอของฉัน"><table>
  <thead><tr><th scope="col">เลขคำขอ</th><th scope="col">บริการ</th><th scope="col">สถานะ</th><th scope="col">กำหนดเสร็จ</th><th scope="col">ระดับ SLA</th></tr></thead>
  <tbody>${caseRows}</tbody></table></div></section>`;
}

function wizard(ctx, serviceId, draft) {
  const { esc } = ctx;
  return `<h1 data-testid="service-name">${esc(ctx.constants.SERVICE_NAME[serviceId])}</h1>
<p>ขั้นตอน <strong data-testid="wizard-step">1/3 กรอกข้อมูล</strong></p>
<p id="draft-info"></p>
<div id="wizard-body"></div>`;
}

function wizardScript(ctx, serviceId, draft) {
  const init = ctx.jsonForScript({ serviceId, draft });
  const docs = ctx.jsonForScript({ DOC_KEY_TH: ctx.constants.DOC_KEY_TH });
  return `window.INIT = ${init};
(function(){
var DOC_KEY_TH = ${docs}.DOC_KEY_TH;
var sid = INIT.serviceId, draft = INIT.draft, seq = 0, pollTimer = null;
var body = document.getElementById('wizard-body');
var stepEl = document.querySelector('[data-testid="wizard-step"]');
var STEPS = {1:'1/3 กรอกข้อมูล',2:'2/3 แนบเอกสาร',3:'3/3 ชำระเงิน'};
function $(id){ return document.getElementById(id); }
function q(t){ return document.querySelector('[data-testid="'+t+'"]'); }
function stopPoll(){ if (pollTimer){ clearInterval(pollTimer); pollTimer = null; } }
function showDraftInfo(){ if (draft && draft.draftId) $('draft-info').innerHTML = 'รหัสร่าง <strong data-testid="draft-id">'+App.esc(draft.draftId)+'</strong>'; }
function renderStep(n){
  stopPoll();
  stepEl.textContent = STEPS[n];
  if (n===1) step1(); else if (n===2) step2(); else step3();
  var h = body.querySelector('h2'); if (h) h.focus();
}
function inputs(){
  var o = {serviceId: sid};
  var qe = q('qty-input'), ae = q('area-input');
  if (qe) o.qty = qe.value === '' ? null : Number(qe.value);
  if (ae) o.areaSqm = ae.value === '' ? null : Number(ae.value);
  return o;
}
function step1(){
  var h = '<h2 tabindex="-1">กรอกข้อมูล</h2>';
  if (sid==='SV-01') h += '<div class="form-row"><label for="qty">จำนวนฉบับ (1–5 ฉบับ)</label><input id="qty" type="number" data-testid="qty-input" value="'+App.esc(draft && draft.qty != null ? draft.qty : 1)+'"></div>';
  else if (sid==='SV-03') h += '<div class="form-row"><label for="area">พื้นที่ก่อสร้าง (ตร.ม. จำนวนเต็ม)</label><input id="area" type="number" data-testid="area-input" value="'+App.esc(draft && draft.areaSqm != null ? draft.areaSqm : '')+'"></div>';
  else h += '<p class="muted">ค่าธรรมเนียมคงที่</p>';
  h += '<p>ค่าธรรมเนียม <strong data-testid="fee-total">–</strong></p><div id="fee-err"></div>'
    + '<div class="toolbar"><button type="button" class="btn-secondary" data-testid="save-draft-btn">บันทึกร่าง</button> <button type="button" data-testid="to-upload-btn">ถัดไป: แนบเอกสาร</button></div>';
  body.innerHTML = h;
  ['qty-input','area-input'].forEach(function(t){ var e=q(t); if (e) e.addEventListener('input', quote); });
  q('save-draft-btn').addEventListener('click', function(){ saveDraft(true); });
  q('to-upload-btn').addEventListener('click', function(){
    saveDraft(false).then(function(ok){ if(!ok) return; return App.api('GET','/api/drafts/'+draft.draftId).then(function(r){ if (r.ok){ draft = r.data; renderStep(2); } else App.showError(r.data && r.data.message); }); });
  });
  quote();
}
function quote(){
  var my = ++seq, up = q('to-upload-btn'), sv = q('save-draft-btn');
  if (up) up.disabled = true;
  App.api('POST','/api/fee/quote', inputs()).then(function(r){
    if (my !== seq) return;
    if (!q('fee-total')) return;
    if (r.ok){ q('fee-total').textContent = App.baht(r.data.fee); $('fee-err').innerHTML=''; up.disabled=false; sv.disabled=false; }
    else { q('fee-total').textContent = '–'; $('fee-err').innerHTML = '<p data-testid="fee-error" role="alert" class="alert-error">'+App.esc(r.data && r.data.message)+'</p>'; up.disabled=true; sv.disabled=true; }
  });
}
function saveDraft(announce){
  var o = inputs(), p;
  if (!draft) p = App.api('POST','/api/drafts', o);
  else { delete o.serviceId; p = App.api('PUT','/api/drafts/'+draft.draftId, o); }
  return p.then(function(r){
    if (!r.ok){ App.showError(r.data && r.data.message); return false; }
    if (!draft) draft = {draftId: r.data.draftId};
    draft.fee = r.data.fee;
    showDraftInfo();
    if (announce) App.showSuccess('บันทึกร่างแล้ว');
    return true;
  });
}
function step2(){
  var h = '<h2 tabindex="-1">แนบเอกสาร</h2><p class="muted">รองรับ PDF, JPG, PNG ไม่เกิน 5 MB ต่อไฟล์ รวมไม่เกิน 5 ไฟล์</p>'
    + '<div class="form-row"><label for="up-id-card">บัตรประชาชน (บังคับ)</label><input type="file" id="up-id-card" data-testid="upload-input-id-card"></div>';
  if (sid==='SV-02') h += '<div class="form-row"><label for="up-map">แผนที่ตั้ง (บังคับ)</label><input type="file" id="up-map" data-testid="upload-input-map"></div>'
    + '<div class="form-row"><label for="up-site-photo">ภาพสถานที่ (ไม่บังคับ)</label><input type="file" id="up-site-photo" data-testid="upload-input-site-photo"></div>';
  if (sid==='SV-03') h += '<div class="form-row"><label for="up-plan">แบบแปลน (บังคับ · PDF เท่านั้น)</label><input type="file" id="up-plan" data-testid="upload-input-plan"></div>'
    + '<div class="form-row"><label for="up-deed">โฉนด (บังคับ)</label><input type="file" id="up-deed" data-testid="upload-input-deed"></div>';
  h += '<div class="form-row"><label for="up-extra">เอกสารเพิ่มเติม (ไม่บังคับ)</label><input type="file" id="up-extra" data-testid="upload-input-extra" multiple></div>'
    + '<div id="upload-err"></div><ul id="file-list"></ul><div id="missing-slot"></div><div class="toolbar">'
    + (draft.status === 'PENDING_PAYMENT' ? '' : '<button type="button" class="btn-secondary" data-testid="back-btn">ย้อนกลับ</button> ')
    + '<button type="button" data-testid="to-payment-btn">ไปชำระเงิน</button></div>';
  body.innerHTML = h;
  Array.prototype.forEach.call(body.querySelectorAll('input[type=file]'), function(inp){
    inp.addEventListener('change', function(){ onFiles(inp); });
  });
  var back = q('back-btn'); if (back) back.addEventListener('click', function(){ renderStep(1); });
  q('to-payment-btn').addEventListener('click', function(){ renderStep(3); });
  refresh();
}
function onFiles(inp){
  $('upload-err').innerHTML = '';
  var files = Array.prototype.slice.call(inp.files), key = inp.getAttribute('data-testid').replace('upload-input-','');
  var chain = Promise.resolve(true);
  files.forEach(function(f){
    chain = chain.then(function(ok){
      if (!ok) return false;
      var fd = new FormData(); fd.append('docKey', key); fd.append('file', f);
      return App.api('POST','/api/drafts/'+draft.draftId+'/files', fd).then(function(r){
        if (!r.ok){ $('upload-err').innerHTML = '<p data-testid="upload-error" role="alert" class="alert-error">'+App.esc(r.data && r.data.message)+'</p>'; return false; }
        return true;
      });
    });
  });
  chain.then(function(){ inp.value = ''; refresh(); });
}
function refresh(){
  return App.api('GET','/api/drafts/'+draft.draftId).then(function(r){
    if (!r.ok || !$('file-list')) return;
    draft = r.data;
    $('file-list').innerHTML = draft.files.map(function(f){
      return '<li data-testid="file-item" data-name="'+App.esc(f.name)+'" data-doc-key="'+App.esc(f.docKey)+'" data-file-id="'+App.esc(f.fileId)+'">'+App.esc(DOC_KEY_TH[f.docKey]||f.docKey)+': '+App.esc(f.name)+' <button type="button" data-testid="file-remove-btn" aria-label="ลบไฟล์ '+App.esc(f.name)+'">ลบ</button></li>';
    }).join('');
    Array.prototype.forEach.call($('file-list').querySelectorAll('li'), function(li){
      li.querySelector('button').addEventListener('click', function(){
        App.api('DELETE','/api/drafts/'+draft.draftId+'/files/'+li.getAttribute('data-file-id')).then(refresh);
      });
    });
    $('missing-slot').innerHTML = draft.missing.length ? '<p data-testid="missing-docs" role="status">ยังขาดเอกสาร: '+App.esc(draft.missing.join(', '))+'</p>' : '';
    q('to-payment-btn').disabled = draft.missing.length > 0;
  });
}
function step3(){
  body.innerHTML = '<h2 tabindex="-1">ชำระเงิน</h2><p>ยอดที่ต้องชำระ <strong data-testid="payment-amount">'+App.baht(draft.fee)+'</strong></p><div id="pay-slot"></div>';
  if (draft.latestRef) loadPayment(draft.latestRef); else drawNone();
}
var curRef = null, curStatus = null;
function drawNone(){
  $('pay-slot').innerHTML = '<button type="button" data-testid="create-qr-btn">สร้าง QR</button>';
  q('create-qr-btn').addEventListener('click', createQr);
}
var QR_SVG = '<svg viewBox="0 0 21 21" width="160" height="160" aria-hidden="true"><rect width="21" height="21" fill="#fff"/><path fill="#000" d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0zM9 1h2v2H9zM9 5h3v1H9zM8 8h2v2H8zM12 9h3v2h-3zM16 9h2v1h-2zM9 12h2v3H9zM13 13h3v2h-3zM17 14h3v3h-3zM12 17h2v3h-2zM16 19h4v1h-4z"/><path fill="#fff" d="M1 1h5v5H1zM15 1h5v5h-5zM1 15h5v5H1z"/><path fill="#000" d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2z"/></svg>';
function createQr(){
  App.api('POST','/api/drafts/'+draft.draftId+'/payment').then(function(r){
    if (r.status === 201){
      q('payment-amount').textContent = App.baht(r.data.amount);
      draw({ref:r.data.ref, status:'PENDING', qrExpiresAt:r.data.qrExpiresAt});
      startPoll();
    } else App.showError(r.data && r.data.message);
  });
}
function loadPayment(ref){
  return App.api('GET','/api/payments/'+ref).then(function(r){
    if (!r.ok){ App.showError(r.data && r.data.message); return; }
    var changed = r.data.status !== curStatus || r.data.ref !== curRef;
    if (changed) draw(r.data);
    if (r.data.status === 'PENDING') startPoll(); else stopPoll();
  });
}
function draw(p){
  curRef = p.ref; curStatus = p.status;
  var s = $('pay-slot'); if (!s) return;
  var h = '';
  if (p.status === 'PENDING' || p.status === 'EXPIRED'){
    if (p.status === 'PENDING') h += '<div data-testid="qr-image" class="qr" role="img" aria-label="QR PromptPay จำลอง '+App.esc(p.ref)+'">'+QR_SVG+'</div>';
    h += '<p>เลขอ้างอิง <strong data-testid="qr-ref">'+App.esc(p.ref)+'</strong></p>'
      + '<p><time data-testid="qr-expires" data-iso="'+App.esc(p.qrExpiresAt)+'" datetime="'+App.esc(p.qrExpiresAt)+'">หมดอายุ '+App.thaiDateTime(p.qrExpiresAt)+'</time></p>';
    if (p.status === 'PENDING') h += '<p>สถานะ <span data-testid="payment-status" data-status="PENDING">รอชำระ</span></p><button type="button" class="btn-secondary" data-testid="refresh-payment-btn">ตรวจสอบการชำระเงิน</button>';
    else h += '<p>สถานะ <span data-testid="payment-status" data-status="EXPIRED">QR หมดอายุ</span></p><p data-testid="qr-expired-msg" role="alert" class="alert-error">QR หมดอายุ กรุณาสร้าง QR ใหม่</p><button type="button" data-testid="regenerate-qr-btn">สร้าง QR ใหม่</button>';
  } else if (p.status === 'PAID'){
    h += '<p>สถานะ <span data-testid="payment-status" data-status="PAID">ชำระแล้ว</span></p><div class="card"><p>เลขคำขอ <strong data-testid="submitted-case-no">'+App.esc(p.caseNo)+'</strong></p><p>เลขใบเสร็จ <strong data-testid="receipt-no">'+App.esc(p.receiptNo)+'</strong></p><p>ยอดชำระ <strong data-testid="receipt-amount">'+App.baht(p.amount)+'</strong></p><p>ชำระเมื่อ <time data-testid="receipt-paid-at" data-iso="'+App.esc(p.paidAt)+'" datetime="'+App.esc(p.paidAt)+'">'+App.thaiDateTime(p.paidAt)+'</time></p><a class="btn" data-testid="go-case-btn" href="/citizen/cases/'+App.esc(p.caseNo)+'">ดูคำขอ</a></div>';
  }
  s.innerHTML = h;
  var rf = q('refresh-payment-btn'); if (rf) rf.addEventListener('click', function(){ loadPayment(curRef); });
  var rg = q('regenerate-qr-btn'); if (rg) rg.addEventListener('click', createQr);
}
function startPoll(){ if (pollTimer) return; pollTimer = setInterval(function(){ if (curRef) loadPayment(curRef); }, 3000); }
showDraftInfo();
renderStep(draft && draft.status === 'PENDING_PAYMENT' ? 3 : 1);
})();`;
}

function casePage(ctx, req, row, { files, events, doc, slaLevel }) {
  const { esc } = ctx; const v = ctx.views; const r = ctx.rules;
  const idNo = ctx.crypto.decrypt(row.id_enc);
  const step = row.service_id === 'SV-03' ? r.stepLabel('SV-03', row.step) : null;
  let h = `<h1>คำขอ <span data-testid="case-no">${esc(row.case_no)}</span></h1>
<dl class="card">
  <dt>สถานะ</dt><dd>${v.statusBadge(row.status)}</dd>
  ${step ? `<dt>ขั้นตอน</dt><dd data-testid="case-step">${esc(step)}</dd>` : ''}
  <dt>บริการ</dt><dd data-testid="case-service">${esc(r.serviceLabel(row.service_id))}</dd>
  <dt>ค่าธรรมเนียม</dt><dd data-testid="case-fee">${esc(r.formatBaht(row.fee))}</dd>
  <dt>เลขบัตรประชาชนผู้ยื่น</dt><dd data-testid="case-id-full">${esc(r.formatId(idNo))}</dd>
  <dt>กำหนดเสร็จ</dt><dd>${v.timeEl(row.due_at, 'sla-due')}</dd>
  <dt>ระดับ SLA</dt><dd>${v.levelBadge(slaLevel)}</dd>
  ${['COMPLETED', 'REJECTED'].includes(row.status) ? `<dt>ปิดงานเมื่อ</dt><dd>${v.timeEl(row.closed_at, 'closed-at')}</dd>` : ''}
</dl>`;
  if (['REJECTED', 'CANCELLED'].includes(row.status)) h += '<p data-testid="no-refund-note" class="card">ค่าธรรมเนียมที่ชำระแล้วไม่คืน</p>';
  if (row.status === 'NEED_FIX') {
    h += `<section><p>เหตุผลที่ถูกตีกลับ: <span data-testid="return-reason-display">${esc(row.return_reason)}</span></p>
<p>ส่งแก้ไขได้ถึง ${v.timeEl(row.fix_deadline, 'fix-deadline')}</p>`;
    if (row.fix_deadline && ctx.clock.now().getTime() < Date.parse(row.fix_deadline)) {
      h += `<form id="fix-form"><div class="form-row"><label for="fixf">แนบไฟล์ใหม่ (ไม่บังคับ)</label><input type="file" id="fixf" data-testid="fix-upload-input" multiple></div><button type="submit" data-testid="submit-fix-btn">ส่งแก้ไข</button></form>`;
    }
    h += '</section>';
  }
  if (row.status === 'SUBMITTED' && !row.owner) {
    h += '<section><button type="button" class="btn-danger" data-testid="cancel-case-btn">ยกเลิกคำขอ</button><div id="cancel-slot"></div></section>';
  }
  if (doc) {
    h += `<section><p>เลขเอกสาร <strong data-testid="doc-no">${esc(doc.doc_no)}</strong></p><p>รหัสตรวจสอบ <strong data-testid="verify-code">${esc(doc.verify_code)}</strong></p>${v.qrBox({ testid: 'doc-qr', label: 'QR ตรวจสอบเอกสาร', dataUrl: ctx.baseUrl(req) + '/verify/' + doc.verify_code, seed: doc.verify_code })}<a class="btn" data-testid="download-doc-btn" href="/api/documents/${esc(doc.doc_no)}/pdf" download>ดาวน์โหลดเอกสาร</a></section>`;
  }
  h += `<section><h2>เอกสารแนบ</h2>${v.docItemsHtml(files)}</section>
<section><h2>ไทม์ไลน์</h2>${v.timelineHtml(events)}</section>`;
  return h + `<script>window.CASE_NO = ${ctx.jsonForScript(row.case_no)};</script>`;
}

function caseScript() {
  return `(function(){
var caseNo = window.CASE_NO;
var cb = document.querySelector('[data-testid="cancel-case-btn"]');
if (cb) cb.addEventListener('click', function(){
  document.getElementById('cancel-slot').innerHTML = '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="cc-t"><h2 id="cc-t">ยืนยันการยกเลิกคำขอ</h2><p data-testid="cancel-confirm-text">ค่าธรรมเนียมที่ชำระแล้วไม่คืน</p><button type="button" class="btn-danger" data-testid="confirm-cancel-btn">ยืนยันยกเลิก</button> <button type="button" class="btn-secondary" id="cc-close">ไม่ยกเลิก</button></div>';
  document.getElementById('cc-close').addEventListener('click', function(){ document.getElementById('cancel-slot').innerHTML = ''; });
  document.querySelector('[data-testid="confirm-cancel-btn"]').addEventListener('click', function(){
    App.api('POST','/api/cases/'+encodeURIComponent(caseNo)+'/cancel').then(function(r){ if (r.ok) location.reload(); else App.showError(r.data && r.data.message); });
  });
});
var ff = document.getElementById('fix-form');
if (ff) ff.addEventListener('submit', function(e){
  e.preventDefault();
  var fd = new FormData();
  Array.prototype.forEach.call(document.getElementById('fixf').files, function(f){ fd.append('file', f); });
  App.api('POST','/api/cases/'+encodeURIComponent(caseNo)+'/resubmit', fd).then(function(r){ if (r.ok) location.reload(); else App.showError(r.data && r.data.message); });
});
})();`;
}

module.exports = { citizenHome, wizard, wizardScript, casePage, caseScript };
