import * as fs from 'fs';
import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  BASE_URL, DB_PATH, ID, api, newApi, disposeApis, reset, setClock, getClock, loginCitizen, loginStaff,
  newPaid, pay, getCase, pdfText, deepHasKey, readXlsx, rowBy, tabUntil, createDraft, file,
} from './helpers';
import {
  EG, closeExtraContexts, newCtxPage, staffPage, citizenPage, anonPage, newStaff, newCitizen, auditItems,
  downloadOf, reasonAction, dataAttrs, texts, rolePages, STATUS_TH, LEVEL_TH, RoleKey,
} from './helpers-b';

test.afterEach(async () => {
  await disposeApis();
  await closeExtraContexts();
});

const NAMES = /สมชาย|สมหญิง|ปิติ|มานะ/;
const T0 = '2026-12-01T09:00:00+07:00';

async function queueOrder(page: Page): Promise<string[]> {
  return page.getByTestId('queue-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-case-no') ?? ''));
}
async function caseStatus(page: Page, text: string, label: string): Promise<void> {
  await expect(page.getByTestId('case-status'), label).toHaveText(text);
}
async function openOfficerCase(page: Page, n: number): Promise<void> {
  await page.goto(`/officer/cases/${EG(n)}`);
}
async function verifyAt(page: Page, code: string): Promise<number> {
  const res = await page.goto(`/verify/${code}`);
  return res!.status();
}

// ───────────────────────── WORKFLOW ─────────────────────────

test('TC-WORKFLOW-01 SV-01 อนุมัติ + ออกเอกสาร', async ({ page, browser }) => {
  await reset();
  await loginStaff(page, 'off.reg2');
  await openOfficerCase(page, 25);
  await test.step('1 ตรวจปุ่ม', async () => {
    await caseStatus(page, 'กำลังตรวจสอบ', 'ขั้น 1 case-status');
    await expect(page.getByTestId('approve-btn'), 'ขั้น 1 approve-btn').toHaveCount(1);
    await expect(page.getByTestId('return-btn'), 'ขั้น 1 return-btn').toHaveCount(1);
    await expect(page.getByTestId('reject-btn'), 'ขั้น 1 reject-btn').toHaveCount(1);
    await expect(page.getByTestId('forward-btn'), 'ขั้น 1 forward-btn').toHaveCount(0);
    await expect(page.getByTestId('issue-btn'), 'ขั้น 1 issue-btn').toHaveCount(0);
    await expect(page.getByTestId('case-fee'), 'ขั้น 1 case-fee').toHaveText('฿60');
  });
  await test.step('2 off.reg1 อนุมัติเรื่องของ off.reg2 ไม่ได้', async () => {
    const o1 = await newStaff('off.reg1');
    const r = await api(o1, 'POST', `/api/cases/${EG(26)}/approve`);
    expect(r.status, 'ขั้น 2 off.reg1 approve 000026').toBe(403);
    expect(r.json?.code, 'ขั้น 2 code').toBe('FORBIDDEN');
  });
  await test.step('3 อนุมัติ', async () => {
    await page.getByTestId('approve-btn').click();
    await caseStatus(page, 'อนุมัติ', 'ขั้น 3 case-status');
    await expect(page.getByTestId('issue-btn'), 'ขั้น 3 issue-btn').toHaveCount(1);
    await expect(page.getByTestId('approve-btn'), 'ขั้น 3 approve-btn').toHaveCount(0);
  });
  let code = '';
  await test.step('4 ออกเอกสาร', async () => {
    await page.getByTestId('issue-btn').click();
    await caseStatus(page, 'เสร็จสิ้น', 'ขั้น 4 case-status');
    await expect(page.getByTestId('doc-no'), 'ขั้น 4 doc-no').toHaveText('DOC-2569-000002');
    await expect(page.getByTestId('verify-code'), 'ขั้น 4 verify-code').toHaveText(/^[A-Z0-9]{8}$/);
    code = ((await page.getByTestId('verify-code').textContent()) ?? '').trim();
    await expect(page.getByTestId('closed-at'), 'ขั้น 4 closed-at').toHaveAttribute('data-iso', T0);
    await expect(page.getByTestId('sla-level'), 'ขั้น 4 sla-level').toHaveText('ปิดแล้ว');
  });
  await test.step('5 สมหญิงดาวน์โหลด PDF', async () => {
    const cp = await citizenPage(browser, ID.somying);
    await cp.goto(`/citizen/cases/${EG(25)}`);
    await caseStatus(cp, 'เสร็จสิ้น', 'ขั้น 5 case-status');
    await expect(cp.getByTestId('download-doc-btn'), 'ขั้น 5 download-doc-btn').toHaveCount(1);
    const r = await api(cp, 'GET', '/api/documents/DOC-2569-000002/pdf');
    expect(r.status, 'ขั้น 5 GET pdf').toBe(200);
    expect(r.headers['content-type'], 'ขั้น 5 content-type').toContain('application/pdf');
    expect(r.headers['content-disposition'], 'ขั้น 5 content-disposition').toContain('DOC-2569-000002.pdf');
    expect(await pdfText(r.body), 'ขั้น 5 เนื้อ PDF').toContain('docNo=DOC-2569-000002 caseNo=EG-2569-000025');
    expect(code, 'ขั้น 5 verify-code ที่อ่านได้').toMatch(/^[A-Z0-9]{8}$/);
  });
  await test.step('6 Dashboard', async () => {
    const ex = await newStaff('exec1');
    const r = await api(ex, 'GET', '/api/dashboard?period=2026-12&service=ALL');
    expect(r.status, 'ขั้น 6 dashboard').toBe(200);
    expect(r.json.closed, 'ขั้น 6 closed').toBe(1);
    expect(r.json.onTime, 'ขั้น 6 onTime').toBe(1);
    expect(r.json.received, 'ขั้น 6 received').toBe(3);
    expect(r.json.backlog, 'ขั้น 6 backlog').toBe(20);
  });
});

test('TC-WORKFLOW-02 SV-02 ผ่านหัวหน้า', async ({ page, browser }) => {
  await reset();
  await loginStaff(page, 'off.reg2');
  await openOfficerCase(page, 13);
  await test.step('1 ตรวจปุ่ม', async () => {
    await expect(page.getByTestId('approve-btn'), 'ขั้น 1 approve-btn').toHaveCount(0);
    await expect(page.getByTestId('forward-btn'), 'ขั้น 1 forward-btn').toHaveCount(1);
    await expect(page.getByTestId('forward-target'), 'ขั้น 1 forward-target').toHaveCount(0);
  });
  await test.step('2 ส่งต่อ', async () => {
    await page.getByTestId('forward-btn').click();
    await caseStatus(page, 'รออนุมัติ', 'ขั้น 2 case-status');
    await page.goto('/officer/queue');
    await expect(page.getByTestId('workload-count'), 'ขั้น 2 workload-count').toHaveText('8');
    await expect(rowBy(page, 'queue-row', 'data-case-no', EG(13)), 'ขั้น 2 แถว 000013 หาย').toHaveCount(0);
  });
  const head = await staffPage(browser, 'head1');
  await test.step('3 head1 รายการรออนุมัติ', async () => {
    await head.goto('/head/approvals');
    await expect(head.getByTestId('approval-row'), 'ขั้น 3 จำนวนแถว').toHaveCount(3);
    const order = await head.getByTestId('approval-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-case-no')));
    expect(order, 'ขั้น 3 ลำดับ').toEqual([EG(13), EG(14), EG(11)]);
  });
  await test.step('4 เปิด 000013', async () => {
    await rowBy(head, 'approval-row', 'data-case-no', EG(13)).getByTestId('approval-open').click();
    await expect(head.getByTestId('approve-btn'), 'ขั้น 4 approve-btn').toHaveCount(1);
    await expect(head.getByTestId('reject-btn'), 'ขั้น 4 reject-btn').toHaveCount(1);
    await expect(head.getByTestId('issue-btn'), 'ขั้น 4 issue-btn').toHaveCount(0);
  });
  await test.step('5 หัวหน้าอนุมัติ', async () => {
    await head.getByTestId('approve-btn').click();
    await caseStatus(head, 'อนุมัติ', 'ขั้น 5 case-status');
    await expect(head.getByTestId('issue-btn'), 'ขั้น 5 หัวหน้าไม่มี issue-btn').toHaveCount(0);
  });
  await test.step('6 off.reg1 ออกเอกสารไม่ได้', async () => {
    const o1 = await staffPage(browser, 'off.reg1');
    await openOfficerCase(o1, 13);
    await expect(o1.getByTestId('issue-btn'), 'ขั้น 6 issue-btn').toHaveCount(0);
    const r = await api(o1, 'POST', `/api/officer/cases/${EG(13)}/issue`);
    expect(r.status, 'ขั้น 6 off.reg1 issue 000013').toBe(403);
    expect(r.json?.code, 'ขั้น 6 code').toBe('FORBIDDEN');
  });
  await test.step('7 off.reg2 ออกเอกสาร', async () => {
    await openOfficerCase(page, 13);
    await page.getByTestId('issue-btn').click();
    await caseStatus(page, 'เสร็จสิ้น', 'ขั้น 7 case-status');
    await expect(page.getByTestId('doc-no'), 'ขั้น 7 doc-no').toHaveText('DOC-2569-000002');
    const code = ((await page.getByTestId('verify-code').textContent()) ?? '').trim();
    const ap = await anonPage(browser);
    await verifyAt(ap, code);
    await expect(ap.getByTestId('verify-signer'), 'ขั้น 7 verify-signer').toHaveText('หัวหน้าฝ่าย');
  });
  await test.step('8 seed 000019 (APPROVED โดย head1) ออกโดย off.reg1', async () => {
    await reset();
    const o1 = await staffPage(browser, 'off.reg1');
    await openOfficerCase(o1, 19);
    await o1.getByTestId('issue-btn').click();
    await caseStatus(o1, 'เสร็จสิ้น', 'ขั้น 8 case-status');
    await expect(o1.getByTestId('doc-no'), 'ขั้น 8 doc-no').toHaveText('DOC-2569-000002');
    const code = ((await o1.getByTestId('verify-code').textContent()) ?? '').trim();
    const ap = await anonPage(browser);
    await verifyAt(ap, code);
    await expect(ap.getByTestId('verify-signer'), 'ขั้น 8 verify-signer').toHaveText('หัวหน้าฝ่าย');
  });
});

test('TC-WORKFLOW-03 SV-03 สามขั้นตอน', async ({ page, browser }) => {
  await reset();
  await loginStaff(page, 'off.reg2');
  await openOfficerCase(page, 12);
  await test.step('1 ตรวจหน้า', async () => {
    await expect(page.getByTestId('case-step'), 'ขั้น 1 case-step').toHaveText('ขั้นตอน 1/3 · ฝ่ายทะเบียน');
    await expect(page.getByTestId('case-fee'), 'ขั้น 1 case-fee').toHaveText('฿1,010');
    await expect(page.getByTestId('forward-btn'), 'ขั้น 1 forward-btn').toHaveCount(1);
  });
  await test.step('2 ส่งต่อไปฝ่ายโยธา', async () => {
    await page.getByTestId('forward-btn').click();
    await caseStatus(page, 'กำลังตรวจสอบ', 'ขั้น 2 case-status');
    await expect(page.getByTestId('case-step'), 'ขั้น 2 case-step').toHaveText('ขั้นตอน 2/3 · ฝ่ายโยธา');
    await expect(page.getByTestId('case-owner'), 'ขั้น 2 case-owner').toHaveText('ยังไม่มีผู้รับ');
    await page.goto('/officer/queue');
    await expect(page.getByTestId('workload-count'), 'ขั้น 2 workload-count').toHaveText('8');
  });
  await test.step('3 คิว off.reg2 เหลือ 16 แถว', async () => {
    await expect(page.getByTestId('queue-row'), 'ขั้น 3 จำนวนแถว').toHaveCount(16);
    await expect(rowBy(page, 'queue-row', 'data-case-no', EG(12)), 'ขั้น 3 แถว 000012').toHaveCount(0);
  });
  const works = await staffPage(browser, 'off.works1');
  await test.step('4 คิว off.works1', async () => {
    await works.goto('/officer/queue');
    await expect(works.getByTestId('queue-row'), 'ขั้น 4 จำนวนแถว').toHaveCount(2);
    expect(await queueOrder(works), 'ขั้น 4 ลำดับ').toEqual([EG(10), EG(12)]);
    await expect(works.getByTestId('claim-btn'), 'ขั้น 4 claim-btn').toHaveCount(2);
  });
  await test.step('5 off.reg1 ข้ามแผนก claim ไม่ได้', async () => {
    const o1 = await newStaff('off.reg1');
    const r = await api(o1, 'POST', `/api/officer/cases/${EG(12)}/claim`);
    expect(r.status, 'ขั้น 5 off.reg1 claim 000012').toBe(403);
    expect(r.json?.code, 'ขั้น 5 code').toBe('FORBIDDEN');
  });
  await test.step('6 off.works1 claim แล้วส่งต่อ', async () => {
    // คลิก claim → เว็บ POST แล้ว location.reload() · ต้องรอ reload เสร็จก่อน goto ไม่งั้น goto ถูก abort (ERR_ABORTED)
    await Promise.all([
      works.waitForEvent('load'),
      rowBy(works, 'queue-row', 'data-case-no', EG(12)).getByTestId('claim-btn').click(),
    ]);
    await openOfficerCase(works, 12);
    await expect(works.getByTestId('case-owner'), 'ขั้น 6 case-owner').toHaveText('off.works1');
    await works.getByTestId('forward-btn').click();
    await caseStatus(works, 'รออนุมัติ', 'ขั้น 6 case-status');
    await expect(works.getByTestId('case-step'), 'ขั้น 6 case-step').toHaveText('ขั้นตอน 3/3 · หัวหน้าฝ่าย');
  });
  const head = await staffPage(browser, 'head1');
  await test.step('7 head1 อนุมัติ', async () => {
    await head.goto('/head/approvals');
    await expect(head.getByTestId('approval-row'), 'ขั้น 7 จำนวนแถว').toHaveCount(3);
    await expect(rowBy(head, 'approval-row', 'data-case-no', EG(12)), 'ขั้น 7 แถว 000012').toHaveCount(1);
    await rowBy(head, 'approval-row', 'data-case-no', EG(12)).getByTestId('approval-open').click();
    await head.getByTestId('approve-btn').click();
    await caseStatus(head, 'อนุมัติ', 'ขั้น 7 case-status');
  });
  await test.step('8 ผู้ออกเอกสารคือ off.reg2 (ทะเบียนขั้นแรก)', async () => {
    await openOfficerCase(works, 12);
    await expect(works.getByTestId('issue-btn'), 'ขั้น 8 off.works1 issue-btn').toHaveCount(0);
    await openOfficerCase(page, 12);
    await expect(page.getByTestId('issue-btn'), 'ขั้น 8 off.reg2 issue-btn').toHaveCount(1);
    await page.getByTestId('issue-btn').click();
    await caseStatus(page, 'เสร็จสิ้น', 'ขั้น 8 case-status');
    const code = ((await page.getByTestId('verify-code').textContent()) ?? '').trim();
    const ap = await anonPage(browser);
    await verifyAt(ap, code);
    await expect(ap.getByTestId('verify-signer'), 'ขั้น 8 verify-signer').toHaveText('หัวหน้าฝ่าย');
  });
});

