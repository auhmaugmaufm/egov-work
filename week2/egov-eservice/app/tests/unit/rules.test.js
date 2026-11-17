'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const bugmode = require('../../src/core/bugmode');
const r = require('../../src/core/rules');

const H = new Set(['2026-12-07', '2026-12-10', '2026-12-31', '2027-01-01']);
const T = (d, t = '16:30:00') => `${d}T${t}+07:00`;
beforeEach(() => bugmode.setForTest([]));
afterEach(() => bugmode.setForTest([]));

test('computeDueAt ปกติและ B03', () => {
  const j = new Set([...H, '2026-12-02']);
  const rows = [
    ['2026-12-01T09:00:00+07:00', 3, H, '2026-12-04T16:30:00+07:00', '2026-12-04T16:30:00+07:00'],
    ['2026-12-01T16:29:00+07:00', 3, H, '2026-12-04T16:30:00+07:00', '2026-12-04T16:30:00+07:00'],
    ['2026-12-01T16:29:59+07:00', 3, H, '2026-12-04T16:30:00+07:00', null],
    ['2026-12-01T16:30:00+07:00', 3, H, '2026-12-08T16:30:00+07:00', '2026-12-07T16:30:00+07:00'],
    ['2026-12-04T10:00:00+07:00', 3, H, '2026-12-11T16:30:00+07:00', '2026-12-09T16:30:00+07:00'],
    ['2026-12-05T10:00:00+07:00', 3, H, '2026-12-14T16:30:00+07:00', '2026-12-10T16:30:00+07:00'],
    ['2026-12-01T09:00:00+07:00', 10, H, '2026-12-17T16:30:00+07:00', null],
    ['2026-12-01T09:00:00+07:00', 15, H, '2026-12-24T16:30:00+07:00', null],
    ['2026-12-29T10:00:00+07:00', 3, H, '2027-01-05T16:30:00+07:00', '2027-01-01T16:30:00+07:00'],
    ['2026-12-31T23:59:00+07:00', 3, H, '2027-01-07T16:30:00+07:00', '2027-01-06T16:30:00+07:00'],
    ['2026-12-01T09:00:00+07:00', 3, j, '2026-12-08T16:30:00+07:00', '2026-12-04T16:30:00+07:00'],
  ];
  for (const [p, s, h, n, b] of rows) {
    bugmode.setForTest([]);
    assert.equal(r.computeDueAt(p, s, h), n, `normal ${p} ${s}`);
    if (b) { bugmode.setForTest(['B03']); assert.equal(r.computeDueAt(p, s, h), b, `B03 ${p} ${s}`); }
  }
  assert.equal(r.computeD0('2026-12-31T23:59:00+07:00', H), '2027-01-04');
});

test('extendDueForPause', () => {
  const rows = [
    ['2026-12-04T16:30:00+07:00', '2026-12-02T11:00:00+07:00', '2026-12-03T10:00:00+07:00', '2026-12-08T16:30:00+07:00', '2026-12-07T16:30:00+07:00', '2026-12-04T16:30:00+07:00'],
    ['2026-11-27T16:30:00+07:00', '2026-11-27T14:00:00+07:00', '2026-12-01T09:00:00+07:00', '2026-12-01T16:30:00+07:00', null, '2026-11-27T16:30:00+07:00'],
    ['2026-11-27T16:30:00+07:00', '2026-11-27T14:00:00+07:00', '2026-12-04T10:00:00+07:00', '2026-12-04T16:30:00+07:00'],
    ['2026-12-04T16:30:00+07:00', '2026-12-02T09:00:00+07:00', '2026-12-02T15:00:00+07:00', '2026-12-04T16:30:00+07:00'],
    ['2026-12-04T16:30:00+07:00', '2026-12-04T10:00:00+07:00', '2026-12-08T17:00:00+07:00', '2026-12-08T16:30:00+07:00'],
    ['2026-11-26T16:30:00+07:00', '2026-11-24T11:00:00+07:00', '2026-11-25T10:00:00+07:00', '2026-11-27T16:30:00+07:00'],
    ['2026-12-02T16:30:00+07:00', '2026-11-30T14:00:00+07:00', '2026-12-01T08:30:00+07:00', '2026-12-03T16:30:00+07:00'],
  ];
  for (const [d, ra, rs, n, b3, b4] of rows) {
    bugmode.setForTest([]);
    assert.equal(r.extendDueForPause(d, ra, rs, H), n);
    if (b3) { bugmode.setForTest(['B03']); assert.equal(r.extendDueForPause(d, ra, rs, H), b3); }
    if (b4) { bugmode.setForTest(['B04']); assert.equal(r.extendDueForPause(d, ra, rs, H), b4); }
  }
  bugmode.setForTest(['B04']);
  assert.equal(r.extendDueForPause('2026-11-27T16:30:00+07:00', '2026-11-27T14:00:00+07:00', '2026-12-01T09:00:00+07:00', new Set()), '2026-11-27T16:30:00+07:00');
});

