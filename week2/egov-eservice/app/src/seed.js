'use strict';
// B03 · Seed ข้อมูลตาม TEST-DATA (ค่าตายตัว ลอกตรงตัว) · ไม่มี BUG_MODE · ไม่สร้าง Audit / แจ้งเตือน
// ห้ามใช้ ctx.rules / ctx.views · ห้ามคำนวณกำหนดเสร็จ (ค่าตายตัวตามตาราง)
// เรียกโดย ctx.resetAll() ภายใน transaction หลังล้างทุกตาราง

const STAFF_PASSWORD = 'Test@1234';
const SEED_CREATED = '2026-10-01T09:00:00+07:00';
const CONSENT_AT = '2026-10-01T09:00:00+07:00';

// 1. ผู้ใช้ (id ตายตัว 1–11)
const USERS = [
  { id: 1, kind: 'citizen', name: 'สมชาย ใจดี', role: 'citizen', idNo: '1101700123456', mobile: '0812345678', registered: 1, consent: CONSENT_AT },
  { id: 2, kind: 'citizen', name: 'สมหญิง รักไทย', role: 'citizen', idNo: '3100600987659', mobile: '0823456789', registered: 1, consent: CONSENT_AT },
  { id: 3, kind: 'citizen', name: 'มานะ ตั้งใจ', role: 'citizen', idNo: '5500400111221', mobile: null, registered: 0, consent: null },
  { id: 4, kind: 'citizen', name: 'ปิติ มีสุข', role: 'citizen', idNo: '1909900555015', mobile: '0834567890', registered: 1, consent: CONSENT_AT },
  { id: 5, kind: 'staff', username: 'off.reg1', name: 'เจ้าหน้าที่ทะเบียน 1', role: 'officer', dept: 'registry' },
  { id: 6, kind: 'staff', username: 'off.reg2', name: 'เจ้าหน้าที่ทะเบียน 2', role: 'officer', dept: 'registry' },
  { id: 7, kind: 'staff', username: 'off.works1', name: 'เจ้าหน้าที่โยธา 1', role: 'officer', dept: 'works' },
  { id: 8, kind: 'staff', username: 'head1', name: 'หัวหน้าฝ่าย', role: 'head', dept: null },
  { id: 9, kind: 'staff', username: 'exec1', name: 'ผู้บริหาร', role: 'executive', dept: null },
  { id: 10, kind: 'staff', username: 'audit1', name: 'ผู้ตรวจสอบภายใน', role: 'auditor', dept: null },
  { id: 11, kind: 'staff', username: 'admin1', name: 'ผู้ดูแลระบบ', role: 'admin', dept: null },
];

// 2. บริการ · วันหยุด · ตัวนับ (JSON ลอกจาก SPEC/B03.md §3)
const META = {
  services: [
  {
    "id": "SV-01",
    "name": "ขอหนังสือรับรอง",
    "fee": 20,
    "fee_per_sqm": null,
    "sla": 3
  },
  {
    "id": "SV-02",
    "name": "ขออนุญาตประกอบกิจการ",
    "fee": 500,
    "fee_per_sqm": null,
    "sla": 10
  },
  {
    "id": "SV-03",
    "name": "ขออนุญาตก่อสร้าง/ต่อเติมอาคาร",
    "fee": 1000,
    "fee_per_sqm": 10,
    "sla": 15
  }
],
  holidays: [
  {
    "date": "2026-12-07",
    "name": "ชดเชยวันหยุดทดสอบ (สมมติ)"
  },
  {
    "date": "2026-12-10",
    "name": "วันรัฐธรรมนูญทดสอบ (สมมติ)"
  },
  {
    "date": "2026-12-31",
    "name": "วันสิ้นปีทดสอบ (สมมติ)"
  },
  {
    "date": "2027-01-01",
    "name": "วันขึ้นปีใหม่ทดสอบ (สมมติ)"
  }
],
  counters: [
  {
    "name": "EG-2569",
    "value": 30
  },
  {
    "name": "DOC-2569",
    "value": 1
  },
  {
    "name": "DR",
    "value": 2
  },
  {
    "name": "PP",
    "value": 1
  }
],
};