test('TC-WORKFLOW-04 ตีกลับสูงสุด 2 ครั้ง และผลหลังครบ', async ({ page, browser }) => {
  await reset();
  await test.step('ส่วน A SV-01 000020: ตีกลับ 2 ครั้ง ครั้งที่ 3 ไม่ได้', async () => {
    const off = page;
    await loginStaff(off, 'off.reg1');
    const sm = await citizenPage(browser, ID.somchai);
    await openOfficerCase(off, 20);
    await expect(off.getByTestId('return-count'), 'A เริ่มต้น return-count').toHaveText('0');
    await reasonAction(off, 'return', 'xxxxxxxxxx');
    await caseStatus(off, 'รอแก้ไขเอกสาร', 'A 1 case-status');
    await expect(off.getByTestId('return-count'), 'A 1 return-count').toHaveText('1');
    await sm.goto(`/citizen/cases/${EG(20)}`);
    await sm.getByTestId('submit-fix-btn').click();
    await caseStatus(sm, 'กำลังตรวจสอบ', 'A 2 case-status');
    await openOfficerCase(off, 20);
    await reasonAction(off, 'return', 'xxxxxxxxxx');
    await caseStatus(off, 'รอแก้ไขเอกสาร', 'A 3 case-status');
    await expect(off.getByTestId('return-count'), 'A 3 return-count').toHaveText('2');
    await sm.goto(`/citizen/cases/${EG(20)}`);
    await sm.getByTestId('submit-fix-btn').click();
    await caseStatus(sm, 'กำลังตรวจสอบ', 'A 4 case-status');
    await openOfficerCase(off, 20);
    await expect(off.getByTestId('return-btn'), 'A 5 return-btn').toHaveCount(0);
    const r = await api(off, 'POST', `/api/officer/cases/${EG(20)}/return`, { reason: 'xxxxxxxxxx' });
    expect(r.status, 'A 5 return ครั้งที่ 3').toBe(409);
    expect(r.json?.code, 'A 5 code').toBe('RETURN_LIMIT');
    expect(r.json?.message, 'A 5 message').toBe('ตีกลับได้สูงสุด 2 ครั้ง');
    const c = await getCase(off, EG(20));
    expect(c.status, 'A 5 สถานะ').toBe('IN_REVIEW');
    expect(c.returnCount, 'A 5 returnCount').toBe(2);
    await off.reload();
    await expect(off.getByTestId('return-count'), 'A 5 return-count').toHaveText('2');
    await expect(off.getByTestId('approve-btn'), 'A 5 approve-btn').toHaveCount(1);
    await expect(off.getByTestId('reject-btn'), 'A 5 reject-btn').toHaveCount(1);
  });
  await test.step('ส่วน B seed 000023 ตีกลับครบแล้ว', async () => {
    await reset();
    const off = await staffPage(browser, 'off.reg1');
    await openOfficerCase(off, 23);
    await expect(off.getByTestId('return-count'), 'B return-count').toHaveText('2');
    await expect(off.getByTestId('return-btn'), 'B return-btn').toHaveCount(0);
    const r = await api(off, 'POST', `/api/officer/cases/${EG(23)}/return`, { reason: 'xxxxxxxxxx' });
    expect(r.status, 'B return').toBe(409);
    expect(r.json?.code, 'B code').toBe('RETURN_LIMIT');
    const c = await getCase(off, EG(23));
    expect(c.status, 'B สถานะ').toBe('IN_REVIEW');
    await expect(off.getByTestId('approve-btn'), 'B approve-btn').toHaveCount(1);
    await expect(off.getByTestId('reject-btn'), 'B reject-btn').toHaveCount(1);
  });
  await test.step('ส่วน C SV-02 000013 หลังตีกลับครบ', async () => {
    await reset();
    const off = await staffPage(browser, 'off.reg2');
    const sm = await citizenPage(browser, ID.somchai);
    await openOfficerCase(off, 13);
    for (let i = 1; i <= 2; i++) {
      await reasonAction(off, 'return', 'xxxxxxxxxx');
      await caseStatus(off, 'รอแก้ไขเอกสาร', `C ตีกลับครั้งที่ ${i}`);
      await sm.goto(`/citizen/cases/${EG(13)}`);
      await sm.getByTestId('submit-fix-btn').click();
      await caseStatus(sm, 'กำลังตรวจสอบ', `C ส่งแก้ครั้งที่ ${i}`);
      await openOfficerCase(off, 13);
    }
    await expect(off.getByTestId('return-btn'), 'C return-btn').toHaveCount(0);
    await expect(off.getByTestId('approve-btn'), 'C approve-btn').toHaveCount(0);
    await expect(off.getByTestId('reject-btn'), 'C reject-btn').toHaveCount(0);
    await expect(off.getByTestId('forward-btn'), 'C forward-btn').toHaveCount(1);
    const rj = await api(off, 'POST', `/api/cases/${EG(13)}/reject`, { reason: 'xxxxxxxxxx' });
    expect(rj.status, 'C reject ด้วย off.reg2').toBe(403);
    await off.getByTestId('forward-note').fill('ส่งต่อให้หัวหน้าพิจารณา');
    await off.getByTestId('forward-btn').click();
    await caseStatus(off, 'รออนุมัติ', 'C ส่งต่อ');
    const items = (await auditItems('event=FORWARD')).filter((i) => i.caseNo === EG(13));
    expect(items.length, 'C Audit FORWARD ของ 000013').toBeGreaterThanOrEqual(1);
    expect(items.some((i) => String(i.detail).includes('ส่งต่อให้หัวหน้าพิจารณา')), 'C Audit FORWARD detail').toBe(true);
    const head = await staffPage(browser, 'head1');
    await openOfficerCase(head, 13);
    await expect(head.getByTestId('reject-btn'), 'C head1 reject-btn').toHaveCount(1);
    await expect(head.getByTestId('approve-btn'), 'C head1 approve-btn').toHaveCount(1);
  });
});

test('TC-WORKFLOW-05 เหตุผล ≥ 10 ตัวอักษร (ตีกลับ/ไม่อนุมัติ)', async ({ page, browser }) => {
  const TOO_SHORT = 'กรุณากรอกเหตุผลอย่างน้อย 10 ตัวอักษร';
  await reset();
  await test.step('ส่วน A ตีกลับ 000020', async () => {
    await loginStaff(page, 'off.reg1');
    await openOfficerCase(page, 20);
    await reasonAction(page, 'return', 'x'.repeat(9));
    await expect(page.getByTestId('return-reason-error'), 'A 9 ตัว').toHaveText(TOO_SHORT);
    const a9 = await api(page, 'POST', `/api/officer/cases/${EG(20)}/return`, { reason: 'x'.repeat(9) });
    expect(a9.status, 'A API 9 ตัว').toBe(400);
    expect(a9.json?.code, 'A API 9 ตัว code').toBe('REASON_TOO_SHORT');
    await reasonAction(page, 'return', ' '.repeat(10));
    await expect(page.getByTestId('return-reason-error'), 'A เว้นวรรค 10 ตัว').toHaveText(TOO_SHORT);
    const sp = await api(page, 'POST', `/api/officer/cases/${EG(20)}/return`, { reason: ' '.repeat(10) });
    expect(sp.status, 'A API เว้นวรรค 10 ตัว').toBe(400);
    expect((await getCase(page, EG(20))).status, 'A สถานะยังไม่เปลี่ยน').toBe('IN_REVIEW');
    await reasonAction(page, 'return', 'x'.repeat(10));
    await caseStatus(page, 'รอแก้ไขเอกสาร', 'A 10 ตัว case-status');
    const sm = await citizenPage(browser, ID.somchai);
    await sm.goto(`/citizen/cases/${EG(20)}`);
    await expect(sm.getByTestId('return-reason-display'), 'A return-reason-display').toHaveText('xxxxxxxxxx');
  });
  await test.step('ส่วน B ไม่อนุมัติ SV-01 000026', async () => {
    await reset();
    const off = await staffPage(browser, 'off.reg2');
    await openOfficerCase(off, 26);
    await reasonAction(off, 'reject', 'x'.repeat(9));
    await expect(off.getByTestId('reject-reason-error'), 'B 9 ตัว').toHaveText(TOO_SHORT);
    const r9 = await api(off, 'POST', `/api/cases/${EG(26)}/reject`, { reason: 'x'.repeat(9) });
    expect(r9.status, 'B API 9 ตัว').toBe(400);
    await reasonAction(off, 'reject', 'x'.repeat(10));
    await caseStatus(off, 'ไม่อนุมัติ', 'B 10 ตัว case-status');
    await expect(off.getByTestId('closed-at'), 'B closed-at').toHaveAttribute('data-iso', T0);
    await expect(off.getByTestId('sla-level'), 'B sla-level').toHaveText('ปิดแล้ว');
    const sm = await citizenPage(browser, ID.somchai);
    await sm.goto(`/citizen/cases/${EG(26)}`);
    await expect(sm.getByTestId('no-refund-note'), 'B no-refund-note').toBeVisible();
    const ex = await newStaff('exec1');
    const d = await api(ex, 'GET', '/api/dashboard?period=2026-12&service=ALL');
    expect(d.json.closed, 'B closed').toBe(1);
    expect(d.json.onTime, 'B onTime').toBe(1);
  });
  await test.step('ส่วน C หัวหน้าไม่อนุมัติ 000011', async () => {
    await reset();
    const head = await staffPage(browser, 'head1');
    await openOfficerCase(head, 11);
    const r9 = await api(head, 'POST', `/api/cases/${EG(11)}/reject`, { reason: 'x'.repeat(9) });
    expect(r9.status, 'C API 9 ตัว').toBe(400);
    await reasonAction(head, 'reject', 'x'.repeat(9));
    await expect(head.getByTestId('reject-reason-error'), 'C 9 ตัว').toHaveText(TOO_SHORT);
    await reasonAction(head, 'reject', 'x'.repeat(10));
    await caseStatus(head, 'ไม่อนุมัติ', 'C 10 ตัว case-status');
  });
});

test('TC-WORKFLOW-06 เวลาแก้ไข 168 ชั่วโมง', async ({ page, browser }) => {
  await reset();
  await loginCitizen(page, ID.somchai);
  await page.goto(`/citizen/cases/${EG(17)}`);
  await test.step('หน้าตั้งต้น', async () => {
    await caseStatus(page, 'รอแก้ไขเอกสาร', 'ตั้งต้น case-status');
    await expect(page.getByTestId('return-reason-display'), 'ตั้งต้น เหตุผล').toHaveText('ชื่อในเอกสารไม่ตรงกับบัตร กรุณาแก้ไข');
    await expect(page.getByTestId('fix-deadline'), 'ตั้งต้น fix-deadline').toHaveText('4 ธ.ค. 2569 14:00');
    await expect(page.getByTestId('fix-deadline'), 'ตั้งต้น fix-deadline iso').toHaveAttribute('data-iso', '2026-12-04T14:00:00+07:00');
    await expect(page.getByTestId('submit-fix-btn'), 'ตั้งต้น submit-fix-btn').toHaveCount(1);
  });
  await test.step('รอบ A 167:59', async () => {
    await reset();
    await setClock('2026-12-04T13:59:00+07:00');
    const sm = await citizenPage(browser, ID.somchai);
    await sm.goto(`/citizen/cases/${EG(17)}`);
    await expect(sm.getByTestId('submit-fix-btn'), 'A submit-fix-btn').toBeEnabled();
    await sm.getByTestId('submit-fix-btn').click();
    await caseStatus(sm, 'กำลังตรวจสอบ', 'A case-status');
    expect((await getCase(sm, EG(17))).status, 'A API status').toBe('IN_REVIEW');
  });
  await test.step('รอบ B 168:00', async () => {
    await reset();
    await setClock('2026-12-04T14:00:00+07:00');
    const sm = await citizenPage(browser, ID.somchai);
    await sm.goto(`/citizen/cases/${EG(17)}`);
    await caseStatus(sm, 'ยกเลิก', 'B case-status');
    await expect(sm.getByTestId('submit-fix-btn'), 'B submit-fix-btn').toHaveCount(0);
    await expect(sm.getByTestId('no-refund-note'), 'B no-refund-note').toBeVisible();
    const r = await api(sm, 'POST', `/api/cases/${EG(17)}/resubmit`);
    expect(r.status, 'B resubmit').toBe(409);
    const n = await sm.locator('[data-testid="case-timeline"] [data-testid="timeline-item"][data-iso="2026-12-04T14:00:00+07:00"]').count();
    expect(n, 'B timeline-item เวลายกเลิก').toBeGreaterThanOrEqual(1);
    const ex = await newStaff('exec1');
    const d = await api(ex, 'GET', '/api/dashboard?period=2026-12&service=ALL');
    expect(d.json.backlog, 'B backlog').toBe(20);
  });
});

// ───────────────────────── DOC ─────────────────────────

test('TC-DOC-01 ออกเอกสารและข้อมูลใน PDF', async ({ browser }) => {
  await reset();
  const reg2 = await newStaff('off.reg2');
  const ap = await api(reg2, 'POST', `/api/cases/${EG(25)}/approve`);
  expect(ap.status, 'approve 000025').toBe(200);
  const is = await api(reg2, 'POST', `/api/officer/cases/${EG(25)}/issue`);
  expect(is.status, 'issue 000025').toBe(200);
  expect(is.json.docNo, 'docNo').toBe('DOC-2569-000002');
  expect(is.json.status, 'status').toBe('COMPLETED');
  const code: string = is.json.verifyCode;
  expect(code, 'verifyCode').toMatch(/^[A-Z0-9]{8}$/);

  const sy = await newCitizen(ID.somying);
  const pdf = await api(sy, 'GET', '/api/documents/DOC-2569-000002/pdf');
  expect(pdf.status, 'สมหญิง GET pdf').toBe(200);
  expect(pdf.headers['content-type'], 'content-type').toContain('application/pdf');
  expect(pdf.headers['content-disposition'], 'content-disposition').toContain('DOC-2569-000002.pdf');
  expect(await pdfText(pdf.body), 'บรรทัด ASCII ใน PDF').toContain(`docNo=DOC-2569-000002 caseNo=EG-2569-000025 verify=${code} validUntil=2027-02-28`);

  const vp = await anonPage(browser);
  expect(await verifyAt(vp, code), 'HTTP /verify').toBe(200);
  await expect(vp.getByTestId('verify-result'), 'verify-result').toHaveText('เอกสารถูกต้อง');
  await expect(vp.getByTestId('verify-doc-no'), 'verify-doc-no').toHaveText('DOC-2569-000002');
  await expect(vp.getByTestId('verify-applicant'), 'verify-applicant').toHaveText('สมหญิง ร***');
  await expect(vp.getByTestId('verify-service'), 'verify-service').toHaveText('SV-01 ขอหนังสือรับรอง');
  await expect(vp.getByTestId('verify-issued'), 'verify-issued').toHaveAttribute('data-iso', T0);
  await expect(vp.getByTestId('verify-expires'), 'verify-expires').toHaveAttribute('data-iso', '2027-02-28');
  await expect(vp.getByTestId('verify-signer'), 'verify-signer').toHaveText('เจ้าหน้าที่ทะเบียน 2');

  const cp = await citizenPage(browser, ID.somying);
  await cp.goto(`/citizen/cases/${EG(25)}`);
  await expect(cp.getByTestId('doc-qr'), 'doc-qr data-url').toHaveAttribute('data-url', `${BASE_URL}/verify/${code}`);

  const anon = await newApi();
  const v = await api(anon, 'GET', `/api/verify/${code}`);
  expect(v.status, 'GET /api/verify').toBe(200);
  expect(v.json.result, 'result').toBe('VALID');
  expect(v.json.validUntil, 'validUntil').toBe('2027-02-28');
  expect(v.json.issuedAt, 'issuedAt').toBe(T0);

  const sc = await newCitizen(ID.somchai);
  const other = await api(sc, 'GET', '/api/documents/DOC-2569-000002/pdf');
  expect(other.status, 'สมชาย GET pdf ของสมหญิง').toBe(404);

  const again = await api(reg2, 'POST', `/api/officer/cases/${EG(25)}/issue`);
  expect(again.status, 'issue ซ้ำ').toBe(409);
  expect(again.json?.code, 'issue ซ้ำ code').toBe('INVALID_STATE');
  // เอกสารถัดไปในระบบยังเป็น DOC-2569-000003
  expect((await api(reg2, 'POST', `/api/cases/${EG(26)}/approve`)).status, 'approve 000026').toBe(200);
  const next = await api(reg2, 'POST', `/api/officer/cases/${EG(26)}/issue`);
  expect(next.status, 'issue 000026').toBe(200);
  expect(next.json.docNo, 'เอกสารถัดไป').toBe('DOC-2569-000003');
});

