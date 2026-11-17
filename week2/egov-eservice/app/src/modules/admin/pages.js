'use strict';
// B10 · หน้า /admin/services · /admin/holidays · /admin/users (เขียนโดย Z1 ตามสเปก B10 ข้อ 2)

const SV_NAME = { 'SV-01': 'SV-01 ขอหนังสือรับรอง', 'SV-02': 'SV-02 ขออนุญาตประกอบกิจการ', 'SV-03': 'SV-03 ขออนุญาตก่อสร้าง/ต่อเติมอาคาร' };
const ROLE_OPTS = ['officer', 'head', 'executive', 'auditor', 'admin', 'citizen'];

function table(label, head, rows) {
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="${label}"><table>
<thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>
${rows}
</tbody></table></div>`;
}

module.exports = function pages(app, ctx) {
  const esc = ctx.esc;
  const guard = ctx.requirePage('admin');

  app.get('/admin/services', guard, (req, res) => {
    const svcs = ctx.db.prepare('SELECT id, fee, fee_per_sqm, sla FROM services ORDER BY id').all();
    const rows = svcs.map((s) => {
      const id = esc(s.id);
      let feeCell;
      if (s.id === 'SV-03') {
        feeCell = `<label for="fee-${id}">ฐาน (1–100 ตร.ม.)</label> <input type="number" id="fee-${id}" data-testid="svc-fee-${id}" value="${s.fee}">
      <label for="psq-${id}">ต่อ ตร.ม. ส่วนเกิน 100</label> <input type="number" id="psq-${id}" data-testid="svc-fee-per-sqm-${id}" value="${s.fee_per_sqm ?? ''}">`;
      } else {
        const lbl = s.id === 'SV-02' ? 'คงที่' : 'ต่อฉบับ';
        feeCell = `<label for="fee-${id}">${lbl}</label> <input type="number" id="fee-${id}" data-testid="svc-fee-${id}" value="${s.fee}">`;
      }
      return `<tr data-testid="service-row" data-service-id="${id}"><td>${esc(SV_NAME[s.id] || s.id)}</td>
  <td>${feeCell}</td>
  <td><label for="sla-${id}">SLA ${id}</label> <input type="number" id="sla-${id}" data-testid="svc-sla-${id}" value="${s.sla}"></td>
  <td><button type="button" data-testid="svc-save-${id}" data-service-id="${id}">บันทึก</button></td></tr>`;
    }).join('\n');
    const body = `<h1>จัดการบริการ</h1>
${table('ตารางบริการ', ['บริการ', 'ค่าธรรมเนียม (บาท)', 'SLA (วันทำการ)', 'บันทึก'], rows)}`;
    const script = `(function(){
function num(id){var v=document.getElementById(id).value;return v===''?null:Number(v);}
document.querySelectorAll('button[data-service-id]').forEach(function(b){b.addEventListener('click',async function(){
var id=b.dataset.serviceId;var body;
if(id==='SV-03'){body={feeBase:num('fee-'+id),feePerSqm:num('psq-'+id),sla:num('sla-'+id)};}
else{body={fee:num('fee-'+id),sla:num('sla-'+id)};}
var r=await App.api('PUT','/api/admin/services/'+id,body);
if(r.ok){var d=r.data||{};
document.getElementById('fee-'+id).value=d.fee;
if(id==='SV-03'){document.getElementById('psq-'+id).value=d.feePerSqm;}
document.getElementById('sla-'+id).value=d.sla;
App.showSuccess('\\u0E1A\\u0E31\\u0E19\\u0E17\\u0E36\\u0E01\\u0E41\\u0E25\\u0E49\\u0E27');}
else{App.showError(r.data&&r.data.message||'error');}});});})();`;
    ctx.render(req, res, { title: 'จัดการบริการ', body, script });
  });

  app.get('/admin/holidays', guard, (req, res) => {
    const hs = ctx.db.prepare('SELECT date, name FROM holidays ORDER BY date').all();
    const rows = hs.map((h) => `<tr data-testid="holiday-row" data-date="${esc(h.date)}"><td>${esc(ctx.rules.formatThaiDate(h.date))} (${esc(h.date)})</td><td>${esc(h.name)}</td>
  <td><button type="button" class="btn-danger" data-testid="holiday-delete-btn" data-date="${esc(h.date)}" aria-label="ลบวันหยุด ${esc(h.date)}">ลบ</button></td></tr>`).join('\n');
    const body = `<h1>จัดการวันหยุด</h1>
<form id="hol-form" class="toolbar" novalidate>
  <div class="form-row"><label for="hd">วันที่ (ค.ศ.)</label><input type="date" id="hd" data-testid="holiday-date-input"></div>
  <div class="form-row"><label for="hn">ชื่อวันหยุด</label><input id="hn" data-testid="holiday-name-input"></div>
  <button type="submit" data-testid="holiday-add-btn">เพิ่มวันหยุด</button></form>
${table('ตารางวันหยุด', ['วันที่', 'ชื่อ', 'ลบ'], rows)}`;
    const script = `(function(){
document.getElementById('hol-form').addEventListener('submit',async function(e){e.preventDefault();
var r=await App.api('POST','/api/admin/holidays',{date:document.getElementById('hd').value,name:document.getElementById('hn').value});
if(r.ok){location.reload();}else{App.showError(r.data&&r.data.message||'error');}});
document.querySelectorAll('button[data-testid="holiday-delete-btn"]').forEach(function(b){b.addEventListener('click',async function(){
var r=await App.api('DELETE','/api/admin/holidays/'+b.dataset.date);
if(r.ok){location.reload();}else{App.showError(r.data&&r.data.message||'error');}});});})();`;
    ctx.render(req, res, { title: 'จัดการวันหยุด', body, script });
  });

  app.get('/admin/users', guard, (req, res) => {
    const us = ctx.db.prepare("SELECT username, name, role, dept FROM users WHERE kind = 'staff' ORDER BY id").all();
    const roleTh = ctx.constants.ROLE_TH;
    const rows = us.map((u) => {
      const un = esc(u.username);
      const ro = ROLE_OPTS.map((r) => `<option value="${r}"${r === u.role ? ' selected' : ''}>${esc(roleTh[r])}</option>`).join('');
      const dopt = [['', '(ไม่มี)'], ['registry', 'ทะเบียน'], ['works', 'โยธา']]
        .map(([v, t]) => `<option value="${v}"${(u.dept || '') === v ? ' selected' : ''}>${t}</option>`).join('');
      return `<tr data-testid="user-row" data-username="${un}"><td>${un}</td><td>${esc(u.name)}</td>
  <td><select data-testid="user-role-select" aria-label="บทบาทของ ${un}">${ro}</select></td>
  <td><select data-testid="user-dept-select" aria-label="แผนกของ ${un}">${dopt}</select></td>
  <td><button type="button" data-testid="user-save-btn" data-username="${un}">บันทึก</button></td></tr>`;
    }).join('\n');
    const body = `<h1>จัดการผู้ใช้และบทบาท</h1>
${table('ตารางผู้ใช้', ['ชื่อผู้ใช้', 'ชื่อ', 'บทบาท', 'แผนก', 'บันทึก'], rows)}`;
    const script = `(function(){
document.querySelectorAll('button[data-testid="user-save-btn"]').forEach(function(b){b.addEventListener('click',async function(){
var tr=b.closest('tr');
var body={role:tr.querySelector('[data-testid="user-role-select"]').value,dept:tr.querySelector('[data-testid="user-dept-select"]').value};
var r=await App.api('PUT','/api/admin/users/'+b.dataset.username,body);
if(r.ok){App.showSuccess('\\u0E1A\\u0E31\\u0E19\\u0E17\\u0E36\\u0E01\\u0E41\\u0E25\\u0E49\\u0E27');}
else{App.showError(r.data&&r.data.message||'error');}});});})();`;
    ctx.render(req, res, { title: 'จัดการผู้ใช้และบทบาท', body, script });
  });
};