// 3. คำขอ 30 ใบที่มีเลขแล้ว (ลอกจาก SPEC/B03.md §4 ← TEST-DATA 4.1 · 4.4)
const CASES = [
  {
    "case_no": "EG-2569-000001",
    "service_id": "SV-01",
    "applicant_id": 2,
    "qty": 1,
    "fee": 20,
    "status": "COMPLETED",
    "issuer": "off.reg1",
    "approved_by": "off.reg1",
    "approved_at": "2026-10-16T14:00:00+07:00",
    "paid_at": "2026-10-14T10:00:00+07:00",
    "due_at": "2026-10-19T16:30:00+07:00",
    "closed_at": "2026-10-16T14:00:00+07:00"
  },
  {
    "case_no": "EG-2569-000002",
    "service_id": "SV-03",
    "applicant_id": 4,
    "area_sqm": 120,
    "fee": 1200,
    "status": "COMPLETED",
    "step": 3,
    "visited_depts": "registry,works",
    "issuer": "off.reg1",
    "approved_by": "head1",
    "approved_at": "2026-11-20T11:00:00+07:00",
    "paid_at": "2026-11-02T09:00:00+07:00",
    "due_at": "2026-11-23T16:30:00+07:00",
    "closed_at": "2026-11-20T11:00:00+07:00"
  },
  {
    "case_no": "EG-2569-000003",
    "service_id": "SV-01",
    "applicant_id": 4,
    "qty": 2,
    "fee": 40,
    "status": "COMPLETED",
    "issuer": "off.reg1",
    "approved_by": "off.reg1",
    "approved_at": "2026-11-04T15:00:00+07:00",
    "paid_at": "2026-11-02T09:30:00+07:00",
    "due_at": "2026-11-05T16:30:00+07:00",
    "closed_at": "2026-11-04T15:00:00+07:00"
  },
  {
    "case_no": "EG-2569-000004",
    "service_id": "SV-02",
    "applicant_id": 1,
    "fee": 500,
    "status": "COMPLETED",
    "issuer": "off.reg1",
    "approved_by": "head1",
    "approved_at": "2026-11-13T15:00:00+07:00",
    "paid_at": "2026-11-02T14:00:00+07:00",
    "due_at": "2026-11-16T16:30:00+07:00",
    "closed_at": "2026-11-13T15:00:00+07:00"
  },
  {
    "case_no": "EG-2569-000005",
    "service_id": "SV-01",
    "applicant_id": 1,
    "qty": 1,
    "fee": 20,
    "status": "COMPLETED",
    "issuer": "off.reg1",
    "approved_by": "off.reg1",
    "approved_at": "2026-11-05T10:00:00+07:00",
    "paid_at": "2026-11-03T11:00:00+07:00",
    "due_at": "2026-11-06T16:30:00+07:00",
    "closed_at": "2026-11-05T10:00:00+07:00"
  },
  {
    "case_no": "EG-2569-000006",
    "service_id": "SV-02",
    "applicant_id": 4,
    "fee": 500,
    "status": "COMPLETED",
    "issuer": "off.reg1",
    "approved_by": "head1",
    "approved_at": "2026-11-19T10:00:00+07:00",
    "paid_at": "2026-11-03T15:00:00+07:00",
    "due_at": "2026-11-17T16:30:00+07:00",
    "closed_at": "2026-11-19T10:00:00+07:00"
  },
  {
    "case_no": "EG-2569-000007",
    "service_id": "SV-02",
    "applicant_id": 2,
    "fee": 500,
    "status": "COMPLETED",
    "issuer": "off.reg1",
    "approved_by": "head1",
    "approved_at": "2026-11-18T16:00:00+07:00",
    "paid_at": "2026-11-04T10:00:00+07:00",
    "due_at": "2026-11-18T16:30:00+07:00",
    "closed_at": "2026-11-18T16:00:00+07:00"
  },
  {
    "case_no": "EG-2569-000008",
    "service_id": "SV-01",
    "applicant_id": 2,
    "qty": 1,
    "fee": 20,
    "status": "REJECTED",
    "paid_at": "2026-11-09T10:00:00+07:00",
    "due_at": "2026-11-12T16:30:00+07:00",
    "closed_at": "2026-11-11T09:00:00+07:00",
    "reject_reason": "เอกสารประกอบไม่ครบถ้วน"
  },
  {
    "case_no": "EG-2569-000009",
    "service_id": "SV-01",
    "applicant_id": 1,
    "qty": 1,
    "fee": 20,
    "status": "CANCELLED",
    "paid_at": "2026-11-09T14:30:00+07:00",
    "due_at": "2026-11-12T16:30:00+07:00",
    "cancelled_at": "2026-11-09T15:00:00+07:00",
    "cancel_reason": "CITIZEN"
  },
  {
    "case_no": "EG-2569-000010",
    "service_id": "SV-03",
    "applicant_id": 2,
    "area_sqm": 80,
    "fee": 1000,
    "status": "IN_REVIEW",
    "step": 2,
    "current_dept": "works",
    "visited_depts": "registry,works",
    "issuer": "off.reg1",
    "paid_at": "2026-11-12T10:00:00+07:00",
    "due_at": "2026-12-03T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000011",
    "service_id": "SV-03",
    "applicant_id": 1,
    "area_sqm": 150,
    "fee": 1500,
    "status": "PENDING_APPROVAL",
    "step": 3,
    "current_dept": "head",
    "visited_depts": "registry,works",
    "issuer": "off.reg1",
    "paid_at": "2026-11-16T10:00:00+07:00",
    "due_at": "2026-12-08T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000012",
    "service_id": "SV-03",
    "applicant_id": 4,
    "area_sqm": 101,
    "fee": 1010,
    "status": "IN_REVIEW",
    "step": 1,
    "owner": "off.reg2",
    "issuer": "off.reg2",
    "paid_at": "2026-11-18T10:00:00+07:00",
    "due_at": "2026-12-11T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000013",
    "service_id": "SV-02",
    "applicant_id": 1,
    "fee": 500,
    "status": "IN_REVIEW",
    "owner": "off.reg2",
    "issuer": "off.reg2",
    "paid_at": "2026-11-20T10:00:00+07:00",
    "due_at": "2026-12-04T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000014",
    "service_id": "SV-02",
    "applicant_id": 4,
    "fee": 500,
    "status": "PENDING_APPROVAL",
    "current_dept": "head",
    "issuer": "off.reg1",
    "paid_at": "2026-11-20T11:00:00+07:00",
    "due_at": "2026-12-04T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000015",
    "service_id": "SV-02",
    "applicant_id": 2,
    "fee": 500,
    "status": "IN_REVIEW",
    "owner": "off.reg2",
    "issuer": "off.reg2",
    "paid_at": "2026-11-20T15:00:00+07:00",
    "due_at": "2026-12-04T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000016",
    "service_id": "SV-02",
    "applicant_id": 4,
    "fee": 500,
    "status": "IN_REVIEW",
    "owner": "off.reg2",
    "issuer": "off.reg2",
    "paid_at": "2026-11-23T09:00:00+07:00",
    "due_at": "2026-12-08T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000017",
    "service_id": "SV-01",
    "applicant_id": 1,
    "qty": 1,
    "fee": 20,
    "status": "NEED_FIX",
    "owner": "off.reg1",
    "paid_at": "2026-11-23T10:00:00+07:00",
    "due_at": "2026-11-27T16:30:00+07:00",
    "return_count": 2,
    "returned_at": "2026-11-27T14:00:00+07:00",
    "return_reason": "ชื่อในเอกสารไม่ตรงกับบัตร กรุณาแก้ไข",
    "fix_deadline": "2026-12-04T14:00:00+07:00"
  },
  {
    "case_no": "EG-2569-000018",
    "service_id": "SV-02",
    "applicant_id": 1,
    "fee": 500,
    "status": "IN_REVIEW",
    "owner": "off.reg2",
    "issuer": "off.reg2",
    "paid_at": "2026-11-24T10:00:00+07:00",
    "due_at": "2026-12-09T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000019",
    "service_id": "SV-02",
    "applicant_id": 2,
    "fee": 500,
    "status": "APPROVED",
    "issuer": "off.reg1",
    "approved_by": "head1",
    "approved_at": "2026-11-30T15:00:00+07:00",
    "paid_at": "2026-11-24T14:00:00+07:00",
    "due_at": "2026-12-09T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000020",
    "service_id": "SV-01",
    "applicant_id": 1,
    "qty": 1,
    "fee": 20,
    "status": "IN_REVIEW",
    "owner": "off.reg1",
    "paid_at": "2026-11-25T10:00:00+07:00",
    "due_at": "2026-11-30T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000021",
    "service_id": "SV-02",
    "applicant_id": 2,
    "fee": 500,
    "status": "IN_REVIEW",
    "owner": "off.reg2",
    "issuer": "off.reg2",
    "paid_at": "2026-11-25T12:00:00+07:00",
    "due_at": "2026-12-11T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000022",
    "service_id": "SV-01",
    "applicant_id": 2,
    "qty": 2,
    "fee": 40,
    "status": "IN_REVIEW",
    "owner": "off.reg1",
    "paid_at": "2026-11-26T10:00:00+07:00",
    "due_at": "2026-12-01T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000023",
    "service_id": "SV-01",
    "applicant_id": 2,
    "qty": 1,
    "fee": 20,
    "status": "IN_REVIEW",
    "owner": "off.reg1",
    "paid_at": "2026-11-26T10:30:00+07:00",
    "due_at": "2026-12-03T16:30:00+07:00",
    "return_count": 2,
    "returned_at": "2026-11-30T14:00:00+07:00",
    "return_reason": "ข้อมูลในแบบฟอร์มไม่ครบถ้วน"
  },
  {
    "case_no": "EG-2569-000024",
    "service_id": "SV-01",
    "applicant_id": 4,
    "qty": 1,
    "fee": 20,
    "status": "SUBMITTED",
    "paid_at": "2026-11-27T11:00:00+07:00",
    "due_at": "2026-12-02T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000025",
    "service_id": "SV-01",
    "applicant_id": 2,
    "qty": 3,
    "fee": 60,
    "status": "IN_REVIEW",
    "owner": "off.reg2",
    "paid_at": "2026-11-30T10:00:00+07:00",
    "due_at": "2026-12-03T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000026",
    "service_id": "SV-01",
    "applicant_id": 1,
    "qty": 5,
    "fee": 100,
    "status": "IN_REVIEW",
    "owner": "off.reg2",
    "paid_at": "2026-11-30T16:29:00+07:00",
    "due_at": "2026-12-03T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000027",
    "service_id": "SV-01",
    "applicant_id": 4,
    "qty": 1,
    "fee": 20,
    "status": "IN_REVIEW",
    "owner": "off.reg2",
    "paid_at": "2026-11-30T16:30:00+07:00",
    "due_at": "2026-12-04T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000028",
    "service_id": "SV-01",
    "applicant_id": 2,
    "qty": 1,
    "fee": 20,
    "status": "SUBMITTED",
    "paid_at": "2026-12-01T08:10:00+07:00",
    "due_at": "2026-12-04T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000029",
    "service_id": "SV-01",
    "applicant_id": 4,
    "qty": 1,
    "fee": 20,
    "status": "SUBMITTED",
    "paid_at": "2026-12-01T08:20:00+07:00",
    "due_at": "2026-12-04T16:30:00+07:00"
  },
  {
    "case_no": "EG-2569-000030",
    "service_id": "SV-01",
    "applicant_id": 1,
    "qty": 1,
    "fee": 20,
    "status": "SUBMITTED",
    "paid_at": "2026-12-01T08:30:00+07:00",
    "due_at": "2026-12-04T16:30:00+07:00"
  }
];