test('TC-DOC-02 ตรวจเอกสาร /verify', async ({ browser }) => {
  await reset();
  const p = await anonPage(browser);
  await test.step('K7M2Q9XA', async () => {
    const res = await p.goto('/verify/K7M2Q9XA');
    expect(res!.status(), 'K7M2Q9XA HTTP').toBe(200);
    expect(p.url(), 'ไม่ redirect ไป login').not.toMatch(/\/login/);
    await expect(p.getByTestId('verify-result'), 'verify-result').toHaveText('เอกสารถูกต้อง');
    await expect(p.getByTestId('verify-result'), 'data-result').toHaveAttribute('data-result', 'VALID');
    await expect(p.getByTestId('verify-doc-no'), 'verify-doc-no').toHaveText('DOC-2569-000001');
    await expect(p.getByTestId('verify-applicant'), 'verify-applicant').toHaveText('สมชาย ใ***');
    await expect(p.getByTestId('verify-service'), 'verify-service').toHaveText('SV-01 ขอหนังสือรับรอง');
    await expect(p.getByTestId('verify-issued'), 'verify-issued').toHaveAttribute('data-iso', '2026-11-05T10:00:00+07:00');
    await expect(p.getByTestId('verify-expires'), 'verify-expires').toHaveAttribute('data-iso', '2027-02-02');
    await expect(p.getByTestId('verify-signer'), 'verify-signer').toHaveText('เจ้าหน้าที่ทะเบียน 1');
    const html = await p.content();
    expect(html.includes('ใจดี'), 'หน้าไม่มีนามสกุลเต็ม').toBe(false);
    expect(html.includes('1101700123456'), 'หน้าไม่มีเลขบัตร').toBe(false);
  });
  await test.step('ZZZZZZZZ', async () => {
    const res = await p.goto('/verify/ZZZZZZZZ');
    expect(res!.status(), 'ZZZZZZZZ HTTP').toBe(404);
    await expect(p.getByTestId('verify-result'), 'verify-result').toHaveText('ไม่พบเอกสาร');
    await expect(p.getByTestId('verify-result'), 'data-result').toHaveAttribute('data-result', 'NOT_FOUND');
    await expect(p.getByTestId('verify-applicant'), 'verify-applicant').toHaveCount(0);
    await expect(p.getByTestId('verify-doc-no'), 'verify-doc-no').toHaveCount(0);
  });
  await test.step('API', async () => {
    const a = await newApi();
    const ok = await api(a, 'GET', '/api/verify/K7M2Q9XA');
    expect(ok.status, 'API K7M2Q9XA').toBe(200);
    expect(ok.json.result, 'API result').toBe('VALID');
    expect(ok.json.applicantMasked, 'API applicantMasked').toBe('สมชาย ใ***');
    expect(ok.text.includes('ใจดี'), 'API ไม่มีนามสกุลเต็ม').toBe(false);
    expect(ok.text.includes('1101700123456'), 'API ไม่มีเลขบัตร').toBe(false);
    const nf = await api(a, 'GET', '/api/verify/ZZZZZZZZ');
    expect(nf.status, 'API ZZZZZZZZ').toBe(404);
    expect(nf.json, 'API ZZZZZZZZ body').toEqual({ result: 'NOT_FOUND' });
  });
});

test('TC-DOC-03 เอกสารหมดอายุและลายเซ็นไม่ตรง', async ({ browser }) => {
  test.setTimeout(240_000);
  const expectResult = async (code: string, text: string, data: string, label: string): Promise<Page> => {
    const p = await anonPage(browser);
    expect(await verifyAt(p, code), `${label} HTTP`).toBe(200);
    await expect(p.getByTestId('verify-result'), `${label} verify-result`).toHaveText(text);
    await expect(p.getByTestId('verify-result'), `${label} data-result`).toHaveAttribute('data-result', data);
    return p;
  };
  await test.step('ส่วน A SV-01 90 วัน', async () => {
    await reset();
    const reg2 = await newStaff('off.reg2');
    expect((await api(reg2, 'POST', `/api/cases/${EG(25)}/approve`)).status, 'A approve').toBe(200);
    const is = await api(reg2, 'POST', `/api/officer/cases/${EG(25)}/issue`);
    expect(is.status, 'A issue').toBe(200);
    const c1: string = is.json.verifyCode;
    await setClock('2027-02-28T23:59:00+07:00');
    const p1 = await expectResult(c1, 'เอกสารถูกต้อง', 'VALID', 'A 28 ก.พ. 23:59');
    await expect(p1.getByTestId('verify-expires'), 'A verify-expires').toHaveAttribute('data-iso', '2027-02-28');
    await setClock('2027-03-01T00:00:00+07:00');
    const p2 = await expectResult(c1, 'เอกสารหมดอายุ', 'EXPIRED', 'A 1 มี.ค. 00:00');
    await expect(p2.getByTestId('verify-expires'), 'A หมดอายุ verify-expires').toHaveAttribute('data-iso', '2027-02-28');
  });
  await test.step('ส่วน B SV-02 1 ปี', async () => {
    await reset();
    const reg1 = await newStaff('off.reg1');
    const is = await api(reg1, 'POST', `/api/officer/cases/${EG(19)}/issue`);
    expect(is.status, 'B issue').toBe(200);
    const c2: string = is.json.verifyCode;
    await setClock('2027-11-30T23:59:00+07:00');
    const p1 = await expectResult(c2, 'เอกสารถูกต้อง', 'VALID', 'B 30 พ.ย. 2027 23:59');
    await expect(p1.getByTestId('verify-expires'), 'B verify-expires').toHaveAttribute('data-iso', '2027-11-30');
    await setClock('2027-12-01T00:00:00+07:00');
    await expectResult(c2, 'เอกสารหมดอายุ', 'EXPIRED', 'B 1 ธ.ค. 2027 00:00');
  });
  await test.step('ส่วน C seed K7M2Q9XA', async () => {
    await reset();
    await setClock('2027-02-02T23:59:00+07:00');
    await expectResult('K7M2Q9XA', 'เอกสารถูกต้อง', 'VALID', 'C 2 ก.พ. 23:59');
    await setClock('2027-02-03T00:00:00+07:00');
    await expectResult('K7M2Q9XA', 'เอกสารหมดอายุ', 'EXPIRED', 'C 3 ก.พ. 00:00');
  });
  await test.step('ส่วน D ลายเซ็นไม่ตรง', async () => {
    await reset();
    const anon = await newApi();
    const t = await api(anon, 'POST', '/api/test/documents/DOC-2569-000001/tamper');
    expect(t.status, 'D tamper').toBe(200);
    expect(t.json, 'D tamper body').toEqual({ ok: true });
    const p = await expectResult('K7M2Q9XA', 'ลายเซ็นไม่ถูกต้อง', 'TAMPERED', 'D tampered');
    await expect(p.getByTestId('verify-doc-no'), 'D verify-doc-no').toHaveCount(0);
    await expect(p.getByTestId('verify-applicant'), 'D verify-applicant').toHaveCount(0);
    await setClock('2027-03-01T00:00:00+07:00');
    await expectResult('K7M2Q9XA', 'ลายเซ็นไม่ถูกต้อง', 'TAMPERED', 'D tampered + หมดอายุ');
  });
  await test.step('ส่วน E ออกเอกสาร 29 ก.พ. 2571', async () => {
    await reset();
    await setClock('2028-02-29T10:00:00+07:00');
    const reg2 = await newStaff('off.reg2');
    const reg1 = await newStaff('off.reg1');
    expect((await api(reg2, 'POST', `/api/cases/${EG(25)}/approve`)).status, 'E approve 25').toBe(200);
    const i1 = await api(reg2, 'POST', `/api/officer/cases/${EG(25)}/issue`);
    expect(i1.status, 'E issue 25').toBe(200);
    expect(i1.json.docNo, 'E docNo SV-01').toBe('DOC-2571-000001');
    const i2 = await api(reg1, 'POST', `/api/officer/cases/${EG(19)}/issue`);
    expect(i2.status, 'E issue 19').toBe(200);
    expect(i2.json.docNo, 'E docNo SV-02').toBe('DOC-2571-000002');
    const p1 = await expectResult(i1.json.verifyCode, 'เอกสารถูกต้อง', 'VALID', 'E SV-01 วันออก');
    await expect(p1.getByTestId('verify-expires'), 'E SV-01 verify-expires').toHaveAttribute('data-iso', '2028-05-28');
    const p2 = await expectResult(i2.json.verifyCode, 'เอกสารถูกต้อง', 'VALID', 'E SV-02 วันออก');
    await expect(p2.getByTestId('verify-expires'), 'E SV-02 verify-expires').toHaveAttribute('data-iso', '2029-02-27');
    await setClock('2028-05-28T23:59:00+07:00');
    await expectResult(i1.json.verifyCode, 'เอกสารถูกต้อง', 'VALID', 'E SV-01 28 พ.ค. 23:59');
    await setClock('2028-05-29T00:00:00+07:00');
    await expectResult(i1.json.verifyCode, 'เอกสารหมดอายุ', 'EXPIRED', 'E SV-01 29 พ.ค. 00:00');
    await setClock('2029-02-27T23:59:00+07:00');
    await expectResult(i2.json.verifyCode, 'เอกสารถูกต้อง', 'VALID', 'E SV-02 27 ก.พ. 23:59');
    await setClock('2029-02-28T00:00:00+07:00');
    await expectResult(i2.json.verifyCode, 'เอกสารหมดอายุ', 'EXPIRED', 'E SV-02 28 ก.พ. 00:00');
  });
});

// ───────────────────────── PDPA ─────────────────────────

test('TC-PDPA-01 ปิดบังเลขบัตรบนจอ', async ({ page, browser }) => {
  await reset();
  const MASK = /^X-XXXX-XXXXX-\d{2}-\d$/;
  await test.step('off.reg2 คิว', async () => {
    await loginStaff(page, 'off.reg2');
    await page.goto('/officer/queue');
    await expect(page.getByTestId('queue-row').first(), 'คิวมีแถว').toBeVisible();
    for (const t of await texts(page, 'row-id-masked')) expect(t, 'row-id-masked').toMatch(MASK);
    await expect(rowBy(page, 'queue-row', 'data-case-no', EG(25)).getByTestId('row-id-masked'), 'แถว 000025').toHaveText('X-XXXX-XXXXX-65-9');
    await expect(rowBy(page, 'queue-row', 'data-case-no', EG(26)).getByTestId('row-id-masked'), 'แถว 000026').toHaveText('X-XXXX-XXXXX-45-6');
  });
  await test.step('off.reg2 หน้าคำขอ', async () => {
    await openOfficerCase(page, 25);
    await expect(page.getByTestId('applicant-id'), 'applicant-id').toHaveText('X-XXXX-XXXXX-65-9');
    const html = await page.content();
    expect(html.includes('3100600987659'), 'HTML ไม่มีเลขดิบ').toBe(false);
    expect(html.includes('3-1006-00987-65-9'), 'HTML ไม่มีเลขมีขีด').toBe(false);
  });
  await test.step('head1', async () => {
    const h = await staffPage(browser, 'head1');
    await openOfficerCase(h, 25);
    await expect(h.getByTestId('applicant-id'), 'head1 applicant-id').toHaveText('X-XXXX-XXXXX-65-9');
  });
  await test.step('ประชาชนเห็นของตัวเองเต็ม', async () => {
    const sy = await citizenPage(browser, ID.somying);
    await sy.goto(`/citizen/cases/${EG(25)}`);
    await expect(sy.getByTestId('case-id-full'), 'สมหญิง case-id-full').toHaveText('3-1006-00987-65-9');
    const sc = await citizenPage(browser, ID.somchai);
    await sc.goto(`/citizen/cases/${EG(20)}`);
    await expect(sc.getByTestId('case-id-full'), 'สมชาย case-id-full').toHaveText('1-1017-00123-45-6');
  });
});

test('TC-PDPA-02 API (JSON) ไม่ส่งเลขบัตรเต็ม', async () => {
  await reset();
  const paths = [
    '/api/officer/queue?filter=all', `/api/cases/${EG(25)}`, `/api/cases/${EG(26)}`, `/api/cases/${EG(20)}`,
    '/api/notifications', `/api/cases/${EG(25)}/files`,
  ];
  for (const user of ['off.reg1', 'head1']) {
    const t = await newStaff(user);
    for (const p of paths) {
      const label = `${user} GET ${p}`;
      const r = await api(t, 'GET', p);
      expect(r.status, `${label} status`).toBe(200);
      expect(r.headers['content-type'], `${label} content-type`).toContain('application/json');
      const s = JSON.stringify(r.json);
      expect(/\d{13}/.test(s), `${label} ไม่มี \\d{13}`).toBe(false);
      expect(/\d-\d{4}-\d{5}-\d{2}-\d/.test(s), `${label} ไม่มีเลขมีขีด`).toBe(false);
      expect(deepHasKey(r.json, 'idNo'), `${label} ไม่มี key idNo`).toBe(false);
      for (const v of ['3100600987659', '1101700123456', '1909900555015']) {
        expect(s.includes(v), `${label} ไม่มีสตริง ${v}`).toBe(false);
      }
      if (p.startsWith('/api/officer/queue')) {
        for (const it of r.json.items) expect(it.idMasked, `${label} idMasked ${it.caseNo}`).toMatch(/^X-XXXX-XXXXX-\d{2}-\d$/);
      } else if (/^\/api\/cases\/EG-\d{4}-\d{6}$/.test(p)) {
        expect(r.json.idMasked, `${label} idMasked`).toMatch(/^X-XXXX-XXXXX-\d{2}-\d$/);
      }
    }
  }
});

