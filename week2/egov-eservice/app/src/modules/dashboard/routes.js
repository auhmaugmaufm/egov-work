'use strict';
const ExcelJS = require('exceljs');
const pages = require('./pages');

const PERIOD_RE = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
const SERVICES = ['ALL', 'SV-01', 'SV-02', 'SV-03'];

function defaultPeriod(ctx) { return ctx.rules.bkkDate(ctx.clock.now()).slice(0, 7); }

function computeKpi(ctx, period, service) {
  const { BACKLOG_STATUSES, CLOSED_STATUSES } = ctx.constants;
  const now = ctx.clock.now();
  const match = (iso) => iso !== null && iso !== undefined && iso.startsWith(period);
  const svcOk = (r) => service === 'ALL' || r.service_id === service;
  const rows = ctx.db.prepare('SELECT service_id, status, paid_at, due_at, closed_at, owner FROM cases WHERE case_no IS NOT NULL').all();
  const received = rows.filter((r) => svcOk(r) && match(r.paid_at)).length;
  const closedRows = rows.filter((r) => svcOk(r) && CLOSED_STATUSES.includes(r.status) && match(r.closed_at));
  const closed = closedRows.length;
  const onTime = closedRows.filter((r) => ctx.rules.isOnTime(r.closed_at, r.due_at)).length;
  const backlog = rows.filter((r) => svcOk(r) && BACKLOG_STATUSES.includes(r.status)).length;
  const overdue = rows.filter((r) => svcOk(r) && BACKLOG_STATUSES.includes(r.status) && r.status !== 'NEED_FIX'
    && now.getTime() > Date.parse(r.due_at)).length;
  const officers = ctx.db.prepare("SELECT username, name FROM users WHERE role='officer' ORDER BY username").all();
  const workload = officers.map((u) => ({
    username: u.username, name: u.name,
    count: rows.filter((r) => r.status === 'IN_REVIEW' && r.owner === u.username).length,
  }));
  const denom = ctx.bug('B10') ? received : closed; // B10: หารด้วย "รับเรื่อง" แทน "ปิดงาน"
  const ontimePct = ctx.rules.pct1(onTime, denom);
  return { received, closed, onTime, ontimePct, backlog, overdue, workload };
}

function register(app, ctx) {
  // รับค่า period/service พร้อมตรวจ · คืน null ถ้าตอบ error แล้ว
  const parseQuery = (req, res) => {
    const period = req.query.period === undefined ? defaultPeriod(ctx) : req.query.period;
    const service = req.query.service === undefined ? 'ALL' : req.query.service;
    if (typeof period !== 'string' || !PERIOD_RE.test(period)) { ctx.fail(res, 'INVALID_PERIOD'); return null; }
    if (typeof service !== 'string' || !SERVICES.includes(service)) { ctx.fail(res, 'INVALID_SERVICE'); return null; }
    return { period, service };
  };

  app.get('/api/dashboard', ctx.requireApi('executive'), (req, res) => {
    const q = parseQuery(req, res);
    if (!q) return;
    const k = computeKpi(ctx, q.period, q.service);
    res.status(200).json({
      received: k.received, closed: k.closed, onTime: k.onTime, ontimePct: k.ontimePct,
      backlog: k.backlog, overdue: k.overdue,
      workload: k.workload.map((w) => ({ username: w.username, count: w.count })),
    });
  });

  app.get('/api/dashboard/export', ctx.requireApi('executive'), async (req, res, next) => {
    try {
      const q = parseQuery(req, res);
      if (!q) return;
      const format = req.query.format;
      if (format !== 'xlsx' && format !== 'pdf') return ctx.fail(res, 'BAD_REQUEST');
      const k = computeKpi(ctx, q.period, q.service);
      const fname = `dashboard-${q.period}-${q.service}.${format}`;
      let buf; let type;
      if (format === 'xlsx') {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Dashboard');
        ws.addRow(['ตัวชี้วัด', 'ค่า']);
        ws.addRow(['รับเรื่อง', String(k.received)]);
        ws.addRow(['ปิดงาน', String(k.closed)]);
        ws.addRow(['ทันกำหนด %', ctx.rules.formatPct(k.ontimePct)]);
        ws.addRow(['งานคงค้าง', String(k.backlog)]);
        ws.addRow(['เกินกำหนดคงค้าง', String(k.overdue)]);
        buf = Buffer.from(await wb.xlsx.writeBuffer());
        type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else {
        const pct = k.ontimePct === null ? '-' : k.ontimePct.toFixed(1) + '%';
        buf = ctx.pdf.makeSimplePdf([
          'e-Service dashboard report (simulated municipality)',
          `period=${q.period} service=${q.service}`,
          `kpi received=${k.received} closed=${k.closed} ontime=${pct} backlog=${k.backlog} overdue=${k.overdue}`,
        ]);
        type = 'application/pdf';
      }
      ctx.audit(req.user, { event: 'EXPORT', detail: `${format} ${q.period} ${q.service}` });
      res.status(200);
      res.set('Content-Type', type);
      res.set('Content-Disposition', `attachment; filename="${fname}"`);
      res.send(buf);
    } catch (e) { next(e); }
  });

  pages.register(app, ctx, computeKpi, defaultPeriod);
}

module.exports = register;
module.exports.register = register;
module.exports.computeKpi = computeKpi;