// 4. ร่าง 2 รายการของสมชาย (SPEC/B03.md §5)
const DRAFTS = [
  {
    "draft_id": "DR-0001",
    "service_id": "SV-01",
    "applicant_id": 1,
    "qty": 2,
    "fee": 40,
    "status": "DRAFT",
    "current_dept": null,
    "visited_depts": "",
    "created_at": "2026-11-30T20:00:00+07:00",
    "updated_at": "2026-11-30T20:00:00+07:00"
  },
  {
    "draft_id": "DR-0002",
    "service_id": "SV-02",
    "applicant_id": 1,
    "fee": 500,
    "status": "PENDING_PAYMENT",
    "fee_locked_at": "2026-12-01T08:55:00+07:00",
    "current_dept": null,
    "visited_depts": "",
    "created_at": "2026-12-01T08:50:00+07:00",
    "updated_at": "2026-12-01T08:55:00+07:00"
  }
];

// ค่าเริ่มต้นของทุกแถวคำขอ (SPEC/B03.md §4)
const CASE_DEFAULTS = {
  draft_id: null, case_no: null, receipt_no: null, service_id: null, applicant_id: null,
  qty: null, area_sqm: null, fee: null, fee_locked_at: null, status: null, step: null,
  current_dept: 'registry', visited_depts: 'registry', owner: null, issuer: null,
  approved_by: null, approved_at: null, paid_at: null, due_at: null, return_count: 0,
  returned_at: null, return_reason: null, fix_deadline: null, closed_at: null,
  reject_reason: null, cancelled_at: null, cancel_reason: null, created_at: null, updated_at: null,
};
const CASE_COLS = Object.keys(CASE_DEFAULTS);