test('TC-PDPA-03 แสดงเลขเต็มต้องมีเหตุผลและ Audit', async ({ page, browser }) => {
  await reset();
  await loginStaff(page, 'off.reg2');
  await openOfficerCase(page, 25);
  const err = page.getByTestId('unmask-error');
  await test.step('1 เหตุผลว่าง', async () => {
    await page.getByTestId('show-full-id-btn').click();
    await page.getByTestId('unmask-submit').click();
    await expect(err, 'ขั้น 1 unmask-error').toHaveText('กรุณากรอกเหตุผล');
    await expect(page.getByTestId('full-id'), 'ขั้น 1 full-id').toHaveCount(0);
    const r = await api(page, 'POST', `/api/officer/cases/${EG(25)}/unmask`, { reason: '' });
    expect(r.status, 'ขั้น 1 API').toBe(400);
    expect(r.json?.code, 'ขั้น 1 API code').toBe('REASON_REQUIRED');
  });
  await test.step('2 เว้นวรรคล้วน', async () => {
    await page.getByTestId('unmask-reason').fill('   ');
    await page.getByTestId('unmask-submit').click();
    await expect(err, 'ขั้น 2 unmask-error').toHaveText('กรุณากรอกเหตุผล');
    await expect(page.getByTestId('full-id'), 'ขั้น 2 full-id').toHaveCount(0);
  });
  await test.step('3 เหตุผลถูกต้อง', async () => {
    await page.getByTestId('unmask-reason').fill('ตรวจสอบตัวตนซ้ำ');
    await page.getByTestId('unmask-submit').click();
    await expect(page.getByTestId('full-id'), 'ขั้น 3 full-id').toHaveText('3-1006-00987-65-9');
  });
  await test.step('4 โหลดหน้าซ้ำ', async () => {
    await page.reload();
    await expect(page.getByTestId('applicant-id'), 'ขั้น 4 applicant-id').toHaveText('X-XXXX-XXXXX-65-9');
    await expect(page.getByTestId('full-id'), 'ขั้น 4 full-id').toHaveCount(0);
  });
  await test.step('5 Audit UNMASK', async () => {
    const a = await staffPage(browser, 'audit1');
    await a.goto('/audit');
    await a.getByTestId('audit-filter-event').selectOption('UNMASK');
    await a.getByTestId('audit-apply-btn').click();
    await a.waitForURL(/\/audit\?/);
    await expect(a.getByTestId('audit-count'), 'ขั้น 5 audit-count').toHaveText('1');
    const row = a.getByTestId('audit-row');
    await expect(row, 'ขั้น 5 data-actor').toHaveAttribute('data-actor', 'off.reg2');
    await expect(row.getByTestId('audit-role'), 'ขั้น 5 audit-role').toHaveText('officer');
    await expect(row.getByTestId('audit-case-no'), 'ขั้น 5 audit-case-no').toHaveText(EG(25));
    await expect(row.getByTestId('audit-event'), 'ขั้น 5 audit-event').toHaveText('UNMASK');
    await expect(row.getByTestId('audit-detail'), 'ขั้น 5 audit-detail').toContainText('ตรวจสอบตัวตนซ้ำ');
    await expect(row.getByTestId('audit-time'), 'ขั้น 5 audit-time').toHaveAttribute('data-iso', T0);
  });
  await test.step('6 บทบาทอื่น unmask ไม่ได้', async () => {
    const ctxs: Array<[string, any]> = [
      ['exec1', await newStaff('exec1')], ['audit1', await newStaff('audit1')], ['สมหญิง', await newCitizen(ID.somying)],
    ];
    for (const [who, t] of ctxs) {
      const r = await api(t, 'POST', `/api/officer/cases/${EG(25)}/unmask`, { reason: 'x' });
      expect(r.status, `ขั้น 6 ${who} unmask`).toBe(403);
    }
  });
});

// ───────────────────────── DASH ─────────────────────────

test('TC-DASH-01 Dashboard ตัวเลขเริ่มต้น', async ({ page }) => {
  await reset();
  await loginStaff(page, 'exec1');
  await page.goto('/dashboard');
  await test.step('ค่าเริ่มต้นบนจอ', async () => {
    await expect(page.getByTestId('period-select'), 'period-select').toHaveValue('2026-12');
    await expect(page.getByTestId('service-select'), 'service-select').toHaveValue('ALL');
    await expect(page.getByTestId('kpi-received'), 'kpi-received').toHaveText('3');
    await expect(page.getByTestId('kpi-closed'), 'kpi-closed').toHaveText('0');
    await expect(page.getByTestId('kpi-ontime-pct'), 'kpi-ontime-pct').toHaveText('–');
    await expect(page.getByTestId('kpi-backlog'), 'kpi-backlog').toHaveText('21');
    await expect(page.getByTestId('kpi-overdue'), 'kpi-overdue').toHaveText('1');
    await expect(page.getByTestId('workload-row'), 'workload-row').toHaveCount(3);
    const w: Record<string, string> = { 'off.reg1': '3', 'off.reg2': '9', 'off.works1': '0' };
    for (const [u, v] of Object.entries(w)) {
      await expect(rowBy(page, 'workload-row', 'data-username', u).getByTestId('workload-value'), `workload ${u}`).toHaveText(v);
    }
  });
  await test.step('ค่าเริ่มต้นจาก API', async () => {
    const r = await api(page, 'GET', '/api/dashboard?period=2026-12&service=ALL');
    expect(r.status, 'API status').toBe(200);
    expect(r.json.received, 'API received').toBe(3);
    expect(r.json.closed, 'API closed').toBe(0);
    expect(r.json.ontimePct, 'API ontimePct').toBeNull();
    expect(r.json.backlog, 'API backlog').toBe(21);
    expect(r.json.overdue, 'API overdue').toBe(1);
  });
  await test.step('ไม่มีข้อมูลส่วนบุคคล', async () => {
    const body = await page.innerText('body');
    expect(/\d{13}/.test(body), 'ไม่มี \\d{13}').toBe(false);
    expect(/0\d{9}/.test(body), 'ไม่มี 0\\d{9}').toBe(false);
    expect(NAMES.test(body), 'ไม่มีชื่อประชาชน').toBe(false);
  });
  await test.step('ตัวกรองบริการ', async () => {
    const rows: Array<[string, string, string, string, string]> = [
      ['SV-01', '3', '0', '–', '11'], ['SV-02', '0', '0', '–', '7'], ['SV-03', '0', '0', '–', '3'],
    ];
    const overdue: Record<string, string> = { 'SV-01': '1', 'SV-02': '0', 'SV-03': '0' };
    for (const [svc, rec, closed, pct, backlog] of rows) {
      await page.getByTestId('service-select').selectOption(svc);
      await page.waitForURL(new RegExp(`service=${svc}`));
      await expect(page.getByTestId('kpi-received'), `${svc} kpi-received`).toHaveText(rec);
      await expect(page.getByTestId('kpi-closed'), `${svc} kpi-closed`).toHaveText(closed);
      await expect(page.getByTestId('kpi-ontime-pct'), `${svc} kpi-ontime-pct`).toHaveText(pct);
      await expect(page.getByTestId('kpi-backlog'), `${svc} kpi-backlog`).toHaveText(backlog);
      await expect(page.getByTestId('kpi-overdue'), `${svc} kpi-overdue`).toHaveText(overdue[svc]);
      const r = await api(page, 'GET', `/api/dashboard?period=2026-12&service=${svc}`);
      expect(r.json.received, `${svc} API received`).toBe(Number(rec));
      expect(r.json.backlog, `${svc} API backlog`).toBe(Number(backlog));
      expect(r.json.overdue, `${svc} API overdue`).toBe(Number(overdue[svc]));
      expect(r.json.ontimePct, `${svc} API ontimePct`).toBeNull();
    }
  });
});

test('TC-DASH-02 Dashboard ย้อนหลัง พ.ย. ต.ค. รายปี', async ({ page }) => {
  await reset();
  await loginStaff(page, 'exec1');
  const rows: Array<[string, string, number, number, string | null]> = [
    ['2026-10', 'ALL', 1, 1, '100.0%'],
    ['2026-11', 'ALL', 26, 7, '85.7%'],
    ['2026-11', 'SV-01', 12, 3, '100.0%'],
    ['2026-11', 'SV-02', 10, 3, '66.7%'],
    ['2026-11', 'SV-03', 4, 1, '100.0%'],
    ['2026', 'ALL', 30, 8, '87.5%'],
    ['2026', 'SV-01', 16, 4, '100.0%'],
    ['2026', 'SV-02', 10, 3, '66.7%'],
    ['2026', 'SV-03', 4, 1, '100.0%'],
  ];
  const backlog: Record<string, [string, string]> = { ALL: ['21', '1'], 'SV-01': ['11', '1'], 'SV-02': ['7', '0'], 'SV-03': ['3', '0'] };
  for (const [period, svc, rec, closed, pct] of rows) {
    await test.step(`${period} ${svc}`, async () => {
      const label = `${period} ${svc}`;
      await page.goto(`/dashboard?period=${period}&service=${svc}`);
      await expect(page.getByTestId('period-select'), `${label} period-select`).toHaveValue(period);
      await expect(page.getByTestId('service-select'), `${label} service-select`).toHaveValue(svc);
      await expect(page.getByTestId('kpi-received'), `${label} kpi-received`).toHaveText(String(rec));
      await expect(page.getByTestId('kpi-closed'), `${label} kpi-closed`).toHaveText(String(closed));
      await expect(page.getByTestId('kpi-ontime-pct'), `${label} kpi-ontime-pct`).toHaveText(pct!);
      await expect(page.getByTestId('kpi-backlog'), `${label} kpi-backlog`).toHaveText(backlog[svc][0]);
      await expect(page.getByTestId('kpi-overdue'), `${label} kpi-overdue`).toHaveText(backlog[svc][1]);
      const r = await api(page, 'GET', `/api/dashboard?period=${period}&service=${svc}`);
      expect(r.status, `${label} API status`).toBe(200);
      expect(r.json.received, `${label} API received`).toBe(rec);
      expect(r.json.closed, `${label} API closed`).toBe(closed);
      expect(r.json.ontimePct, `${label} API ontimePct`).toBeCloseTo(Number(pct!.replace('%', '')), 1);
      expect(r.json.backlog, `${label} API backlog`).toBe(Number(backlog[svc][0]));
      expect(r.json.overdue, `${label} API overdue`).toBe(Number(backlog[svc][1]));
    });
  }
  await test.step('เลือกผ่าน select', async () => {
    await page.goto('/dashboard');
    await page.getByTestId('period-select').selectOption('2026-11');
    await page.waitForURL(/period=2026-11/);
    await page.getByTestId('service-select').selectOption('SV-02');
    await page.waitForURL(/service=SV-02/);
    await expect(page.getByTestId('kpi-ontime-pct'), 'select 2026-11 SV-02').toHaveText('66.7%');
  });
});

test('TC-DASH-03 ส่งออก Excel/PDF เท่าหน้าจอ และไม่มีข้อมูลส่วนบุคคล', async ({ page }) => {
  await reset();
  await loginStaff(page, 'exec1');
  const noPii = (text: string, label: string) => {
    expect(/\d{13}/.test(text), `${label} ไม่มี \\d{13}`).toBe(false);
    expect(/0\d{9}/.test(text), `${label} ไม่มี 0\\d{9}`).toBe(false);
    expect(NAMES.test(text), `${label} ไม่มีชื่อประชาชน`).toBe(false);
  };
  const kpis = async (): Promise<string[]> => {
    const out: string[] = [];
    for (const k of ['received', 'closed', 'ontime-pct', 'backlog', 'overdue']) {
      out.push(((await page.getByTestId(`kpi-${k}`).textContent()) ?? '').trim());
    }
    return out;
  };
  let pdfUrl = '';
  await page.goto('/dashboard?period=2026-11&service=ALL');
  await test.step('xlsx พ.ย.', async () => {
    expect(await kpis(), 'kpi บนจอ พ.ย.').toEqual(['26', '7', '85.7%', '21', '1']);
    const buf = await downloadOf(page, 'export-xlsx-btn');
    const rows = await readXlsx(buf);
    const labels = ['รับเรื่อง', 'ปิดงาน', 'ทันกำหนด %', 'งานคงค้าง', 'เกินกำหนดคงค้าง'];
    const screen = await kpis();
    for (let i = 0; i < 5; i++) {
      expect(rows[i + 1][0], `xlsx พ.ย. แถว ${i + 2} คอลัมน์ A`).toBe(labels[i]);
      expect(rows[i + 1][1], `xlsx พ.ย. แถว ${i + 2} คอลัมน์ B`).toBe(['26', '7', '85.7%', '21', '1'][i]);
      expect(rows[i + 1][1], `xlsx พ.ย. แถว ${i + 2} เท่าหน้าจอ`).toBe(screen[i]);
    }
    noPii(rows.map((r) => r.join(' ')).join('\n'), 'xlsx พ.ย.');
  });
  await test.step('pdf พ.ย.', async () => {
    // ลิงก์ดาวน์โหลด: Chromium ไม่ส่ง response/route/CDP event ของไฟล์ดาวน์โหลดให้ test
    // → เก็บ URL ไว้ ตรวจ Content-Type ด้วย GET ซ้ำ "หลัง" ขั้น Audit (ไม่ให้ Audit EXPORT เกิน 3 ตอนตรวจ)
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-pdf-btn').click(),
    ]);
    pdfUrl = dl.url();
    const text = await pdfText(fs.readFileSync(await dl.path()));
    expect(text, 'pdf บรรทัด kpi').toContain('kpi received=26 closed=7 ontime=85.7% backlog=21 overdue=1');
    noPii((await pdfParseText(fs.readFileSync(await dl.path()))), 'pdf พ.ย.');
  });
  await test.step('xlsx ธ.ค.', async () => {
    await page.goto('/dashboard?period=2026-12&service=ALL');
    expect(await kpis(), 'kpi บนจอ ธ.ค.').toEqual(['3', '0', '–', '21', '1']);
    const buf = await downloadOf(page, 'export-xlsx-btn');
    const rows = await readXlsx(buf);
    ['3', '0', '–', '21', '1'].forEach((v, i) => expect(rows[i + 1][1], `xlsx ธ.ค. แถว ${i + 2}`).toBe(v));
    noPii(rows.map((r) => r.join(' ')).join('\n'), 'xlsx ธ.ค.');
  });
  await test.step('Audit EXPORT = 3', async () => {
    const items = await auditItems('event=EXPORT');
    expect(items.length, 'Audit EXPORT จำนวน').toBe(3);
    for (const it of items) {
      expect(it.username, 'EXPORT username').toBe('exec1');
      expect(it.role, 'EXPORT role').toBe('executive');
    }
    const details = items.map((i) => String(i.detail));
    expect(details.filter((d) => d.includes('xlsx')).length, 'EXPORT xlsx').toBe(2);
    expect(details.filter((d) => d.includes('pdf')).length, 'EXPORT pdf').toBe(1);
    expect(details.filter((d) => d.includes('2026-11')).length, 'EXPORT 2026-11').toBe(2);
    expect(details.filter((d) => d.includes('2026-12')).length, 'EXPORT 2026-12').toBe(1);
  });
  await test.step('pdf พ.ย. Content-Type (ตรวจหลัง Audit)', async () => {
    const r = await page.request.get(pdfUrl);
    expect(r.headers()['content-type'], 'pdf content-type').toContain('application/pdf');
  });
});