test('countBusinessDays / helpers', () => {
  assert.equal(r.countBusinessDays('2026-11-27', '2026-12-01', H), 2);
  assert.equal(r.countBusinessDays('2026-11-27', '2026-12-04', H), 5);
  assert.equal(r.countBusinessDays('2026-12-02', '2026-12-02', H), 0);
  assert.equal(r.countBusinessDays('2026-12-04', '2026-12-08', H), 1);
  assert.equal(r.countBusinessDays('2026-12-04', '2026-12-08', H, true), 2);
  assert.equal(r.bkkDate('2026-11-30T17:00:00Z'), '2026-12-01');
  assert.equal(r.bkkTime('2026-11-30T17:00:05Z'), '00:00:05');
  assert.equal(r.addBusinessDays('2026-12-01', 0, H), '2026-12-01');
  assert.equal(r.dayOfWeek('2026-12-06'), 0);
});

const D = (s) => new Date(s);
const lv = (due, now, status = 'IN_REVIEW') => r.slaLevel({ status, due_at: due }, D(now), H);
const rem = (due, now) => r.remainingBusinessDays(D(now), due, H);

test('slaLevel / remainingBusinessDays', () => {
  const A = T('2026-12-04');
  const rows = [
    [A, '2026-12-01T09:00:00+07:00', 'normal', 3], [A, '2026-12-02T09:00:00+07:00', 'normal', 2],
    [A, '2026-12-03T09:00:00+07:00', 'near', 1], [A, '2026-12-04T16:30:00+07:00', 'near', 0],
    [A, '2026-12-04T16:30:01+07:00', 'overdue'], [A, '2026-12-04T16:31:00+07:00', 'overdue'],
    [A, '2026-12-05T10:00:00+07:00', 'overdue'],
    [T('2026-12-08'), '2026-12-03T09:00:00+07:00', 'normal', 2], [T('2026-12-08'), '2026-12-04T09:00:00+07:00', 'near', 1],
    [T('2026-12-08'), '2026-12-08T16:30:00+07:00', 'near', 0], [T('2026-12-08'), '2026-12-08T16:31:00+07:00', 'overdue'],
    [T('2026-12-08'), '2026-12-05T10:00:00+07:00', 'near', 1],
    [T('2026-11-30'), '2026-12-01T09:00:00+07:00', 'overdue'],
    [T('2026-12-01'), '2026-12-01T09:00:00+07:00', 'near', 0], [T('2026-12-01'), '2026-12-01T16:30:00+07:00', 'near', 0],
    [T('2026-12-01'), '2026-12-01T16:31:00+07:00', 'overdue'],
    [T('2026-12-02'), '2026-12-01T09:00:00+07:00', 'near', 1], [T('2026-12-03'), '2026-12-01T09:00:00+07:00', 'normal', 2],
    [T('2026-12-09'), '2026-12-08T09:00:00+07:00', 'near', 1, 'APPROVED'],
  ];
  for (const [due, now, level, days, st] of rows) {
    assert.equal(lv(due, now, st), level, `${due} ${now}`);
    if (days !== undefined) assert.equal(rem(due, now), days, `rem ${due} ${now}`);
  }
  // สเปก 2.1 + ตารางตรวจข้อ 3: B03 นับ 7 ธ.ค. → เหลือ 2 วัน → normal (ดู QUESTIONS-B02.md)
  bugmode.setForTest(['B03']);
  assert.equal(lv(T('2026-12-08'), '2026-12-04T09:00:00+07:00'), 'normal');
  bugmode.setForTest([]);
  assert.equal(r.slaLevel({ status: 'NEED_FIX', due_at: T('2026-11-27') }, D('2026-12-01T09:00:00+07:00'), H), 'paused');
  for (const s of ['COMPLETED', 'REJECTED', 'CANCELLED']) assert.equal(lv(T('2026-11-27'), '2026-12-01T09:00:00+07:00', s), 'closed');
  assert.equal(r.slaLevel({ status: 'DRAFT', due_at: null }, new Date(), H), null);
});