function fullCaseRow(r) {
  for (const k of Object.keys(r)) {
    if (!(k in CASE_DEFAULTS)) throw new Error('seed: unknown case column ' + k);
  }
  const row = { ...CASE_DEFAULTS, ...r };
  if (row.case_no && !('receipt_no' in r)) row.receipt_no = 'RC-' + row.case_no.slice(3);
  if (!('fee_locked_at' in r)) row.fee_locked_at = row.paid_at;
  if (!('created_at' in r)) row.created_at = row.paid_at;
  if (!('updated_at' in r)) {
    row.updated_at = [row.closed_at, row.cancelled_at, row.approved_at, row.returned_at, row.paid_at]
      .find((v) => v) ?? null;
  }
  return row;
}

// เอกสารบังคับตามบริการ (ตรงกับ TEST-DATA §4.1 หมายเหตุไฟล์แนบ)
const FILE_DOCS = {
  'SV-01': ['id-card'],
  'SV-02': ['id-card', 'map'],
  'SV-03': ['id-card', 'plan', 'deed'],
};

// เอกสารที่ออกแล้ว 1 ใบ (TEST-DATA §5)
const DOCUMENT = {
  doc_no: 'DOC-2569-000001',
  case_no: 'EG-2569-000005',
  verify_code: 'K7M2Q9XA',
  applicant: 'สมชาย ใจดี',
  service_id: 'SV-01',
  issued_at: '2026-11-05T10:00:00+07:00',
  valid_until: '2027-02-02',
  signer: 'เจ้าหน้าที่ทะเบียน 1',
  issued_by: 'off.reg1',
};