/** ข้อความที่ pdf-parse ดึงได้ (ไม่รวมไบต์ดิบ) */
async function pdfParseText(buf: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pp: (b: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js');
  return (await pp(new Uint8Array(buf) as any)).text;
}

test('TC-DASH-04 ค่าขอบ "ทันกำหนด" 16:29:59 / 16:30:00 / 16:30:01', async ({ page, browser }) => {
  await reset();
  await setClock('2026-12-03T16:00:00+07:00');
  const reg1 = await newStaff('off.reg1');
  const reg2 = await newStaff('off.reg2');
  await loginStaff(page, 'exec1');
  const reg2Page = await staffPage(browser, 'off.reg2');
  const reg1Page = await staffPage(browser, 'off.reg1');
  const check = async (label: string, closed: number, onTime: number) => {
    const d = await api(page, 'GET', '/api/dashboard?period=2026-12&service=ALL');
    expect(d.status, `${label} dashboard status`).toBe(200);
    expect(d.json.closed, `${label} API closed`).toBe(closed);
    expect(d.json.onTime, `${label} API onTime`).toBe(onTime);
    await page.goto('/dashboard');
    await expect(page.getByTestId('kpi-closed'), `${label} kpi-closed`).toHaveText(String(closed));
  };
  await test.step('1 อนุมัติที่ 16:00:00', async () => {
    expect((await api(reg2, 'POST', `/api/cases/${EG(25)}/approve`)).status, '1 off.reg2 approve 25').toBe(200);
    expect((await api(reg1, 'POST', `/api/cases/${EG(23)}/approve`)).status, '1 off.reg1 approve 23').toBe(200);
    expect((await getCase(reg2, EG(25))).status, '1 สถานะ 25').toBe('APPROVED');
    expect((await getCase(reg1, EG(23))).status, '1 สถานะ 23').toBe('APPROVED');
  });
  await test.step('2 issue ที่ 16:29:59', async () => {
    await setClock('2026-12-03T16:29:59+07:00');
    const r = await api(reg2, 'POST', `/api/officer/cases/${EG(25)}/issue`);
    expect(r.status, '2 issue 25').toBe(200);
    expect((await getCase(reg2, EG(25))).closedAt, '2 closedAt').toBe('2026-12-03T16:29:59+07:00');
    await openOfficerCase(reg2Page, 25);
    await expect(reg2Page.getByTestId('closed-at'), '2 closed-at').toHaveAttribute('data-iso', '2026-12-03T16:29:59+07:00');
    await check('2', 1, 1);
  });
  await test.step('3 reject ที่ 16:30:00', async () => {
    await setClock('2026-12-03T16:30:00+07:00');
    const r = await api(reg2, 'POST', `/api/cases/${EG(26)}/reject`, { reason: 'xxxxxxxxxx' });
    expect(r.status, '3 reject 26').toBe(200);
    expect((await getCase(reg2, EG(26))).closedAt, '3 closedAt').toBe('2026-12-03T16:30:00+07:00');
    await openOfficerCase(reg2Page, 26);
    await expect(reg2Page.getByTestId('closed-at'), '3 closed-at').toHaveAttribute('data-iso', '2026-12-03T16:30:00+07:00');
    await check('3', 2, 2);
  });
  await test.step('4 issue ที่ 16:30:01', async () => {
    await setClock('2026-12-03T16:30:01+07:00');
    const r = await api(reg1, 'POST', `/api/officer/cases/${EG(23)}/issue`);
    expect(r.status, '4 issue 23').toBe(200);
    expect((await getCase(reg1, EG(23))).closedAt, '4 closedAt').toBe('2026-12-03T16:30:01+07:00');
    await openOfficerCase(reg1Page, 23);
    await expect(reg1Page.getByTestId('closed-at'), '4 closed-at').toHaveAttribute('data-iso', '2026-12-03T16:30:01+07:00');
    await check('4', 3, 2);
    await expect(page.getByTestId('kpi-backlog'), '4 kpi-backlog').toHaveText('18');
    const d = await api(page, 'GET', '/api/dashboard?period=2026-12&service=ALL');
    expect(d.json.backlog, '4 API backlog').toBe(18);
  });
});

// ───────────────────────── AUDIT ─────────────────────────

test('TC-AUDIT-01 เหตุการณ์และฟิลด์ใน Audit', async ({ page }) => {
  await reset();
  const rows: Array<{ id: number; event: string; actor: string; caseNo: string; role: string; transition: string; detail: string; iso: string }> = [];
  await test.step('ทำรายการ', async () => {
    const reg2 = await newStaff('off.reg2');
    expect((await api(reg2, 'POST', `/api/officer/cases/${EG(28)}/claim`)).status, '1 claim 28').toBe(200);
    const reg1 = await newStaff('off.reg1');
    expect((await api(reg1, 'POST', `/api/officer/cases/${EG(20)}/return`, { reason: 'xxxxxxxxxx' })).status, '2 return 20').toBe(200);
    expect((await api(reg2, 'POST', `/api/officer/cases/${EG(13)}/forward`, {})).status, '3 forward 13').toBe(200);
    const head = await newStaff('head1');
    expect((await api(head, 'POST', `/api/cases/${EG(13)}/approve`)).status, '4 head1 approve 13').toBe(200);
    expect((await api(reg2, 'POST', `/api/cases/${EG(25)}/approve`)).status, '5 approve 25').toBe(200);
    expect((await api(reg2, 'POST', `/api/officer/cases/${EG(25)}/issue`)).status, '5 issue 25').toBe(200);
    expect((await api(reg2, 'POST', `/api/cases/${EG(26)}/reject`, { reason: 'xxxxxxxxxx' })).status, '5 reject 26').toBe(200);
    expect((await api(reg2, 'POST', `/api/officer/cases/${EG(25)}/unmask`, { reason: 'ตรวจสอบตัวตนซ้ำ' })).status, '5 unmask 25').toBe(200);
    const ex = await newStaff('exec1');
    expect((await api(ex, 'GET', '/api/dashboard/export?format=xlsx&period=2026-12&service=ALL')).status, '6 export').toBe(200);
    const ad = await newStaff('admin1');
    expect((await api(ad, 'PUT', '/api/admin/services/SV-01', { fee: 25, sla: 3 })).status, '7 admin PUT SV-01').toBe(200);
    await loginStaff(page, 'audit1');
  });
  await test.step('ไม่กรอง 16 แถว', async () => {
    await page.goto('/audit');
    await expect(page.getByTestId('audit-count'), 'audit-count').toHaveText('16');
    await expect(page.getByTestId('audit-row'), 'audit-row').toHaveCount(16);
    const n = await page.getByTestId('audit-row').count();
    for (let i = 0; i < n; i++) {
      const r = page.getByTestId('audit-row').nth(i);
      rows.push({
        id: Number(await r.getAttribute('data-id')),
        event: (await r.getAttribute('data-event')) ?? '',
        actor: (await r.getAttribute('data-actor')) ?? '',
        caseNo: ((await r.getByTestId('audit-case-no').textContent()) ?? '').trim(),
        role: ((await r.getByTestId('audit-role').textContent()) ?? '').trim(),
        transition: ((await r.getByTestId('audit-transition').textContent()) ?? '').trim(),
        detail: ((await r.getByTestId('audit-detail').textContent()) ?? '').trim(),
        iso: (await r.getByTestId('audit-time').getAttribute('data-iso')) ?? '',
      });
    }
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].id, `เรียงใหม่→เก่า แถว ${i}`).toBeGreaterThan(rows[i].id);
    for (const r of rows) expect(r.iso, `audit-time ${r.event} ${r.id}`).toBe(T0);
    const count = (e: string) => rows.filter((r) => r.event === e).length;
    const expectCounts: Record<string, number> = { STAFF_LOGIN: 6, CLAIM: 1, RETURN: 1, FORWARD: 1, APPROVE: 2, ISSUE: 1, REJECT: 1, UNMASK: 1, EXPORT: 1, ADMIN_CHANGE: 1 };
    for (const [e, c] of Object.entries(expectCounts)) expect(count(e), `จำนวน ${e}`).toBe(c);
    const logins = rows.filter((r) => r.event === 'STAFF_LOGIN');
    expect(logins.map((r) => r.actor).sort(), 'STAFF_LOGIN ผู้ทำ').toEqual(['admin1', 'audit1', 'exec1', 'head1', 'off.reg1', 'off.reg2']);
    for (const l of logins) expect(l.transition, `STAFF_LOGIN ${l.actor} transition`).toBe('–');
    const one = (e: string, caseNo?: string) => rows.find((r) => r.event === e && (caseNo === undefined || r.caseNo === caseNo))!;
    const claim = one('CLAIM');
    expect([claim.actor, claim.role, claim.caseNo, claim.transition], 'CLAIM').toEqual(['off.reg2', 'officer', EG(28), 'SUBMITTED → IN_REVIEW']);
    const ret = one('RETURN');
    expect([ret.actor, ret.role, ret.caseNo, ret.transition], 'RETURN').toEqual(['off.reg1', 'officer', EG(20), 'IN_REVIEW → NEED_FIX']);
    expect(ret.detail, 'RETURN detail').toContain('xxxxxxxxxx');
    const fw = one('FORWARD');
    expect([fw.actor, fw.role, fw.caseNo, fw.transition], 'FORWARD').toEqual(['off.reg2', 'officer', EG(13), 'IN_REVIEW → PENDING_APPROVAL']);
    const a13 = one('APPROVE', EG(13));
    expect([a13.actor, a13.role, a13.transition], 'APPROVE 13').toEqual(['head1', 'head', 'PENDING_APPROVAL → APPROVED']);
    const a25 = one('APPROVE', EG(25));
    expect([a25.actor, a25.role, a25.transition], 'APPROVE 25').toEqual(['off.reg2', 'officer', 'IN_REVIEW → APPROVED']);
    const is = one('ISSUE');
    expect([is.actor, is.role, is.caseNo, is.transition], 'ISSUE').toEqual(['off.reg2', 'officer', EG(25), 'APPROVED → COMPLETED']);
    expect(is.detail, 'ISSUE detail').toContain('DOC-2569-000002');
    const rj = one('REJECT');
    expect([rj.actor, rj.role, rj.caseNo, rj.transition], 'REJECT').toEqual(['off.reg2', 'officer', EG(26), 'IN_REVIEW → REJECTED']);
    expect(rj.detail, 'REJECT detail').toContain('xxxxxxxxxx');
    const um = one('UNMASK');
    expect([um.actor, um.role, um.caseNo, um.transition], 'UNMASK').toEqual(['off.reg2', 'officer', EG(25), '–']);
    expect(um.detail, 'UNMASK detail').toContain('ตรวจสอบตัวตนซ้ำ');
    const ep = one('EXPORT');
    expect([ep.actor, ep.role, ep.transition], 'EXPORT').toEqual(['exec1', 'executive', '–']);
    expect(ep.detail, 'EXPORT detail xlsx').toContain('xlsx');
    expect(ep.detail, 'EXPORT detail period').toContain('2026-12');
    const ac = one('ADMIN_CHANGE');
    expect([ac.actor, ac.role, ac.transition], 'ADMIN_CHANGE').toEqual(['admin1', 'admin', '–']);
    expect(ac.detail, 'ADMIN_CHANGE detail').toContain('SV-01 fee 20 → 25');
  });
  await test.step('กรอง', async () => {
    await page.goto('/audit');
    await page.getByTestId('audit-filter-actor').fill('off.reg2');
    await page.getByTestId('audit-apply-btn').click();
    await page.waitForURL(/\/audit\?/);
    await expect(page.getByTestId('audit-count'), 'actor off.reg2').toHaveText('7');
    await page.goto('/audit');
    await page.getByTestId('audit-filter-event').selectOption('APPROVE');
    await page.getByTestId('audit-apply-btn').click();
    await page.waitForURL(/\/audit\?/);
    await expect(page.getByTestId('audit-count'), 'event APPROVE').toHaveText('2');
    expect((await dataAttrs(page, 'audit-row', ['data-actor'])).map((r) => r['data-actor']).sort(), 'APPROVE ผู้ทำ').toEqual(['head1', 'off.reg2']);
    await page.goto('/audit');
    await page.getByTestId('audit-filter-actor').fill('off.reg2');
    await page.getByTestId('audit-filter-event').selectOption('APPROVE');
    await page.getByTestId('audit-apply-btn').click();
    await page.waitForURL(/\/audit\?/);
    await expect(page.getByTestId('audit-count'), 'actor+event').toHaveText('1');
  });
  await test.step('CSV', async () => {
    await page.goto('/audit');
    const buf = await downloadOf(page, 'audit-export-csv-btn');
    const lines = buf.toString('utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
    expect(lines[0], 'CSV หัวตาราง').toBe('time,username,role,event,caseNo,fromStatus,toStatus,detail');
    expect(lines.length - 1, 'CSV จำนวนแถวข้อมูล').toBe(16);
    await page.goto('/audit');
    await expect(page.getByTestId('audit-count'), 'audit-count หลังส่งออก').toHaveText('17');
  });
});

test('TC-AUDIT-02 Audit แก้/ลบไม่ได้ (405)', async ({ page }) => {
  await reset();
  await loginStaff(page, 'audit1');
  const before = await api(page, 'GET', '/api/audit');
  expect(before.status, 'GET /api/audit ก่อน').toBe(200);
  const beforeItems: any[] = before.json.items;
  const id = beforeItems[0].id;
  const admin = await newStaff('admin1');
  for (const [who, t] of [['admin1', admin], ['audit1', page]] as Array<[string, any]>) {
    await test.step(`ในชื่อ ${who}`, async () => {
      const cases: Array<[string, string, unknown]> = [
        ['PUT', `/api/audit/${id}`, { detail: 'x' }], ['PATCH', `/api/audit/${id}`, { detail: 'x' }], ['DELETE', `/api/audit/${id}`, undefined],
        ['PUT', '/api/audit', { detail: 'x' }], ['DELETE', '/api/audit', undefined], ['DELETE', '/api/audit/999999', undefined],
      ];
      for (const [m, p, b] of cases) {
        const r = await api(t, m, p, b);
        expect(r.status, `${who} ${m} ${p}`).toBe(405);
        if (p === `/api/audit/${id}` && m === 'PUT') expect(r.json?.code, `${who} ${m} ${p} code`).toBe('METHOD_NOT_ALLOWED');
      }
    });
  }
  await test.step('ข้อมูลเดิมไม่ถูกแก้หรือหาย', async () => {
    const after = await api(page, 'GET', '/api/audit');
    const afterItems: any[] = after.json.items;
    for (const b of beforeItems) {
      const a = afterItems.find((x) => x.id === b.id);
      expect(a, `แถว id ${b.id} ยังอยู่`).toBeDefined();
      expect(a, `แถว id ${b.id} ไม่ถูกแก้`).toEqual(b);
    }
    expect(afterItems.length - beforeItems.length, 'จำนวนที่เพิ่ม').toBe(1);
    const added = afterItems.filter((x) => !beforeItems.some((b) => b.id === x.id));
    expect([added[0].event, added[0].username], 'แถวที่เพิ่ม').toEqual(['STAFF_LOGIN', 'admin1']);
  });
  await test.step('UI และ admin อ่านไม่ได้', async () => {
    await page.goto('/audit');
    await expect(page.getByTestId('audit-edit-btn'), 'audit-edit-btn').toHaveCount(0);
    await expect(page.getByTestId('audit-delete-btn'), 'audit-delete-btn').toHaveCount(0);
    const r = await api(admin, 'GET', '/api/audit');
    expect(r.status, 'admin1 GET /api/audit').toBe(403);
  });
});