test('isOnTime', () => {
  assert.equal(r.isOnTime(T('2026-12-03', '16:29:59'), T('2026-12-03')), true);
  assert.equal(r.isOnTime(T('2026-12-03'), T('2026-12-03')), true);
  assert.equal(r.isOnTime(T('2026-12-03', '16:30:01'), T('2026-12-03')), false);
  assert.equal(r.isOnTime(T('2026-11-19', '10:00:00'), T('2026-11-17')), false);
  assert.equal(r.isOnTime(T('2026-11-18', '16:00:00'), T('2026-11-18')), true);
});

test('calcFee', () => {
  const s3 = { fee: 1000, fee_per_sqm: 10 };
  const f = (id, inp, svc) => r.calcFee(id, inp, svc);
  for (const a of [0, -1, '', 1.5, 'abc', undefined]) assert.deepEqual(f('SV-03', { areaSqm: a }, s3), { ok: false, code: 'INVALID_AREA' });
  assert.deepEqual(f('SV-03', {}, s3), { ok: false, code: 'INVALID_AREA' });
  for (const [a, fee] of [[1, 1000], [100, 1000], [101, 1010], ['101', 1010], [102, 1020], [250, 2500], [300, 3000], [499, 4990], [500, 5000]]) {
    assert.deepEqual(f('SV-03', { areaSqm: a }, s3), { ok: true, fee });
  }
  assert.deepEqual(f('SV-03', { areaSqm: 501 }, s3), { ok: false, code: 'AREA_TOO_LARGE' });
  bugmode.setForTest(['B01']);
  assert.equal(f('SV-03', { areaSqm: 101 }, s3).fee, 1000);
  for (const [a, fee] of [[1, 1000], [100, 1000], [102, 1020], [250, 2500], [500, 5000]]) assert.equal(f('SV-03', { areaSqm: a }, s3).fee, fee);
  assert.equal(f('SV-03', { areaSqm: 501 }, s3).code, 'AREA_TOO_LARGE');
  assert.equal(f('SV-03', { areaSqm: 0 }, s3).code, 'INVALID_AREA');
  bugmode.setForTest([]);
  const s1 = { fee: 20 };
  for (const q of [0, 6, '', undefined]) assert.deepEqual(f('SV-01', { qty: q }, s1), { ok: false, code: 'INVALID_QTY' });
  for (const q of [1, 2, 3, 4, 5]) assert.equal(f('SV-01', { qty: q }, s1).fee, 20 * q);
  assert.equal(f('SV-01', { qty: 5 }, { fee: 25 }).fee, 125);
  assert.equal(f('SV-01', { qty: 1 }, { fee: 25 }).fee, 25);
  assert.equal(f('SV-02', {}, { fee: 500 }).fee, 500);
  assert.equal(f('SV-02', {}, { fee: 600 }).fee, 600);
  assert.deepEqual(f('SV-09', {}, s1), { ok: false, code: 'INVALID_SERVICE' });
  assert.deepEqual(f('SV-01', { qty: 1 }, undefined), { ok: false, code: 'INVALID_SERVICE' });
});

test('toInt', () => {
  assert.equal(r.toInt(5), 5); assert.equal(r.toInt(' 7 '), 7); assert.equal(r.toInt('-3'), -3);
  for (const v of ['', null, 1.5, 'abc', undefined]) assert.equal(r.toInt(v), null);
});

