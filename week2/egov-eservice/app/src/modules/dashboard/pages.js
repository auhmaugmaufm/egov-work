'use strict';

const PERIOD_RE = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
const SERVICES = ['ALL', 'SV-01', 'SV-02', 'SV-03'];

function periodLabel(ctx, v) {
  const mt = ctx.constants.MONTH_TH;
  if (/^\d{4}-\d{2}$/.test(v)) return `${mt[Number(v.slice(5, 7)) - 1]} ${Number(v.slice(0, 4)) + 543}`;
  return `ทั้งปี ${Number(v) + 543}`;
}

function periodOptions(ctx, selected, defPeriod) {
  const [cy, cm] = defPeriod.split('-').map(Number);
  const list = [];
  const years = [];
  for (let i = 0; i < 12; i++) {
    let m = cm - i; let y = cy;
    while (m < 1) { m += 12; y -= 1; }
    list.push(`${y}-${String(m).padStart(2, '0')}`);
    if (!years.includes(String(y))) years.push(String(y));
  }
  const all = list.concat(years);
  if (!all.includes(selected)) all.push(selected);
  return all.map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${ctx.esc(periodLabel(ctx, v))}</option>`).join('');
}

function register(app, ctx, computeKpi, defaultPeriod) {
  app.get('/dashboard', ctx.requirePage('executive'), (req, res) => {
    const def = defaultPeriod(ctx);
    let period = req.query.period === undefined ? def : req.query.period;
    let service = req.query.service === undefined ? 'ALL' : req.query.service;
    let bad = false;
    if (typeof period !== 'string' || !PERIOD_RE.test(period)) { period = def; bad = true; }
    if (typeof service !== 'string' || !SERVICES.includes(service)) { service = 'ALL'; bad = true; }
    const k = computeKpi(ctx, period, service);
    const f = ctx.rules.formatPct;
    const rows = k.workload.map((w) => `<tr data-testid="workload-row" data-username="${ctx.esc(w.username)}"><td>${ctx.esc(w.name)} (${ctx.esc(w.username)})</td><td data-testid="workload-value">${w.count}</td></tr>`).join('');
    const sel = (v, t) => `<option value="${v}"${v === service ? ' selected' : ''}>${t}</option>`;
    const body = `<h1>Dashboard ผู้บริหาร</h1>
${bad ? '<p data-testid="action-error" role="alert" class="alert-error">ช่วงเวลาไม่ถูกต้อง</p>' : ''}
<form method="get" action="/dashboard" class="toolbar">
  <div class="form-row"><label for="pe">ช่วงเวลา</label>
    <select id="pe" name="period" data-testid="period-select" onchange="this.form.submit()">${periodOptions(ctx, period, def)}</select></div>
  <div class="form-row"><label for="sv">บริการ</label>
    <select id="sv" name="service" data-testid="service-select" onchange="this.form.submit()">
      ${sel('ALL', 'ทุกบริการ')}${sel('SV-01', 'SV-01 ขอหนังสือรับรอง')}${sel('SV-02', 'SV-02 ขออนุญาตประกอบกิจการ')}${sel('SV-03', 'SV-03 ขออนุญาตก่อสร้าง/ต่อเติมอาคาร')}</select></div>
  <button type="submit" class="btn-secondary">แสดงผล</button></form>
<dl class="grid-kpi">
  <div class="card"><dt>รับเรื่อง</dt><dd data-testid="kpi-received">${k.received}</dd></div>
  <div class="card"><dt>ปิดงาน</dt><dd data-testid="kpi-closed">${k.closed}</dd></div>
  <div class="card"><dt>ทันกำหนด %</dt><dd data-testid="kpi-ontime-pct">${f(k.ontimePct)}</dd></div>
  <div class="card"><dt>งานคงค้าง</dt><dd data-testid="kpi-backlog">${k.backlog}</dd></div>
  <div class="card"><dt>เกินกำหนดคงค้าง</dt><dd data-testid="kpi-overdue">${k.overdue}</dd></div>
</dl>
<p class="toolbar"><a class="btn" data-testid="export-xlsx-btn" href="/api/dashboard/export?format=xlsx&amp;period=${period}&amp;service=${service}" download>ส่งออก Excel</a>
  <a class="btn" data-testid="export-pdf-btn" href="/api/dashboard/export?format=pdf&amp;period=${period}&amp;service=${service}" download>ส่งออก PDF</a></p>
<h2>งานในมือรายเจ้าหน้าที่</h2>
<div class="table-wrap" tabindex="0" role="region" aria-label="งานในมือรายเจ้าหน้าที่"><table>
<thead><tr><th scope="col">เจ้าหน้าที่</th><th scope="col">งานในมือ (เรื่อง)</th></tr></thead><tbody>
${rows}
</tbody></table></div>`;
    ctx.render(req, res, { title: 'Dashboard ผู้บริหาร', body });
  });
}

module.exports = { register };