test('TC-AUDIT-03 กรองช่วงวันที่ตามเวลาไทย', async ({ page }) => {
  await reset();
  // L1..L5
  await setClock('2026-11-30T23:59:59+07:00');
  await loginStaff(await newApi(), 'off.reg1');
  await setClock('2026-12-01T00:00:00+07:00');
  await loginStaff(await newApi(), 'off.reg2');
  await setClock('2026-12-01T23:59:59+07:00');
  await loginStaff(await newApi(), 'off.works1');
  await setClock('2026-12-02T00:00:00+07:00');
  await loginStaff(await newApi(), 'off.reg1');
  await setClock('2026-12-02T09:00:00+07:00');
  await loginStaff(page, 'audit1');
  const L = {
    L1: '2026-11-30T23:59:59+07:00', L2: '2026-12-01T00:00:00+07:00', L3: '2026-12-01T23:59:59+07:00',
    L4: '2026-12-02T00:00:00+07:00', L5: '2026-12-02T09:00:00+07:00',
  };
  const table: Array<{ from: string; to: string; actor?: string; want: Array<keyof typeof L> }> = [
    { from: '2026-12-01', to: '2026-12-01', want: ['L2', 'L3'] },
    { from: '2026-11-30', to: '2026-11-30', want: ['L1'] },
    { from: '2026-11-30', to: '2026-12-01', want: ['L1', 'L2', 'L3'] },
    { from: '2026-12-02', to: '', want: ['L4', 'L5'] },
    { from: '', to: '2026-11-30', want: ['L1'] },
    { from: '2026-12-01', to: '2026-12-02', want: ['L2', 'L3', 'L4', 'L5'] },
    { from: '2026-12-01', to: '2026-12-01', actor: 'off.reg2', want: ['L2'] },
  ];
  for (const row of table) {
    await test.step(`from=${row.from || '-'} to=${row.to || '-'} actor=${row.actor ?? '-'}`, async () => {
      const label = `from=${row.from} to=${row.to} actor=${row.actor ?? ''}`;
      const want = row.want.map((k) => L[k]).sort();
      const q = `from=${row.from}&to=${row.to}${row.actor ? `&actor=${row.actor}` : ''}`;
      const r = await api(page, 'GET', `/api/audit?${q}`);
      expect(r.status, `API ${label}`).toBe(200);
      expect((r.json.items as any[]).map((i) => i.time).sort(), `API เวลาของแถว ${label}`).toEqual(want);
      expect(r.json.count, `API count ${label}`).toBe(want.length);
      await page.goto('/audit');
      if (row.actor) await page.getByTestId('audit-filter-actor').fill(row.actor);
      if (row.from) await page.getByTestId('audit-filter-from').fill(row.from);
      if (row.to) await page.getByTestId('audit-filter-to').fill(row.to);
      await page.getByTestId('audit-apply-btn').click();
      await page.waitForURL(/\/audit\?/);
      await expect(page.getByTestId('audit-count'), `จอ audit-count ${label}`).toHaveText(String(want.length));
      const isos = (await dataAttrs(page, 'audit-time', ['data-iso'])).map((x) => x['data-iso']).sort();
      expect(isos, `จอ audit-time ${label}`).toEqual(want);
    });
  }
});

// ───────────────────────── RBAC ─────────────────────────

test('TC-RBAC-01 ประชาชนเปิดคำขอคนอื่นไม่ได้ (IDOR)', async ({ page }) => {
  await reset();
  await loginCitizen(page, ID.somying);
  const body404 = { code: 'NOT_FOUND', message: 'ไม่พบคำขอ' };
  await test.step('UI ของสมชาย', async () => {
    const res = await page.goto(`/citizen/cases/${EG(5)}`);
    expect(res!.status(), 'UI 000005 HTTP').toBe(404);
    await expect(page.getByTestId('not-found-msg'), 'UI not-found-msg').toHaveText('ไม่พบคำขอ');
    await expect(page.getByTestId('case-no'), 'UI case-no').toHaveCount(0);
    await expect(page.getByTestId('case-status'), 'UI case-status').toHaveCount(0);
    expect((await page.content()).includes('สมชาย'), 'UI HTML ไม่มีชื่อสมชาย').toBe(false);
  });
  await test.step('API', async () => {
    const other = await api(page, 'GET', `/api/cases/${EG(5)}`);
    expect(other.status, 'GET 000005').toBe(404);
    expect(other.json, 'GET 000005 body').toEqual(body404);
    const none = await api(page, 'GET', '/api/cases/EG-2569-999999');
    expect(none.status, 'GET 999999').toBe(404);
    expect(none.text, 'GET 999999 ตรงกับของคนอื่นทุกตัวอักษร').toBe(other.text);
    expect((await api(page, 'GET', '/api/documents/DOC-2569-000001/pdf')).status, 'GET เอกสารของสมชาย').toBe(404);
    expect((await api(page, 'GET', '/api/drafts/DR-0001')).status, 'GET ร่างของสมชาย').toBe(404);
    expect((await api(page, 'POST', `/api/cases/${EG(30)}/cancel`)).status, 'POST cancel 000030').toBe(404);
  });
  await test.step('ของตัวเอง', async () => {
    const res = await page.goto(`/citizen/cases/${EG(7)}`);
    expect(res!.status(), 'UI 000007 HTTP').toBe(200);
    await expect(page.getByTestId('case-no'), 'UI 000007 case-no').toHaveText(EG(7));
    const sc = await newCitizen(ID.somchai);
    expect((await api(sc, 'GET', `/api/cases/${EG(5)}`)).status, 'สมชาย GET 000005').toBe(200);
  });
});

test('TC-RBAC-02 เจ้าหน้าที่อนุมัติ SV-02 ไม่ได้ (API)', async ({ page }) => {
  await reset();
  await loginStaff(page, 'off.reg2');
  const st = async (n: number) => (await getCase(page, EG(n))).status as string;
  await test.step('1–3 off.reg2 ใช้ API', async () => {
    const a14 = await api(page, 'POST', `/api/cases/${EG(14)}/approve`);
    expect(a14.status, '1 approve 000014').toBe(403);
    expect(a14.json?.code, '1 code').toBe('FORBIDDEN');
    expect(await st(14), '1 สถานะ 14').toBe('PENDING_APPROVAL');
    const a13 = await api(page, 'POST', `/api/cases/${EG(13)}/approve`);
    expect(a13.status, '2 approve 000013').toBe(403);
    expect(await st(13), '2 สถานะ 13').toBe('IN_REVIEW');
    const r14 = await api(page, 'POST', `/api/cases/${EG(14)}/reject`, { reason: 'xxxxxxxxxx' });
    expect(r14.status, '3 reject 000014').toBe(403);
    expect(await st(14), '3 สถานะ 14').toBe('PENDING_APPROVAL');
  });
  await test.step('4 UI', async () => {
    for (const n of [13, 14]) {
      await openOfficerCase(page, n);
      await expect(page.getByTestId('approve-btn'), `4 approve-btn ${EG(n)}`).toHaveCount(0);
    }
  });
  const head = await newStaff('head1');
  await test.step('5–6 head1', async () => {
    const a25 = await api(head, 'POST', `/api/cases/${EG(25)}/approve`);
    expect(a25.status, '5 head1 approve 000025').toBe(403);
    const a14 = await api(head, 'POST', `/api/cases/${EG(14)}/approve`);
    expect(a14.status, '6 head1 approve 000014').toBe(200);
    expect(a14.json?.status, '6 status').toBe('APPROVED');
  });
  await test.step('7 Audit APPROVE', async () => {
    const items = await auditItems('event=APPROVE');
    expect(items.length, '7 จำนวน APPROVE').toBe(1);
    expect(items[0].username, '7 ผู้ทำ').toBe('head1');
    expect(items.some((i) => i.username === 'off.reg2'), '7 ไม่มี APPROVE ของ off.reg2').toBe(false);
  });
});

test('TC-RBAC-03 ตารางสิทธิ์หน้า/API ตามบทบาท', async ({ page, browser }) => {
  test.setTimeout(240_000);
  type Role = 'anon' | 'citizen' | 'officer' | 'head' | 'executive' | 'auditor' | 'admin';
  const roles: Role[] = ['anon', 'citizen', 'officer', 'head', 'executive', 'auditor', 'admin'];
  const who: Record<Exclude<Role, 'anon' | 'citizen'>, string> = { officer: 'off.reg1', head: 'head1', executive: 'exec1', auditor: 'audit1', admin: 'admin1' };
  type Cell = 'ok' | 403 | 'login';
  const pages: Array<[string, Record<Role, Cell>]> = [
    ['/citizen', { anon: 'login', citizen: 'ok', officer: 403, head: 403, executive: 403, auditor: 403, admin: 403 }],
    ['/officer/queue', { anon: 'login', citizen: 403, officer: 'ok', head: 'ok', executive: 403, auditor: 403, admin: 403 }],
    ['/head/approvals', { anon: 'login', citizen: 403, officer: 403, head: 'ok', executive: 403, auditor: 403, admin: 403 }],
    ['/dashboard', { anon: 'login', citizen: 403, officer: 403, head: 403, executive: 'ok', auditor: 403, admin: 403 }],
    ['/audit', { anon: 'login', citizen: 403, officer: 403, head: 403, executive: 403, auditor: 'ok', admin: 403 }],
    ...['/admin/services', '/admin/holidays', '/admin/users'].map((u): [string, Record<Role, Cell>] =>
      [u, { anon: 'login', citizen: 403, officer: 403, head: 403, executive: 403, auditor: 403, admin: 'ok' }]),
    ['/notifications', { anon: 'login', citizen: 403, officer: 'ok', head: 'ok', executive: 403, auditor: 403, admin: 403 }],
    ['/verify/K7M2Q9XA', { anon: 'ok', citizen: 'ok', officer: 'ok', head: 'ok', executive: 'ok', auditor: 'ok', admin: 'ok' }],
  ];
  type ApiRow = { m: string; p: string; body?: unknown; exp: Record<Role, number> };
  const apis: ApiRow[] = [
    { m: 'GET', p: '/api/officer/queue', exp: { anon: 401, citizen: 403, officer: 200, head: 200, executive: 403, auditor: 403, admin: 403 } },
    { m: 'GET', p: '/api/notifications', exp: { anon: 401, citizen: 403, officer: 200, head: 200, executive: 403, auditor: 403, admin: 403 } },
    { m: 'GET', p: '/api/dashboard?period=2026-12&service=ALL', exp: { anon: 401, citizen: 403, officer: 403, head: 403, executive: 200, auditor: 403, admin: 403 } },
    { m: 'GET', p: '/api/audit', exp: { anon: 401, citizen: 403, officer: 403, head: 403, executive: 403, auditor: 200, admin: 403 } },
    { m: 'GET', p: '/api/admin/services', exp: { anon: 401, citizen: 403, officer: 403, head: 403, executive: 403, auditor: 403, admin: 200 } },
    { m: 'POST', p: '/api/drafts', body: { serviceId: 'SV-01', qty: 1 }, exp: { anon: 401, citizen: 201, officer: 403, head: 403, executive: 403, auditor: 403, admin: 403 } },
    { m: 'GET', p: `/api/cases/${EG(25)}`, exp: { anon: 401, citizen: 200, officer: 200, head: 200, executive: 403, auditor: 403, admin: 403 } },
    { m: 'POST', p: `/api/officer/cases/${EG(28)}/claim`, exp: { anon: 401, citizen: 403, officer: 200, head: 403, executive: 403, auditor: 403, admin: 403 } },
  ];
  const nav: Record<Role, string[]> = {
    anon: [], citizen: ['nav-my-cases'], officer: ['nav-queue', 'nav-bell'], head: ['nav-queue', 'nav-approvals', 'nav-bell'],
    executive: ['nav-dashboard'], auditor: ['nav-audit'], admin: ['nav-admin-services', 'nav-admin-holidays', 'nav-admin-users'],
  };
  const allNav = ['nav-my-cases', 'nav-queue', 'nav-approvals', 'nav-bell', 'nav-dashboard', 'nav-audit', 'nav-admin-services', 'nav-admin-holidays', 'nav-admin-users'];
  const landing: Record<Role, string> = { anon: '/login', citizen: '/citizen', officer: '/officer/queue', head: '/head/approvals', executive: '/dashboard', auditor: '/audit', admin: '/admin/services' };

  for (const role of roles) {
    await test.step(`บทบาท ${role}`, async () => {
      await reset();
      await page.context().clearCookies();
      let t: any = await newApi();
      let sy: any = null;
      if (role === 'citizen') {
        await loginCitizen(page, ID.somchai);
        t = await newCitizen(ID.somchai);
        sy = await newCitizen(ID.somying);
      } else if (role !== 'anon') {
        await loginStaff(page, who[role]);
        t = await newStaff(who[role]);
      }
      for (const [url, exp] of pages) {
        const e = exp[role];
        const res = await page.goto(url);
        const label = `A ${role} ${url}`;
        if (e === 'ok') expect(res!.status(), `${label} status`).toBe(200);
        else if (e === 403) {
          expect(res!.status(), `${label} status`).toBe(403);
          await expect(page.getByTestId('forbidden-msg'), `${label} forbidden-msg`).toHaveText('ไม่มีสิทธิ์เข้าถึงหน้านี้');
        } else expect(page.url().endsWith('/login'), `${label} redirect /login (url=${page.url()})`).toBe(true);
      }
      // ส่วน D เมนู
      if (role !== 'anon') {
        await page.goto(landing[role]);
        for (const n of allNav) {
          await expect(page.getByTestId(n), `D ${role} ${n}`).toHaveCount(nav[role].includes(n) ? 1 : 0);
        }
      }
      // ส่วน B API (แถว claim เป็นลำดับสุดท้าย)
      for (const row of apis) {
        const target = row.p === `/api/cases/${EG(25)}` && role === 'citizen' ? sy : t;
        const r = await api(target, row.m, row.p, row.body);
        expect(r.status, `B ${role} ${row.m} ${row.p}`).toBe(row.exp[role]);
      }
    });
  }
  await test.step('ส่วน C ขอบเขตแผนก', async () => {
    await reset();
    const works = await newStaff('off.works1');
    const reg1 = await newStaff('off.reg1');
    expect((await api(works, 'POST', `/api/officer/cases/${EG(28)}/claim`)).status, 'C off.works1 claim 000028').toBe(403);
    expect((await api(reg1, 'POST', `/api/officer/cases/${EG(10)}/claim`)).status, 'C off.reg1 claim 000010').toBe(403);
    const q = await api(works, 'GET', '/api/officer/queue?filter=all');
    expect((q.json.items as any[]).map((i) => i.caseNo), 'C คิว off.works1 (API)').toEqual([EG(10)]);
    const wp = await staffPage(browser, 'off.works1');
    await wp.goto('/officer/queue');
    expect(await queueOrder(wp), 'C คิว off.works1 (จอ)').toEqual([EG(10)]);
  });
});