test('เลขบัตร ชื่อ', () => {
  for (const s of ['1101700123456', '3100600987659', '5500400111221', '1909900555015']) assert.equal(r.isValidThaiId(s), true);
  for (const s of ['110170012345', '11017001234567', '1101700123457', '11017001234ab', '', null]) assert.equal(r.isValidThaiId(s), false);
  const ids = [['1101700123456', '1-1017-00123-45-6', 'X-XXXX-XXXXX-45-6'], ['3100600987659', '3-1006-00987-65-9', 'X-XXXX-XXXXX-65-9'],
    ['5500400111221', '5-5004-00111-22-1', 'X-XXXX-XXXXX-22-1'], ['1909900555015', '1-9099-00555-01-5', 'X-XXXX-XXXXX-01-5']];
  for (const [i, f, m] of ids) { assert.equal(r.formatId(i), f); assert.equal(r.maskId(i), m); }
  assert.equal(r.maskName('สมชาย ใจดี'), 'สมชาย ใ***');
  assert.equal(r.maskName('สมหญิง รักไทย'), 'สมหญิง ร***');
  assert.equal(r.maskName('มานะ'), 'มานะ ***');
});

test('เอกสาร วันที่ เลขรัน', () => {
  const v = [['SV-01', '2026-12-01T09:00:00+07:00', '2027-02-28'], ['SV-01', '2026-11-05T10:00:00+07:00', '2027-02-02'],
    ['SV-02', '2026-12-01T09:00:00+07:00', '2027-11-30'], ['SV-03', '2026-12-01T09:00:00+07:00', '2027-11-30'],
    ['SV-01', '2028-02-29T10:00:00+07:00', '2028-05-28'], ['SV-02', '2028-02-29T10:00:00+07:00', '2029-02-27']];
  for (const [s, t, o] of v) assert.equal(r.docValidUntil(s, t), o);
  assert.equal(r.isDocExpired('2027-02-28', D('2027-02-28T23:59:00+07:00')), false);
  assert.equal(r.isDocExpired('2027-02-28', D('2027-03-01T00:00:00+07:00')), true);
  assert.equal(r.isDocExpired('2027-02-02', D('2027-02-03T00:00:00+07:00')), true);
  assert.equal(r.fixDeadline('2026-11-27T14:00:00+07:00'), '2026-12-04T14:00:00+07:00');
  assert.equal(r.fixDeadline('2026-12-02T11:00:00+07:00'), '2026-12-09T11:00:00+07:00');
  assert.equal(r.beYear('2026-12-31T23:59:00+07:00'), 2569);
  assert.equal(r.beYear('2027-01-01T00:00:00+07:00'), 2570);
  assert.equal(r.beYear('2026-12-31T17:00:00Z'), 2570);
  assert.equal(r.beYear('2028-02-29T10:00:00+07:00'), 2571);
  assert.equal(r.fmtCaseNo(2569, 31), 'EG-2569-000031');
  assert.equal(r.fmtReceiptNo(2570, 1), 'RC-2570-000001');
  assert.equal(r.fmtDocNo(2571, 1), 'DOC-2571-000001');
  assert.equal(r.fmtDraftId(3), 'DR-0003');
  assert.equal(r.fmtPayRef(2), 'PP-0002');
});

test('รูปแบบแสดงผล', () => {
  assert.equal(r.formatThaiDateTime('2026-12-04T16:30:00+07:00'), '4 ธ.ค. 2569 16:30');
  assert.equal(r.formatThaiDateTime('2027-01-05T16:30:00+07:00'), '5 ม.ค. 2570 16:30');
  assert.equal(r.formatThaiDateTime('2026-12-01T09:15:00+07:00'), '1 ธ.ค. 2569 09:15');
  assert.equal(r.formatThaiDateTime(D('2026-12-01T02:00:00Z')), '1 ธ.ค. 2569 09:00');
  assert.equal(r.formatThaiDate('2027-02-28'), '28 ก.พ. 2570');
  assert.equal(r.formatThaiDate('2027-02-02'), '2 ก.พ. 2570');
  assert.equal(r.formatBaht(20), '฿20'); assert.equal(r.formatBaht(1010), '฿1,010'); assert.equal(r.formatBaht(100000), '฿100,000');
  for (const [n, d, p, s] of [[6, 7, 85.7, '85.7%'], [2, 3, 66.7], [7, 8, 87.5], [1, 1, 100, '100.0%'], [6, 26, 23.1], [7, 30, 23.3], [0, 3, 0, '0.0%'], [1, 16, 6.3]]) {
    assert.equal(r.pct1(n, d), p);
    if (s) assert.equal(r.formatPct(p), s);
  }
  assert.equal(r.pct1(0, 0), null);
  assert.equal(r.formatPct(null), '–');
});

