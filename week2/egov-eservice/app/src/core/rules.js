'use strict';
const C = require('./constants');
const { toIso } = require('./clock');
const { bug } = require('./bugmode');

const H7 = 7 * 3600 * 1000;
const p2 = (n) => String(n).padStart(2, '0');
const ms = (x) => (x instanceof Date ? x.getTime() : typeof x === 'number' ? x : Date.parse(x));

// ---------- 2.1 เวลาและวันทำการ ----------
function bkkParts(x) {
  const d = new Date(ms(x) + H7);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds() };
}
function bkkDate(x) { const t = bkkParts(x); return `${t.y}-${p2(t.m)}-${p2(t.d)}`; }
function bkkTime(x) { const t = bkkParts(x); return `${p2(t.hh)}:${p2(t.mm)}:${p2(t.ss)}`; }
function isoAt(day, hms) { return day + 'T' + hms + '+07:00'; }
function dayMs(day) { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d); }
function fromDayMs(v) { const t = new Date(v); return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`; }
function addDays(day, n) { return fromDayMs(dayMs(day) + n * 86400000); }
function dayOfWeek(day) { return new Date(dayMs(day)).getUTCDay(); }
function isBusinessDay(day, hol, ignoreHolidays = false) {
  const w = dayOfWeek(day);
  return w >= 1 && w <= 5 && (ignoreHolidays || !hol.has(day));
}
function nextBusinessDay(day, hol, ig = false) {
  let d = addDays(day, 1);
  while (!isBusinessDay(d, hol, ig)) d = addDays(d, 1);
  return d;
}
function addBusinessDays(day, n, hol, ig = false) {
  let d = day;
  for (let i = 0; i < n; i++) d = nextBusinessDay(d, hol, ig);
  return d;
}
function countBusinessDays(fromExcl, toIncl, hol, ig = false) {
  let n = 0;
  let d = addDays(fromExcl, 1);
  while (d <= toIncl) {
    if (isBusinessDay(d, hol, ig)) n++;
    d = addDays(d, 1);
  }
  return n;
}
function computeD0(paidAt, hol, ig = false) {
  const d = bkkDate(paidAt);
  if (isBusinessDay(d, hol, ig) && bkkTime(paidAt) < '16:30:00') return d;
  return nextBusinessDay(d, hol, ig);
}
function computeDueAt(paidAt, slaDays, hol) {
  const ig = bug('B03');
  return isoAt(addBusinessDays(computeD0(paidAt, hol, ig), slaDays, hol, ig), '16:30:00');
}
function extendDueForPause(dueAt, returnedAt, resubmittedAt, hol) {
  if (bug('B04')) return dueAt;
  const ig = bug('B03');
  const n = countBusinessDays(bkkDate(returnedAt), bkkDate(resubmittedAt), hol, ig);
  if (n === 0) return dueAt;
  return isoAt(addBusinessDays(bkkDate(dueAt), n, hol, ig), bkkTime(dueAt));
}
function remainingBusinessDays(now, dueAt, hol) {
  return countBusinessDays(bkkDate(now), bkkDate(dueAt), hol, bug('B03'));
}
function slaLevel(row, now, hol) {
  if (C.FINAL_STATUSES.includes(row.status)) return 'closed';
  if (row.status === 'NEED_FIX') return 'paused';
  if (row.status === 'DRAFT' || row.status === 'PENDING_PAYMENT' || !row.due_at) return null;
  if (now.getTime() > Date.parse(row.due_at)) return 'overdue';
  if (remainingBusinessDays(now, row.due_at, hol) <= 1) return 'near';
  return 'normal';
}
function isOnTime(closedAt, dueAt) { return Date.parse(closedAt) <= Date.parse(dueAt); }
function fixDeadline(returnedAt) { return toIso(ms(returnedAt) + 168 * 3600 * 1000); }

// ---------- 2.2 ค่าธรรมเนียม · เลขบัตร · ชื่อ · เลขรัน ----------
function toInt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v === 'string') { const s = v.trim(); return /^-?\d+$/.test(s) ? parseInt(s, 10) : null; }
  return null;
}
function calcFee(serviceId, { qty, areaSqm } = {}, svc) {
  if (!svc || !['SV-01', 'SV-02', 'SV-03'].includes(serviceId)) return { ok: false, code: 'INVALID_SERVICE' };
  if (serviceId === 'SV-01') {
    const q = toInt(qty);
    if (q === null || q < 1 || q > 5) return { ok: false, code: 'INVALID_QTY' };
    return { ok: true, fee: svc.fee * q };
  }
  if (serviceId === 'SV-02') return { ok: true, fee: svc.fee };
  const a = toInt(areaSqm);
  if (a === null || a < 1) return { ok: false, code: 'INVALID_AREA' };
  if (a > 500) return { ok: false, code: 'AREA_TOO_LARGE' };
  const over = bug('B01') ? a > 101 : a >= 101;
  return { ok: true, fee: over ? svc.fee + svc.fee_per_sqm * (a - 100) : svc.fee };
}
function isValidThaiId(s) {
  if (typeof s !== 'string' || !/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (13 - i);
  return Number(s[12]) === (11 - (sum % 11)) % 10;
}
function formatId(id) { return `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}`; }
function maskId(id) { return 'X-XXXX-XXXXX-' + id.slice(10, 12) + '-' + id[12]; }
function maskName(full) {
  const t = String(full ?? '').trim();
  const i = t.search(/\s/);
  if (i < 0) return t + ' ***';
  const first = t.slice(0, i);
  const last = t.slice(i).trim();
  if (!last) return first + ' ***';
  return first + ' ' + [...last][0] + '***';
}
function beYear(x) { return Number(bkkDate(x).slice(0, 4)) + 543; }
const pad = (n, w) => String(n).padStart(w, '0');
const fmtCaseNo = (be, seq) => `EG-${be}-${pad(seq, 6)}`;
const fmtReceiptNo = (be, seq) => `RC-${be}-${pad(seq, 6)}`;
const fmtDocNo = (be, seq) => `DOC-${be}-${pad(seq, 6)}`;
const fmtDraftId = (seq) => `DR-${pad(seq, 4)}`;
const fmtPayRef = (seq) => `PP-${pad(seq, 4)}`;

// ---------- 2.3 เอกสาร · ไฟล์ · สิทธิ์ · คิว ----------
function docValidUntil(serviceId, issuedAt) {
  const d = bkkDate(issuedAt);
  if (serviceId === 'SV-01') return addDays(d, 89);
  const y = Number(d.slice(0, 4));
  let md = d.slice(5);
  if (md === '02-29') md = '02-28';
  return addDays(`${y + 1}-${md}`, -1);
}
function isDocExpired(validUntil, now) { return bkkDate(now) > validUntil; }
const MAX_FILE_BYTES = 5242880;
const MAX_FILES = 5;
const REASON_MIN = 10;
const MIME = { pdf: 'application/pdf', jpeg: 'image/jpeg', png: 'image/png' };
function detectFileType(buf) {
  if (!buf || buf.length < 3) return null;
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg';
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png';
  return null;
}
function missingDocs(serviceId, docKeys) {
  return (C.REQUIRED_DOCS[serviceId] || []).filter((k) => !docKeys.includes(k)).map((k) => C.DOC_KEY_TH[k]);
}
function canViewCaseFiles(user, row) {
  if (!user) return 'forbidden';
  if (user.role === 'citizen') return row.applicant_id === user.id ? 'ok' : 'notfound';
  if (user.role === 'head') return 'ok';
  if (user.role === 'officer') return String(row.visited_depts || '').split(',').includes(user.dept) ? 'ok' : 'forbidden';
  return 'forbidden';
}
function reasonOk(s) { return String(s ?? '').trim().length >= REASON_MIN; }
function selectQueue(rows, user, filter) {
  const depts = user.role === 'head' ? ['registry', 'works'] : [user.dept];
  let out = rows.filter((r) => ['SUBMITTED', 'IN_REVIEW', 'APPROVED'].includes(r.status) && depts.includes(r.current_dept));
  if (filter === 'unclaimed') out = out.filter((r) => ['SUBMITTED', 'IN_REVIEW'].includes(r.status) && !r.owner);
  else if (filter === 'mine') out = out.filter((r) => r.status === 'IN_REVIEW' && r.owner === user.username);
  return out.sort((a, b) => {
    const d = Date.parse(a.due_at) - Date.parse(b.due_at);
    if (d !== 0) return d;
    return a.case_no < b.case_no ? -1 : a.case_no > b.case_no ? 1 : 0;
  });
}
function canClaim(user, row) {
  return user.role === 'officer' && row.current_dept === user.dept &&
    (row.status === 'SUBMITTED' || (row.status === 'IN_REVIEW' && !row.owner));
}
function stepLabel(serviceId, step) {
  if (serviceId !== 'SV-03') return null;
  return { 1: 'ขั้นตอน 1/3 · ฝ่ายทะเบียน', 2: 'ขั้นตอน 2/3 · ฝ่ายโยธา', 3: 'ขั้นตอน 3/3 · หัวหน้าฝ่าย' }[step] || null;
}
function serviceLabel(id) { return `${id} ${C.SERVICE_NAME[id]}`; }

// ---------- 2.4 รูปแบบแสดงผล ----------
function formatThaiDateTime(x) {
  const t = bkkParts(x);
  return `${t.d} ${C.MONTH_TH[t.m - 1]} ${t.y + 543} ${p2(t.hh)}:${p2(t.mm)}`;
}
function formatThaiDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${C.MONTH_TH[m - 1]} ${y + 543}`;
}
function formatBaht(n) { return '฿' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function pct1(num, den) { return den === 0 ? null : Math.floor((num * 2000 + den) / (2 * den)) / 10; }
function formatPct(x) { return x === null ? '–' : x.toFixed(1) + '%'; }

module.exports = {
  bkkDate, bkkTime, isoAt, addDays, dayOfWeek, isBusinessDay, nextBusinessDay, addBusinessDays, countBusinessDays,
  computeD0, computeDueAt, extendDueForPause, remainingBusinessDays, slaLevel, isOnTime, fixDeadline,
  toInt, calcFee, isValidThaiId, formatId, maskId, maskName, beYear,
  fmtCaseNo, fmtReceiptNo, fmtDocNo, fmtDraftId, fmtPayRef,
  docValidUntil, isDocExpired, MAX_FILE_BYTES, MAX_FILES, REASON_MIN, MIME, detectFileType, missingDocs,
  canViewCaseFiles, reasonOk, selectQueue, canClaim, stepLabel, serviceLabel,
  formatThaiDateTime, formatThaiDate, formatBaht, pct1, formatPct,
  ...C,
};