// เหตุการณ์ที่ไม่ใช่ PAID/ISSUE/REJECT/CANCEL/APPROVE อัตโนมัติ (SPEC/B03.md §7)
const EXTRA_EVENTS = [
  ['EG-2569-000017', 'RETURN', '2026-11-24T11:00:00+07:00', 'ตีกลับให้แก้ไข: ภาพบัตรประชาชนไม่ชัด กรุณาถ่ายใหม่'],
  ['EG-2569-000017', 'RESUBMIT', '2026-11-25T10:00:00+07:00', 'ผู้ยื่นส่งแก้ไขแล้ว'],
  ['EG-2569-000017', 'RETURN', '2026-11-27T14:00:00+07:00', 'ตีกลับให้แก้ไข: ชื่อในเอกสารไม่ตรงกับบัตร กรุณาแก้ไข'],
  ['EG-2569-000023', 'RETURN', '2026-11-27T10:00:00+07:00', 'ตีกลับให้แก้ไข: ภาพเอกสารเบลอ อ่านเลขไม่ได้'],
  ['EG-2569-000023', 'RESUBMIT', '2026-11-30T10:00:00+07:00', 'ผู้ยื่นส่งแก้ไขแล้ว'],
  ['EG-2569-000023', 'RETURN', '2026-11-30T14:00:00+07:00', 'ตีกลับให้แก้ไข: ข้อมูลในแบบฟอร์มไม่ครบถ้วน'],
  ['EG-2569-000023', 'RESUBMIT', '2026-12-01T08:30:00+07:00', 'ผู้ยื่นส่งแก้ไขแล้ว'],
];