test('detectFileType / missingDocs / reasonOk / stepLabel / serviceLabel', () => {
  assert.equal(r.detectFileType(Buffer.from('%PDF-1.4 x')), 'pdf');
  assert.equal(r.detectFileType(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])), 'jpeg');
  assert.equal(r.detectFileType(Buffer.from([0x89, 0x50, 0x4E, 0x47, 13, 10, 26, 10])), 'png');
  assert.equal(r.detectFileType(Buffer.from('hello')), null);
  assert.equal(r.detectFileType(Buffer.from('MZ\x90\x00')), null);
  assert.equal(r.detectFileType(Buffer.alloc(0)), null);
  assert.deepEqual(r.missingDocs('SV-03', ['id-card']), ['แบบแปลน', 'โฉนด']);
  assert.deepEqual(r.missingDocs('SV-03', ['id-card', 'deed']), ['แบบแปลน']);
  assert.deepEqual(r.missingDocs('SV-02', ['id-card']), ['แผนที่ตั้ง']);
  assert.deepEqual(r.missingDocs('SV-02', ['id-card', 'map']), []);
  assert.deepEqual(r.missingDocs('SV-01', []), ['บัตรประชาชน']);
  assert.deepEqual(r.missingDocs('SV-02', ['id-card', 'map', 'extra']), []);
  assert.equal(r.reasonOk('x'.repeat(9)), false);
  assert.equal(r.reasonOk('x'.repeat(10)), true);
  assert.equal(r.reasonOk(' '.repeat(10)), false);
  assert.equal(r.reasonOk('  xxxxxxxxxx  '), true);
  assert.equal(r.stepLabel('SV-03', 1), 'ขั้นตอน 1/3 · ฝ่ายทะเบียน');
  assert.equal(r.stepLabel('SV-03', 2), 'ขั้นตอน 2/3 · ฝ่ายโยธา');
  assert.equal(r.stepLabel('SV-03', 3), 'ขั้นตอน 3/3 · หัวหน้าฝ่าย');
  assert.equal(r.stepLabel('SV-01', null), null);
  assert.equal(r.serviceLabel('SV-01'), 'SV-01 ขอหนังสือรับรอง');
  assert.equal(r.MAX_FILE_BYTES, 5242880);
});

test('canViewCaseFiles', () => {
  const o = (dept) => ({ role: 'officer', dept });
  assert.equal(r.canViewCaseFiles(o('registry'), { visited_depts: 'registry' }), 'ok');
  assert.equal(r.canViewCaseFiles(o('works'), { visited_depts: 'registry' }), 'forbidden');
  assert.equal(r.canViewCaseFiles(o('works'), { visited_depts: 'registry,works' }), 'ok');
  assert.equal(r.canViewCaseFiles({ role: 'head' }, { visited_depts: '' }), 'ok');
  assert.equal(r.canViewCaseFiles({ role: 'citizen', id: 2 }, { applicant_id: 2 }), 'ok');
  assert.equal(r.canViewCaseFiles({ role: 'citizen', id: 1 }, { applicant_id: 2 }), 'notfound');
  for (const role of ['executive', 'auditor', 'admin']) assert.equal(r.canViewCaseFiles({ role }, { visited_depts: 'registry' }), 'forbidden');
  assert.equal(r.canViewCaseFiles(null, {}), 'forbidden');
});