test('TC-RBAC-04 ผู้ดูแลระบบ: บริการ วันหยุด ผู้ใช้ และยอดที่ล็อก', async ({ page, browser }) => {
  test.setTimeout(240_000);
  await reset();
  page.on('dialog', (d) => { void d.accept(); });
  await loginStaff(page, 'admin1');
  const rowsDates = async () => (await dataAttrs(page, 'holiday-row', ['data-date'])).map((r) => r['data-date']).sort();
  await test.step('1 วันหยุดเริ่มต้น', async () => {
    await page.goto('/admin/holidays');
    await expect(page.getByTestId('holiday-row'), 'ขั้น 1 holiday-row').toHaveCount(4);
    expect(await rowsDates(), 'ขั้น 1 วันที่').toEqual(['2026-12-07', '2026-12-10', '2026-12-31', '2027-01-01']);
  });
  await test.step('2 NEW_PAID ก่อนแก้', async () => {
    const n = await newPaid({ service: 'SV-01', qty: 1, at: T0 });
    expect(n.caseNo, 'ขั้น 2 caseNo').toBe(EG(31));
    expect((await getCase(n.t, n.caseNo)).dueAt, 'ขั้น 2 dueAt').toBe('2026-12-04T16:30:00+07:00');
  });
  await test.step('3 แก้ค่าธรรมเนียม', async () => {
    await page.goto('/admin/services');
    await page.getByTestId('svc-fee-SV-01').fill('25');
    await page.getByTestId('svc-save-SV-01').click();
    await expect(page.getByTestId('action-success'), 'ขั้น 3 SV-01 action-success').toBeVisible();
    await page.goto('/admin/services');
    await page.getByTestId('svc-fee-SV-02').fill('600');
    await page.getByTestId('svc-save-SV-02').click();
    await expect(page.getByTestId('action-success'), 'ขั้น 3 SV-02 action-success').toBeVisible();
  });
  const sm = await citizenPage(browser, ID.somchai);
  await test.step('4 ร่างใหม่ใช้ราคาใหม่', async () => {
    await sm.goto('/citizen/new/SV-01');
    await sm.getByTestId('qty-input').fill('5');
    await expect(sm.getByTestId('fee-total'), 'ขั้น 4 SV-01 qty 5').toHaveText('฿125');
    await sm.getByTestId('qty-input').fill('1');
    await expect(sm.getByTestId('fee-total'), 'ขั้น 4 SV-01 qty 1').toHaveText('฿25');
    await sm.goto('/citizen/new/SV-02');
    await expect(sm.getByTestId('fee-total'), 'ขั้น 4 SV-02').toHaveText('฿600');
    await sm.goto(`/citizen/cases/${EG(30)}`);
    await expect(sm.getByTestId('case-fee'), 'ขั้น 4 000030 case-fee').toHaveText('฿20');
  });
  await test.step('5 ยอดที่ล็อกของ PP-0001', async () => {
    await sm.goto('/citizen/new/SV-02?draft=DR-0002');
    await expect(sm.getByTestId('payment-amount'), 'ขั้น 5 payment-amount').toHaveText('฿500');
    const bad = await pay('PP-0001', 600);
    expect(bad.status, 'ขั้น 5 pay 600').toBe(422);
    expect(bad.json?.code, 'ขั้น 5 pay 600 code').toBe('AMOUNT_MISMATCH');
    const ok = await pay('PP-0001', 500);
    expect(ok.status, 'ขั้น 5 pay 500').toBe(200);
    expect(ok.json?.status, 'ขั้น 5 status').toBe('PAID');
    expect(ok.json?.caseNo, 'ขั้น 5 caseNo').toBe(EG(32));
  });
  await test.step('6 เพิ่มวันหยุด', async () => {
    await page.goto('/admin/holidays');
    await page.getByTestId('holiday-date-input').fill('2026-12-02');
    await page.getByTestId('holiday-name-input').fill('วันหยุดทดสอบ');
    await page.getByTestId('holiday-add-btn').click();
    await expect(page.getByTestId('holiday-row'), 'ขั้น 6 holiday-row').toHaveCount(5);
    const t = await newCitizen(ID.somchai);
    expect((await getCase(t, EG(31))).dueAt, 'ขั้น 6 dueAt ไม่คำนวณใหม่').toBe('2026-12-04T16:30:00+07:00');
  });
  await test.step('7 NEW_PAID หลังเพิ่มวันหยุด', async () => {
    const n = await newPaid({ service: 'SV-01', qty: 1, at: T0 });
    expect(n.caseNo, 'ขั้น 7 caseNo').toBe(EG(33));
    expect((await getCase(n.t, n.caseNo)).dueAt, 'ขั้น 7 dueAt').toBe('2026-12-08T16:30:00+07:00');
  });
  await test.step('8 เปลี่ยนบทบาท exec1 → auditor', async () => {
    const r = await api(page, 'PUT', '/api/admin/users/exec1', { role: 'auditor', dept: '' });
    expect(r.status, 'ขั้น 8 PUT users/exec1').toBe(200);
    const ex = await newApi();
    const l = await loginStaff(ex, 'exec1');
    expect(l.landing, 'ขั้น 8 landing').toBe('/audit');
    expect((await api(ex, 'GET', '/api/dashboard?period=2026-12&service=ALL')).status, 'ขั้น 8 /api/dashboard').toBe(403);
  });
  const ep = await newCtxPage(browser);
  await loginStaff(ep, 'exec1');
  const adminChange = async (n: number) => {
    await ep.goto('/audit');
    await ep.getByTestId('audit-filter-event').selectOption('ADMIN_CHANGE');
    await ep.getByTestId('audit-apply-btn').click();
    await ep.waitForURL(/\/audit\?/);
    await expect(ep.getByTestId('audit-count'), `ADMIN_CHANGE audit-count ${n}`).toHaveText(String(n));
  };
  await test.step('9 Audit ADMIN_CHANGE', async () => {
    await adminChange(4);
    for (const a of await texts(ep, 'audit-actor')) expect(a, 'ขั้น 9 audit-actor').toBe('admin1');
    for (const a of await texts(ep, 'audit-role')) expect(a, 'ขั้น 9 audit-role').toBe('admin');
    const d = (await texts(ep, 'audit-detail')).join('\n');
    for (const s of ['SV-01 fee 20 → 25', 'SV-02 fee 500 → 600', 'holiday add 2026-12-02', 'exec1 role executive → auditor']) {
      expect(d, `ขั้น 9 detail มี ${s}`).toContain(s);
    }
  });
  await test.step('10 admin สร้างคำขอไม่ได้', async () => {
    const r = await api(page, 'POST', '/api/drafts', { serviceId: 'SV-01', qty: 1 });
    expect(r.status, 'ขั้น 10 POST /api/drafts').toBe(403);
  });
  await test.step('11 ลบวันหยุด', async () => {
    await page.goto('/admin/holidays');
    await rowBy(page, 'holiday-row', 'data-date', '2026-12-02').getByTestId('holiday-delete-btn').click();
    await expect(page.getByTestId('holiday-row'), 'ขั้น 11 holiday-row').toHaveCount(4);
    await adminChange(5);
    expect((await texts(ep, 'audit-detail')).join('\n'), 'ขั้น 11 detail').toContain('holiday delete 2026-12-02');
  });
});

test('TC-RBAC-05 สิทธิ์เปิด/ดาวน์โหลดไฟล์แนบ', async ({ browser }) => {
  test.setTimeout(240_000);
  await reset();
  const c = {
    reg1: await newStaff('off.reg1'), works1: await newStaff('off.works1'), reg2: await newStaff('off.reg2'), head1: await newStaff('head1'),
    somying: await newCitizen(ID.somying), somchai: await newCitizen(ID.somchai), exec1: await newStaff('exec1'),
    audit1: await newStaff('audit1'), admin1: await newStaff('admin1'), anon: await newApi(),
  };
  const ids: Record<string, string[]> = {};
  const names: Record<string, string[]> = {};
  for (const n of [25, 10, 12, 11]) {
    const r = await api(c.head1, 'GET', `/api/cases/${EG(n)}/files`);
    expect(r.status, `head1 files ${EG(n)}`).toBe(200);
    ids[EG(n)] = (r.json.items as any[]).map((i) => i.fileId);
    names[EG(n)] = (r.json.items as any[]).map((i) => i.name).sort();
  }
  const THREE = ['deed.pdf', 'id-card.pdf', 'plan.pdf'];
  expect(names[EG(25)], 'รายการไฟล์ 000025').toEqual(['id-card.pdf']);
  for (const n of [10, 12, 11]) expect(names[EG(n)], `รายการไฟล์ ${EG(n)}`).toEqual(THREE);

  const allowed = async (label: string, t: any, n: number, count: number, names0: string[]) => {
    const r = await api(t, 'GET', `/api/cases/${EG(n)}/files`);
    expect(r.status, `${label} files status`).toBe(200);
    expect(r.json.items.length, `${label} files จำนวน`).toBe(count);
    expect((r.json.items as any[]).map((i) => i.name).sort(), `${label} ชื่อไฟล์`).toEqual(names0);
    for (const it of r.json.items as any[]) {
      const f = await api(t, 'GET', `/api/files/${it.fileId}`);
      expect(f.status, `${label} file ${it.name}`).toBe(200);
      expect(f.headers['content-type'], `${label} content-type ${it.name}`).toContain('application/pdf');
      expect(f.body.subarray(0, 4).toString('latin1'), `${label} เนื้อไฟล์ ${it.name}`).toBe('%PDF');
    }
  };
  const denied = async (label: string, t: any, n: number, status: number) => {
    const r = await api(t, 'GET', `/api/cases/${EG(n)}/files`);
    expect(r.status, `${label} files status`).toBe(status);
    const f = await api(t, 'GET', `/api/files/${ids[EG(n)][0]}`);
    expect(f.status, `${label} file status`).toBe(status);
  };
  await test.step('เจ้าหน้าที่', async () => {
    await allowed('off.reg1 000025', c.reg1, 25, 1, ['id-card.pdf']);
    await denied('off.works1 000025', c.works1, 25, 403);
    await allowed('off.reg2 000012', c.reg2, 12, 3, THREE);
    await denied('off.works1 000012', c.works1, 12, 403);
    await allowed('off.works1 000010', c.works1, 10, 3, THREE);
    await allowed('off.reg1 000010', c.reg1, 10, 3, THREE);
    await allowed('off.works1 000011', c.works1, 11, 3, THREE);
  });
  await test.step('head1', async () => {
    await allowed('head1 000025', c.head1, 25, 1, ['id-card.pdf']);
    await allowed('head1 000010', c.head1, 10, 3, THREE);
    await allowed('head1 000012', c.head1, 12, 3, THREE);
  });
  await test.step('ประชาชน', async () => {
    await allowed('สมหญิง 000025', c.somying, 25, 1, ['id-card.pdf']);
    await denied('สมชาย 000025', c.somchai, 25, 404);
  });
  await test.step('บทบาทอื่นและไม่ล็อกอิน', async () => {
    for (const k of ['exec1', 'audit1', 'admin1'] as const) await denied(`${k} 000025`, c[k], 25, 403);
    await denied('ไม่ล็อกอิน 000025', c.anon, 25, 401);
  });
  await test.step('fileId ที่ไม่มี', async () => {
    const r = await api(c.reg1, 'GET', '/api/files/F-999999');
    expect(r.status, 'fileId ไม่มี').toBe(404);
  });
  await test.step('UI', async () => {
    const o1 = await staffPage(browser, 'off.reg1');
    await o1.goto(`/officer/cases/${EG(25)}`);
    await expect(o1.getByTestId('doc-item'), 'UI off.reg1 doc-item').toHaveCount(1);
    await expect(o1.getByTestId('doc-item'), 'UI doc-item data-name').toHaveAttribute('data-name', 'id-card.pdf');
    const buf = await downloadOf(o1, 'doc-download-link');
    expect(buf.length, 'UI ดาวน์โหลดขนาด').toBeGreaterThan(0);
    const o2 = await staffPage(browser, 'off.reg2');
    await o2.goto(`/officer/cases/${EG(12)}`);
    await expect(o2.getByTestId('doc-item'), 'UI off.reg2 doc-item').toHaveCount(3);
    const sy = await citizenPage(browser, ID.somying);
    await sy.goto(`/citizen/cases/${EG(25)}`);
    await expect(sy.getByTestId('doc-item'), 'UI สมหญิง doc-item').toHaveCount(1);
  });
});

test('TC-RBAC-06 ผู้ดูแลระบบ: ช่วงค่าที่ยอมรับ', async ({ page }) => {
  test.setTimeout(240_000);
  await reset();
  await loginStaff(page, 'admin1');
  const svc = async () => {
    const r = await api(page, 'GET', '/api/admin/services');
    return (r.json.items as any[]).find((i) => i.id === 'SV-01');
  };
  const cur = await svc();
  let fee: number = cur.fee;
  let sla: number = cur.sla;
  expect([fee, sla], 'ค่าเริ่มต้น SV-01').toEqual([20, 3]);
  const FEE_MSG = 'ค่าธรรมเนียมต้องเป็นจำนวนเต็ม 0–100,000 บาท';
  const SLA_MSG = 'SLA ต้องเป็นจำนวนเต็ม 1–60 วันทำการ';
  const putApi = (f: number, s: number) => api(page, 'PUT', '/api/admin/services/SV-01', { fee: f, sla: s });
  const putUi = async (f: number, s: number) => {
    await page.goto('/admin/services');
    await page.getByTestId('svc-fee-SV-01').fill(String(f));
    await page.getByTestId('svc-sla-SV-01').fill(String(s));
    await page.getByTestId('svc-save-SV-01').click();
  };
  const rejectFee = async (v: number) => {
    const r = await putApi(v, sla);
    expect(r.status, `API fee=${v}`).toBe(400);
    expect(r.json?.code, `API fee=${v} code`).toBe('INVALID_FEE');
    await putUi(v, sla);
    await expect(page.getByTestId('action-error'), `UI fee=${v}`).toHaveText(FEE_MSG);
    expect((await svc()).fee, `fee=${v} ค่าไม่เปลี่ยน`).toBe(fee);
  };
  const rejectSla = async (v: number) => {
    const r = await putApi(fee, v);
    expect(r.status, `API sla=${v}`).toBe(400);
    expect(r.json?.code, `API sla=${v} code`).toBe('INVALID_SLA');
    await putUi(fee, v);
    await expect(page.getByTestId('action-error'), `UI sla=${v}`).toHaveText(SLA_MSG);
    expect((await svc()).sla, `sla=${v} ค่าไม่เปลี่ยน`).toBe(sla);
  };
  const acceptFee = async (v: number) => {
    const r = await putApi(v, sla);
    expect(r.status, `API fee=${v}`).toBe(200);
    fee = v;
    await putUi(v, sla); // ค่าเดิม → ไม่บันทึก Audit ซ้ำ
    await expect(page.getByTestId('action-success'), `UI fee=${v}`).toBeVisible();
    expect((await svc()).fee, `fee=${v} ค่าที่เก็บ`).toBe(v);
  };
  const acceptSla = async (v: number) => {
    const r = await putApi(fee, v);
    expect(r.status, `API sla=${v}`).toBe(200);
    sla = v;
    await putUi(fee, v);
    await expect(page.getByTestId('action-success'), `UI sla=${v}`).toBeVisible();
    expect((await svc()).sla, `sla=${v} ค่าที่เก็บ`).toBe(v);
  };
  await test.step('fee -1', async () => { await rejectFee(-1); });
  await test.step('fee 0', async () => { await acceptFee(0); });
  await test.step('fee 100000', async () => { await acceptFee(100000); });
  await test.step('fee 100001', async () => { await rejectFee(100001); });
  await test.step('sla 0', async () => { await rejectSla(0); });
  await test.step('sla 1', async () => { await acceptSla(1); });
  await test.step('sla 60', async () => { await acceptSla(60); });
  await test.step('sla 61', async () => { await rejectSla(61); });
  await test.step('วันหยุดซ้ำ / วันเสาร์', async () => {
    const dup = await api(page, 'POST', '/api/admin/holidays', { date: '2026-12-07', name: 'ซ้ำ' });
    expect(dup.status, 'วันหยุดซ้ำ API').toBe(409);
    expect(dup.json?.code, 'วันหยุดซ้ำ code').toBe('DUPLICATE_HOLIDAY');
    expect(dup.json?.message, 'วันหยุดซ้ำ message').toBe('มีวันหยุดนี้อยู่แล้ว');
    await page.goto('/admin/holidays');
    await page.getByTestId('holiday-date-input').fill('2026-12-07');
    await page.getByTestId('holiday-name-input').fill('ซ้ำ');
    await page.getByTestId('holiday-add-btn').click();
    await expect(page.getByTestId('action-error'), 'วันหยุดซ้ำ UI').toHaveText('มีวันหยุดนี้อยู่แล้ว');
    await page.goto('/admin/holidays');
    await expect(page.getByTestId('holiday-row'), 'holiday-row ยัง 4').toHaveCount(4);
    const sat = await api(page, 'POST', '/api/admin/holidays', { date: '2026-12-05', name: 'วันเสาร์' });
    expect(sat.status, 'วันเสาร์').toBe(201);
  });
  await test.step('แก้บทบาทตัวเองไม่ได้', async () => {
    const r = await api(page, 'PUT', '/api/admin/users/admin1', { role: 'executive', dept: '' });
    expect(r.status, 'SELF_ROLE_CHANGE').toBe(409);
    expect(r.json?.code, 'SELF_ROLE_CHANGE code').toBe('SELF_ROLE_CHANGE');
    expect(r.json?.message, 'SELF_ROLE_CHANGE message').toBe('ไม่สามารถเปลี่ยนบทบาทของตัวเองได้');
    const me = await api(page, 'GET', '/api/me');
    expect(me.json.role, '/api/me role').toBe('admin');
  });
  await test.step('Audit ADMIN_CHANGE = 5', async () => {
    const items = await auditItems('event=ADMIN_CHANGE');
    expect(items.length, 'ADMIN_CHANGE จำนวน').toBe(5);
  });
});

