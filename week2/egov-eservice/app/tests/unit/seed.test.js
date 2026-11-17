'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { createContext } = require('../../src/core/context');
const { removeDbFiles } = require('../../src/core/db');

const DB_PATH = '/tmp/seed-test.db';
const PLAIN = ['1101700123456', '3100600987659', '1909900555015', '5500400111221',
  '0812345678', '0823456789', '0834567890', '1-1017-00123-45-6'];

let ctx;
const q = (sql, ...args) => ctx.db.prepare(sql).get(...args);
const all = (sql, ...args) => ctx.db.prepare(sql).all(...args);

function snapshotCounts() {
  const tables = ['users', 'services', 'holidays', 'counters', 'cases', 'files', 'payments',
    'documents', 'notifications', 'audit_log', 'case_events', 'otp_attempts'];
  const out = {};
  for (const t of tables) out[t] = q(`SELECT COUNT(*) AS n FROM ${t}`).n;
  return out;
}

before(() => {
  removeDbFiles(DB_PATH);
  ctx = createContext({ dbPath: DB_PATH, testMode: true, bugMode: '' });
  ctx.resetAll();
});

after(() => { ctx.db.close(); });

test('users: 11 rows (citizen 4 · staff 7), only มานะ unregistered', () => {
  assert.equal(q('SELECT COUNT(*) AS n FROM users').n, 11);
  assert.equal(q("SELECT COUNT(*) AS n FROM users WHERE kind='citizen'").n, 4);
  assert.equal(q("SELECT COUNT(*) AS n FROM users WHERE kind='staff'").n, 7);
  const unreg = all('SELECT id, name FROM users WHERE registered = 0');
  assert.deepEqual(unreg.map((r) => r.name), ['มานะ ตั้งใจ']);
});

test('staff login fields and citizen shape', () => {
  const staff = all("SELECT username, role, dept FROM users WHERE kind='staff' ORDER BY id");
  assert.deepEqual(staff.map((s) => s.username),
    ['off.reg1', 'off.reg2', 'off.works1', 'head1', 'exec1', 'audit1', 'admin1']);
  assert.equal(staff[2].dept, 'works');
  const pw = q("SELECT password_hash FROM users WHERE username='head1'").password_hash;
  assert.ok(ctx.crypto.verifyPassword('Test@1234', pw));
  const cit = all("SELECT password_hash, username, email, created_at FROM users WHERE kind='citizen'");
  for (const c of cit) {
    assert.equal(c.password_hash, null);
    assert.equal(c.username, null);
    assert.equal(c.email, '');
    assert.equal(c.created_at, '2026-10-01T09:00:00+07:00');
  }
  for (const row of all("SELECT created_at FROM users WHERE kind='staff'")) assert.equal(row.created_at, '2026-10-01T09:00:00+07:00');
  assert.equal(q("SELECT email FROM users WHERE username='off.reg1'").email, null);
});

test('services · holidays · counters', () => {
  assert.equal(q('SELECT COUNT(*) AS n FROM services').n, 3);
  assert.equal(q('SELECT COUNT(*) AS n FROM holidays').n, 4);
  assert.equal(q('SELECT COUNT(*) AS n FROM counters').n, 4);
  const c = all('SELECT name, value FROM counters ORDER BY name').map((r) => r.name + '=' + r.value).join(' ');
  assert.equal(c, 'DOC-2569=1 DR=2 EG-2569=30 PP=1');
  const sv3 = q("SELECT fee, fee_per_sqm, sla FROM services WHERE id='SV-03'");
  assert.deepEqual({ ...sv3 }, { fee: 1000, fee_per_sqm: 10, sla: 15 });
});

test('cases: 32 total · 30 numbered · status breakdown', () => {
  assert.equal(q('SELECT COUNT(*) AS n FROM cases').n, 32);
  assert.equal(q('SELECT COUNT(*) AS n FROM cases WHERE case_no IS NOT NULL').n, 30);
  const s = all('SELECT status, COUNT(*) AS n FROM cases GROUP BY status ORDER BY status')
    .map((r) => r.status + '=' + r.n).join(' ');
  assert.equal(s, 'APPROVED=1 CANCELLED=1 COMPLETED=7 DRAFT=1 IN_REVIEW=13 NEED_FIX=1 ' +
    'PENDING_APPROVAL=2 PENDING_PAYMENT=1 REJECTED=1 SUBMITTED=4');
});