test('selectQueue / canClaim', () => {
  const mk = (n, status, dept, owner, due) => ({ case_no: 'EG-2569-0000' + n, status, current_dept: dept, owner: owner === '-' ? null : owner, due_at: T(due) });
  const rows = [
    mk(10, 'IN_REVIEW', 'works', '-', '2026-12-03'), mk(11, 'PENDING_APPROVAL', 'head', '-', '2026-12-08'),
    mk(12, 'IN_REVIEW', 'registry', 'off.reg2', '2026-12-11'), mk(13, 'IN_REVIEW', 'registry', 'off.reg2', '2026-12-04'),
    mk(14, 'PENDING_APPROVAL', 'head', '-', '2026-12-04'), mk(15, 'IN_REVIEW', 'registry', 'off.reg2', '2026-12-04'),
    mk(16, 'IN_REVIEW', 'registry', 'off.reg2', '2026-12-08'), mk(17, 'NEED_FIX', 'registry', 'off.reg1', '2026-11-27'),
    mk(18, 'IN_REVIEW', 'registry', 'off.reg2', '2026-12-09'), mk(19, 'APPROVED', 'registry', '-', '2026-12-09'),
    mk(20, 'IN_REVIEW', 'registry', 'off.reg1', '2026-11-30'), mk(21, 'IN_REVIEW', 'registry', 'off.reg2', '2026-12-11'),
    mk(22, 'IN_REVIEW', 'registry', 'off.reg1', '2026-12-01'), mk(23, 'IN_REVIEW', 'registry', 'off.reg1', '2026-12-03'),
    mk(24, 'SUBMITTED', 'registry', '-', '2026-12-02'), mk(25, 'IN_REVIEW', 'registry', 'off.reg2', '2026-12-03'),
    mk(26, 'IN_REVIEW', 'registry', 'off.reg2', '2026-12-03'), mk(27, 'IN_REVIEW', 'registry', 'off.reg2', '2026-12-04'),
    mk(28, 'SUBMITTED', 'registry', '-', '2026-12-04'), mk(29, 'SUBMITTED', 'registry', '-', '2026-12-04'),
    mk(30, 'SUBMITTED', 'registry', '-', '2026-12-04'), mk('05', 'COMPLETED', 'registry', '-', '2026-11-06'),
  ];
  const snapshot = JSON.stringify(rows);
  const seq = (u, f) => r.selectQueue(rows, u, f).map((x) => x.case_no.slice(-2)).join(' ');
  const reg1 = { role: 'officer', dept: 'registry', username: 'off.reg1' };
  const reg2 = { role: 'officer', dept: 'registry', username: 'off.reg2' };
  assert.equal(seq(reg1, 'all'), '20 22 24 23 25 26 13 15 27 28 29 30 16 18 19 12 21');
  assert.equal(r.selectQueue(rows, reg1, 'all').length, 17);
  assert.equal(seq(reg1, 'unclaimed'), '24 28 29 30');
  assert.equal(seq(reg1, 'mine'), '20 22 23');
  assert.equal(seq(reg2, 'mine'), '25 26 13 15 27 16 18 12 21');
  assert.equal(seq({ role: 'officer', dept: 'works', username: 'off.works1' }, 'all'), '10');
  const head = { role: 'head', dept: null, username: 'head1' };
  assert.equal(seq(head, 'all'), '20 22 24 10 23 25 26 13 15 27 28 29 30 16 18 19 12 21');
  assert.equal(r.selectQueue(rows, head, 'all').length, 18);
  assert.equal(JSON.stringify(rows), snapshot);
  const by = (n) => rows.find((x) => x.case_no.endsWith(n));
  assert.equal(r.canClaim(reg1, by('24')), true);
  assert.equal(r.canClaim(reg1, by('19')), false);
  assert.equal(r.canClaim(reg1, by('20')), false);
  const w1 = { role: 'officer', dept: 'works', username: 'off.works1' };
  assert.equal(r.canClaim(w1, by('10')), true);
  assert.equal(r.canClaim(reg1, by('10')), false);
  assert.equal(r.canClaim(head, by('24')), false);
});

test('re-export constants', () => {
  assert.equal(r.OTP_CODE, '123456');
  assert.ok(r.MONTH_TH.length === 12);
});