// ───────────────────────── NFR ─────────────────────────

test('TC-NFR-01 Responsive 375/768/1280', async ({ page, browser }) => {
  test.setTimeout(240_000);
  await reset();
  const rp = await rolePages(browser);
  const targets: Array<[RoleKey, string]> = [
    ['anon', '/login'], ['somchai', '/citizen'], ['somchai', '/citizen/new/SV-03'], ['somchai', `/citizen/cases/${EG(13)}`],
    ['reg1', '/officer/queue'], ['reg1', `/officer/cases/${EG(20)}`], ['head1', '/head/approvals'], ['exec1', '/dashboard'],
    ['audit1', '/audit'], ['admin1', '/admin/services'], ['anon', '/verify/K7M2Q9XA'],
  ];
  const sizes: Array<[number, number]> = [[375, 812], [768, 1024], [1280, 800]];
  for (const [w, h] of sizes) {
    await test.step(`viewport ${w}×${h}`, async () => {
      for (const p of Object.values(rp)) await p.setViewportSize({ width: w, height: h });
      for (const [role, url] of targets) {
        const p = rp[role];
        await p.goto(url);
        await expect.poll(
          () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          { message: `viewport ${w} หน้า ${url} (${role}) ต้องไม่มี scroll แนวนอน` },
        ).toBe(true);
      }
    });
  }
  await test.step('งานหลักที่ 375 px', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.getByTestId('thaid-id-input').fill(ID.somchai);
    await page.getByTestId('thaid-submit').click();
    await expect(page.getByTestId('otp-step'), 'otp-step').toBeVisible();
    await page.getByTestId('otp-input').fill('123456');
    await page.getByTestId('otp-submit').click();
    await page.waitForURL('**/citizen');
    await page.getByTestId('start-service-SV-01').click();
    await expect(page.getByTestId('qty-input'), 'qty-input').toHaveValue('1');
    await expect(page.getByTestId('fee-total'), 'fee-total').toHaveText('฿20');
    await page.getByTestId('to-upload-btn').click();
    await page.getByTestId('upload-input-id-card').setInputFiles(file('id-card.pdf'));
    await expect(page.getByTestId('file-item'), 'file-item').toHaveCount(1);
    await expect(page.getByTestId('to-payment-btn'), 'to-payment-btn').toBeEnabled();
    await page.getByTestId('to-payment-btn').click();
    const qr = page.getByTestId('create-qr-btn');
    await expect(qr, 'create-qr-btn').toBeVisible();
    const box = await qr.boundingBox();
    expect(box, 'create-qr-btn boundingBox').not.toBeNull();
    expect(box!.x, 'create-qr-btn x ≥ 0').toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, 'create-qr-btn x+width ≤ 375').toBeLessThanOrEqual(375);
  });
});

test('TC-NFR-02 WCAG: axe + คีย์บอร์ด + label + สถานะไม่ใช้สีอย่างเดียว', async ({ page, browser }) => {
  test.setTimeout(240_000);
  await reset();
  const rp = await rolePages(browser);
  const mana = await newCtxPage(browser);
  await loginCitizen(mana, ID.mana);
  const targets: Array<[Page, string]> = [
    [rp.anon, '/login'], [mana, '/register'], [rp.somchai, '/citizen'], [rp.somchai, '/citizen/new/SV-01'],
    [rp.somchai, `/citizen/cases/${EG(17)}`], [rp.reg1, '/officer/queue'], [rp.reg1, `/officer/cases/${EG(20)}`],
    [rp.head1, '/head/approvals'], [rp.exec1, '/dashboard'], [rp.audit1, '/audit'], [rp.admin1, '/admin/services'],
    [rp.reg1, '/notifications'], [rp.anon, '/verify/K7M2Q9XA'],
  ];
  await test.step('ส่วน A axe', async () => {
    const bad: string[] = [];
    for (const [p, url] of targets) {
      await p.goto(url);
      const res = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of res.violations) {
        if (['serious', 'critical'].includes(v.impact ?? '')) bad.push(`${url}: ${v.id} (${v.impact})`);
        else test.info().annotations.push({ type: 'axe-' + (v.impact ?? 'minor'), description: `${url}: ${v.id}` });
      }
    }
    expect(bad, 'axe serious/critical ต้องว่าง').toEqual([]);
  });
  await test.step('ส่วน B คีย์บอร์ดอย่างเดียว', async () => {
    const ring = async (id: string) => {
      const ok = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement;
        const cs = getComputedStyle(e);
        return cs.outlineStyle !== 'none' || cs.boxShadow !== 'none';
      });
      expect(ok, `focus ring ที่ ${id}`).toBe(true);
    };
    const tab = async (id: string) => { await tabUntil(page, id); await ring(id); };
    await page.goto('/login');
    await tab('thaid-id-input');
    await page.keyboard.type(ID.somchai);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('otp-input'), 'otp-input').toBeVisible();
    await page.keyboard.type('123456');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/citizen');
    await tab('start-service-SV-01');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/citizen/new/SV-01');
    await tab('qty-input');
    await page.keyboard.press('ControlOrMeta+A'); // Mac = Cmd+A (เลือกทั้งหมด)
    await page.keyboard.type('1');
    await tab('to-upload-btn');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('wizard-step'), 'wizard-step 2').toHaveText('2/3 แนบเอกสาร');
    await tabUntil(page, 'upload-input-id-card');
    await page.getByTestId('upload-input-id-card').setInputFiles(file('id-card.pdf'));
    await expect(page.getByTestId('file-item'), 'file-item').toHaveCount(1);
    await tab('to-payment-btn');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('create-qr-btn'), 'create-qr-btn').toBeVisible();
  });
  await test.step('ส่วน C label', async () => {
    const bad: string[] = [];
    for (const [p, url] of targets) {
      await p.goto(url);
      const miss = await p.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll('input, select, textarea').forEach((el) => {
          const e = el as HTMLInputElement;
          if (e.type === 'hidden') return;
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          if ((r.width === 0 && r.height === 0) || cs.visibility === 'hidden' || cs.display === 'none') return;
          const named = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.labels && e.labels.length > 0) || e.closest('label');
          if (!named) out.push(e.getAttribute('data-testid') || e.tagName.toLowerCase());
        });
        return out;
      });
      for (const m of miss) bad.push(`${url}: ${m}`);
    }
    expect(bad, 'ช่องที่ไม่มีชื่อที่เข้าถึงได้').toEqual([]);
  });
  await test.step('ส่วน D สถานะไม่ใช้สีอย่างเดียว', async () => {
    const pagesD: Array<[Page, string]> = [
      [rp.reg1, '/officer/queue'], [rp.reg1, `/officer/cases/${EG(20)}`], [rp.somchai, `/citizen/cases/${EG(17)}`], [rp.somchai, '/citizen'],
    ];
    const run = async (label: string) => {
      let seen = 0;
      for (const [p, url] of pagesD) {
        await p.goto(url);
        const items = await p.locator('[data-testid="case-status"], [data-testid="row-status"], [data-testid="sla-level"], [data-testid="row-sla-level"]').evaluateAll((els) =>
          els.map((e) => {
            const id = e.getAttribute('data-testid') ?? '';
            const isStatus = id.endsWith('status');
            const code = isStatus
              ? (e.getAttribute('data-status') ?? e.closest('[data-status]')?.getAttribute('data-status') ?? '')
              : (e.getAttribute('data-level') ?? e.closest('[data-sla-level]')?.getAttribute('data-sla-level') ?? '');
            return { isStatus, code, text: (e.textContent ?? '').trim() };
          }));
        for (const it of items) {
          seen++;
          const want = it.isStatus ? STATUS_TH[it.code] : LEVEL_TH[it.code];
          expect(it.text, `${label} ${url} ${it.isStatus ? 'status' : 'level'} ${it.code}`).not.toBe('');
          expect(it.text, `${label} ${url} ข้อความของ ${it.code}`).toBe(want);
        }
      }
      expect(seen, `${label} จำนวนองค์ประกอบสถานะที่ตรวจ`).toBeGreaterThan(0);
    };
    await run('ปกติ');
    for (const [p] of pagesD) await p.emulateMedia({ forcedColors: 'active' });
    await run('forcedColors');
  });
  void page;
});

test('TC-NFR-03 Health เวลาโหลด และผลซ้ำได้', async ({ browser }) => {
  test.setTimeout(240_000);
  await test.step('health', async () => {
    const a = await newApi();
    const r = await api(a, 'GET', '/api/health');
    expect(r.status, 'health status').toBe(200);
    expect(r.json, 'health body').toEqual({ status: 'ok' });
  });
  await test.step('เวลาโหลด ≤ 3,000 ms (รอบที่ 2)', async () => {
    await reset();
    const rp = await rolePages(browser);
    const targets: Array<[RoleKey, string]> = [['anon', '/login'], ['somchai', '/citizen'], ['reg1', '/officer/queue'], ['exec1', '/dashboard'], ['audit1', '/audit']];
    for (const [role, url] of targets) await rp[role].goto(url, { waitUntil: 'load' });
    for (const [role, url] of targets) {
      const t0 = Date.now();
      await rp[role].goto(url, { waitUntil: 'load' });
      const ms = Date.now() - t0;
      expect(ms, `เวลาโหลด ${url}`).toBeLessThanOrEqual(3000);
    }
  });
  await test.step('ผลซ้ำได้', async () => {
    const snap = async () => {
      const clock = await getClock();
      const reg1 = await newStaff('off.reg1');
      const q = await api(reg1, 'GET', '/api/officer/queue?filter=all');
      const rows = (q.json.items as any[]).map((i) => ({ caseNo: i.caseNo, dueAt: i.dueAt, status: i.status, owner: i.owner }));
      const ex = await newStaff('exec1');
      const d = await api(ex, 'GET', '/api/dashboard?period=2026-12&service=ALL');
      return { clock, rows, dash: d.json };
    };
    await reset();
    const s1 = await snap();
    await setClock('2026-12-10T12:00:00+07:00');
    const reg1 = await newStaff('off.reg1');
    await api(reg1, 'POST', `/api/officer/cases/${EG(28)}/claim`);
    await newPaid({ service: 'SV-01' });
    await reset();
    const s2 = await snap();
    expect(s2.clock, 'S2 clock').toBe(T0);
    expect(s2, 'S1 เท่ากับ S2').toEqual(s1);
  });
  await test.step('นาฬิกาไม่มี offset', async () => {
    const a = await newApi();
    const r = await api(a, 'PUT', '/api/test/clock', { now: '2026-12-01 09:00' });
    expect(r.status, 'PUT clock ไม่มี offset').toBe(400);
    expect(r.json?.code, 'code').toBe('INVALID_TIME');
  });
  await test.step('ปิด hook', async () => {
    const other = process.env.BASE_URL_NO_TEST;
    if (!other) {
      test.info().annotations.push({ type: 'skip-part', description: 'ไม่มี BASE_URL_NO_TEST จึงข้ามส่วนปิด hook' });
      return;
    }
    const { request } = await import('@playwright/test');
    const c = await request.newContext({ baseURL: other });
    try {
      const r = await c.post('/api/test/reset', { failOnStatusCode: false });
      expect(r.status(), 'POST /api/test/reset เมื่อไม่ตั้ง TEST_MODE').toBe(404);
    } finally { await c.dispose(); }
  });
  await reset();
});

test('TC-NFR-04 เข้ารหัสข้อมูลส่วนบุคคลที่เก็บ (inspection)', async () => {
  await reset();
  const m = await newApi();
  const l = await loginCitizen(m, ID.mana);
  expect(l.registered, 'มานะยังไม่ลงทะเบียน').toBe(false);
  const reg = await api(m, 'POST', '/api/auth/register', { mobile: '0845678901', email: '', consent: true });
  expect(reg.status, 'ลงทะเบียน').toBe(201);

  const parts: Buffer[] = [fs.readFileSync(DB_PATH)];
  for (const ext of ['-wal']) if (fs.existsSync(DB_PATH + ext)) parts.push(fs.readFileSync(DB_PATH + ext));
  const buf = Buffer.concat(parts);
  const values = [
    '1101700123456', '3100600987659', '1909900555015', '5500400111221', '0812345678', '0823456789', '0834567890', '0845678901',
    '1-1017-00123-45-6', '3-1006-00987-65-9', '1-9099-00555-01-5', '5-5004-00111-22-1',
  ];
  for (const v of values) expect(buf.indexOf(Buffer.from(v)), `พบ ${v} ในไฟล์ฐานข้อมูล (ต้องไม่พบ)`).toBe(-1);

  const sc = await newCitizen(ID.somchai);
  const c = await api(sc, 'GET', `/api/cases/${EG(5)}`);
  expect(c.status, 'ตัวควบคุมบวก status').toBe(200);
  expect(c.json.idNo, 'ตัวควบคุมบวก idNo').toBe('1101700123456');
  test.info().annotations.push({ type: 'encryption', description: 'AES-256-GCM' });
});