module.exports = function seed(ctx) {
  const { db, crypto, pdf } = ctx;

  // --- users ---
  const staffHash = crypto.hashPassword(STAFF_PASSWORD);
  const insUser = db.prepare(
    'INSERT INTO users (id, kind, username, password_hash, name, role, dept, id_hash, id_enc, mobile_enc, email, registered, consent_at, created_at) ' +
    'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  for (const u of USERS) {
    if (u.kind === 'citizen') {
      insUser.run(u.id, 'citizen', null, null, u.name, u.role, null,
        crypto.hashId(u.idNo), crypto.encrypt(u.idNo), u.mobile ? crypto.encrypt(u.mobile) : null,
        '', u.registered, u.consent, SEED_CREATED);
    } else {
      insUser.run(u.id, 'staff', u.username, staffHash, u.name, u.role, u.dept,
        null, null, null, null, 1, null, SEED_CREATED);
    }
  }

  // --- services · holidays · counters ---
  const insService = db.prepare('INSERT INTO services (id, name, fee, fee_per_sqm, sla) VALUES (?,?,?,?,?)');
  for (const s of META.services) insService.run(s.id, s.name, s.fee, s.fee_per_sqm ?? null, s.sla);
  const insHoliday = db.prepare('INSERT INTO holidays (date, name) VALUES (?,?)');
  for (const h of META.holidays) insHoliday.run(h.date, h.name);
  const insCounter = db.prepare('INSERT INTO counters (name, value) VALUES (?,?)');
  for (const c of META.counters) insCounter.run(c.name, c.value);

  // --- cases (30 มีเลข + 2 ร่าง) ---
  const insCase = db.prepare(
    `INSERT INTO cases (${CASE_COLS.join(', ')}) VALUES (${CASE_COLS.map(() => '?').join(', ')})`
  );
  const caseId = {}; // case_no หรือ draft_id -> id
  for (const r of [...CASES, ...DRAFTS]) {
    const row = fullCaseRow(r);
    const info = insCase.run(CASE_COLS.map((c) => (row[c] === undefined ? null : row[c])));
    caseId[row.case_no || row.draft_id] = Number(info.lastInsertRowid);
  }

  // --- files (50 ไฟล์) ---
  const insFile = db.prepare(
    'INSERT INTO files (id, case_id, doc_key, name, mime, size, data, uploaded_at) VALUES (?,?,?,?,?,?,?,?)'
  );
  const addFile = (cid, idPart, docKey, label, uploadedAt) => {
    const data = pdf.makeSimplePdf(['seed ' + docKey + ' ' + label]);
    insFile.run('seed-' + idPart + '-' + docKey, cid, docKey, docKey + '.pdf', 'application/pdf',
      data.length, data, uploadedAt);
  };
  for (const r of CASES) {
    for (const docKey of FILE_DOCS[r.service_id]) {
      addFile(caseId[r.case_no], r.case_no.slice(-6), docKey, r.case_no, r.paid_at);
    }
  }
  const draft2 = DRAFTS.find((d) => d.draft_id === 'DR-0002');
  for (const docKey of ['id-card', 'map']) {
    addFile(caseId[draft2.draft_id], 'DR-0002', docKey, 'DR-0002', draft2.created_at);
  }

  // --- documents (1 ใบ) ---
  const d = DOCUMENT;
  const docCaseId = caseId[d.case_no];
  const signature = crypto.hmacDoc([d.doc_no, d.case_no, d.applicant, d.service_id, d.issued_at, d.valid_until, d.signer]);
  db.prepare(
    'INSERT INTO documents (doc_no, case_id, case_no, verify_code, applicant, service_id, issued_at, valid_until, signer, signature, issued_by) ' +
    'VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(d.doc_no, docCaseId, d.case_no, d.verify_code, d.applicant, d.service_id, d.issued_at,
    d.valid_until, d.signer, signature, d.issued_by);

  // --- payments (PP-0001 ของร่าง DR-0002) ---
  db.prepare(
    'INSERT INTO payments (ref, case_id, amount, status, qr_created_at, qr_expires_at, paid_at) VALUES (?,?,?,?,?,?,?)'
  ).run('PP-0001', caseId['DR-0002'], 500, 'PENDING', '2026-12-01T08:55:00+07:00',
    '2026-12-01T09:10:00+07:00', null);

  // --- case_events (ไทม์ไลน์ 47 แถว · เรียงตามเวลาในแต่ละคำขอ) ---
  const events = [];
  for (const r of CASES) {
    events.push([r.case_no, 'PAID', r.paid_at, 'ชำระเงินสำเร็จ ได้รับเลขคำขอ']);
    if (r.status === 'COMPLETED') events.push([r.case_no, 'ISSUE', r.closed_at, 'ออกเอกสารดิจิทัลแล้ว (เสร็จสิ้น)']);
    if (r.status === 'REJECTED') events.push([r.case_no, 'REJECT', r.closed_at, 'ไม่อนุมัติ: ' + r.reject_reason]);
    if (r.status === 'CANCELLED') events.push([r.case_no, 'CANCEL', r.cancelled_at, 'ผู้ยื่นยกเลิกคำขอ']);
    if (r.status === 'APPROVED') events.push([r.case_no, 'APPROVE', r.approved_at, 'อนุมัติแล้ว']);
  }
  events.push(...EXTRA_EVENTS);
  const insEvent = db.prepare('INSERT INTO case_events (case_id, at, type, text) VALUES (?,?,?,?)');
  // จัดลำดับตามคำขอ แล้วตามเวลา (เสถียร) เพื่อให้ id เรียงตามไทม์ไลน์
  const order = new Map(CASES.map((r, i) => [r.case_no, i]));
  events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (order.get(a.e[0]) - order.get(b.e[0])) || (a.e[2] < b.e[2] ? -1 : a.e[2] > b.e[2] ? 1 : a.i - b.i))
    .forEach(({ e }) => insEvent.run(caseId[e[0]], e[2], e[1], e[3]));
};