test('cases by applicant (numbered only)', () => {
  const by = (id) => q('SELECT COUNT(*) AS n FROM cases WHERE applicant_id = ? AND case_no IS NOT NULL', id).n;
  assert.equal(by(1), 10); // สมชาย
  assert.equal(by(2), 11); // สมหญิง
  assert.equal(by(4), 9);  // ปิติ
  assert.equal(by(3), 0);  // มานะ
});

test('in-hand workload per officer (IN_REVIEW with owner)', () => {
  const s = all("SELECT owner, COUNT(*) AS n FROM cases WHERE status='IN_REVIEW' AND owner IS NOT NULL GROUP BY owner ORDER BY owner")
    .map((r) => r.owner + '=' + r.n).join(' ');
  assert.equal(s, 'off.reg1=3 off.reg2=9');
});

test('backlog (BACKLOG_STATUSES) overall and per service', () => {
  const st = "('SUBMITTED','IN_REVIEW','NEED_FIX','PENDING_APPROVAL','APPROVED')";
  assert.equal(q(`SELECT COUNT(*) AS n FROM cases WHERE status IN ${st}`).n, 21);
  const per = all(`SELECT service_id, COUNT(*) AS n FROM cases WHERE status IN ${st} GROUP BY service_id ORDER BY service_id`);
  assert.deepEqual(per.map((r) => [r.service_id, r.n]), [['SV-01', 11], ['SV-02', 7], ['SV-03', 3]]);
});

test('paid_at month split: ธ.ค. 3 · พ.ย. 26 · ต.ค. 1', () => {
  const m = (ym) => q("SELECT COUNT(*) AS n FROM cases WHERE case_no IS NOT NULL AND substr(paid_at,1,7) = ?", ym).n;
  assert.equal(m('2026-12'), 3);
  assert.equal(m('2026-11'), 26);
  assert.equal(m('2026-10'), 1);
});

test('closed in November (COMPLETED/REJECTED) = 7, one late (000006)', () => {
  const rows = all("SELECT case_no, due_at, closed_at FROM cases WHERE status IN ('COMPLETED','REJECTED') AND substr(closed_at,1,7)='2026-11'");
  assert.equal(rows.length, 7);
  const late = rows.filter((r) => Date.parse(r.closed_at) > Date.parse(r.due_at)).map((r) => r.case_no);
  assert.deepEqual(late, ['EG-2569-000006']);
});

test('specific rows: 000017 and 000023', () => {
  const r = all("SELECT case_no, status, owner, return_count, fix_deadline, due_at FROM cases WHERE case_no IN ('EG-2569-000017','EG-2569-000023') ORDER BY case_no");
  assert.deepEqual({ ...r[0] }, { case_no: 'EG-2569-000017', status: 'NEED_FIX', owner: 'off.reg1', return_count: 2,
    fix_deadline: '2026-12-04T14:00:00+07:00', due_at: '2026-11-27T16:30:00+07:00' });
  assert.deepEqual({ ...r[1] }, { case_no: 'EG-2569-000023', status: 'IN_REVIEW', owner: 'off.reg1', return_count: 2,
    fix_deadline: null, due_at: '2026-12-03T16:30:00+07:00' });
});

test('drafts: DR-0001 DRAFT (no files) · DR-0002 PENDING_PAYMENT', () => {
  const dr = all("SELECT draft_id, status, case_no, receipt_no, step, applicant_id FROM cases WHERE draft_id IS NOT NULL ORDER BY draft_id");
  assert.deepEqual(dr.map((r) => [r.draft_id, r.status, r.case_no, r.receipt_no, r.step, r.applicant_id]),
    [['DR-0001', 'DRAFT', null, null, null, 1], ['DR-0002', 'PENDING_PAYMENT', null, null, null, 1]]);
});

test('files: 50 rows, every data starts with %PDF, DR-0001 has none', () => {
  assert.equal(q('SELECT COUNT(*) AS n FROM files').n, 50);
  const bad = all('SELECT id FROM files WHERE substr(data,1,4) <> ?', Buffer.from('%PDF'));
  assert.equal(bad.length, 0);
  assert.equal(q("SELECT COUNT(*) AS n FROM files WHERE case_id = (SELECT id FROM cases WHERE draft_id='DR-0001')").n, 0);
  assert.equal(q("SELECT COUNT(*) AS n FROM files f JOIN cases c ON c.id=f.case_id WHERE c.draft_id='DR-0002'").n, 2);
  const f = q("SELECT id, name, mime, size FROM files WHERE id='seed-000025-id-card'");
  assert.equal(f.name, 'id-card.pdf');
  assert.equal(f.mime, 'application/pdf');
});

test('payments and documents', () => {
  assert.equal(q('SELECT COUNT(*) AS n FROM payments').n, 1);
  const p = q("SELECT ref, amount, status, paid_at, case_id FROM payments");
  assert.equal(p.ref, 'PP-0001');
  assert.equal(p.status, 'PENDING');
  assert.equal(p.amount, 500);
  assert.equal(p.paid_at, null);
  assert.equal(p.case_id, q("SELECT id FROM cases WHERE draft_id='DR-0002'").id);

  assert.equal(q('SELECT COUNT(*) AS n FROM documents').n, 1);
  const d = q("SELECT * FROM documents WHERE doc_no='DOC-2569-000001'");
  assert.equal(d.verify_code, 'K7M2Q9XA');
  assert.equal(d.case_id, q("SELECT id FROM cases WHERE case_no='EG-2569-000005'").id);
  assert.equal(d.valid_until, '2027-02-02');
  const expected = ctx.crypto.hmacDoc([d.doc_no, d.case_no, d.applicant, d.service_id, d.issued_at, d.valid_until, d.signer]);
  assert.equal(d.signature, expected);
});

test('case_events: 47 rows · sample timeline', () => {
  assert.equal(q('SELECT COUNT(*) AS n FROM case_events').n, 47);
  const t = all("SELECT e.type, e.at FROM case_events e JOIN cases c ON c.id=e.case_id WHERE c.case_no='EG-2569-000023' ORDER BY e.id");
  assert.deepEqual(t.map((r) => r.type), ['PAID', 'RETURN', 'RESUBMIT', 'RETURN', 'RESUBMIT']);
});

test('notifications · audit_log · otp_attempts are empty', () => {
  assert.equal(q('SELECT COUNT(*) AS n FROM notifications').n, 0);
  assert.equal(q('SELECT COUNT(*) AS n FROM audit_log').n, 0);
  assert.equal(q('SELECT COUNT(*) AS n FROM otp_attempts').n, 0);
});

test('encryption: decrypt matches and id_hash equals hashId', () => {
  const u2 = q('SELECT id_enc FROM users WHERE id = 2');
  assert.equal(ctx.crypto.decrypt(u2.id_enc), '3100600987659');
  const u1 = q('SELECT mobile_enc, id_hash FROM users WHERE id = 1');
  assert.equal(ctx.crypto.decrypt(u1.mobile_enc), '0812345678');
  assert.equal(u1.id_hash, ctx.crypto.hashId('1101700123456'));
  assert.equal(q('SELECT mobile_enc FROM users WHERE id = 3').mobile_enc, null);
});

test('no plaintext ID or phone bytes anywhere in the DB file', () => {
  ctx.db.pragma('wal_checkpoint(TRUNCATE)');
  const buf = fs.readFileSync(DB_PATH);
  for (const s of PLAIN) {
    assert.equal(buf.indexOf(Buffer.from(s, 'utf8')), -1, 'found plaintext ' + s);
  }
});

test('reset twice gives identical counts and user ids 1–11', () => {
  const first = snapshotCounts();
  ctx.resetAll();
  ctx.resetAll();
  assert.deepEqual(snapshotCounts(), first);
  assert.equal(first.cases, 32);
  assert.deepEqual(all('SELECT id FROM users ORDER BY id').map((r) => r.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});
