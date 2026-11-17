import * as fs from 'fs';
import { APIRequestContext, Browser, BrowserContext, Page, expect, test } from '@playwright/test';
import { BASE_URL, ID, api, loginCitizen, loginStaff, newApi } from './helpers';

// helper เพิ่มของชุด B (ไม่แตะ helpers.ts ของ T1)

export const EG = (n: number | string): string => `EG-2569-${String(n).padStart(6, '0')}`;

const extraContexts: BrowserContext[] = [];
export async function closeExtraContexts(): Promise<void> {
  for (const c of extraContexts.splice(0)) await c.close().catch(() => undefined);
}

export async function newCtxPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: BASE_URL, locale: 'th-TH', timezoneId: 'Asia/Bangkok', viewport: { width: 1280, height: 800 }, acceptDownloads: true,
    recordVideo: { dir: test.info().outputDir, size: { width: 1280, height: 800 } } }); // อัดวิดีโอไว้ทำ GIF (ไม่กระทบผลตรวจ)
  extraContexts.push(ctx);
  return ctx.newPage();
}
export async function staffPage(browser: Browser, username: string): Promise<Page> {
  const p = await newCtxPage(browser);
  await loginStaff(p, username);
  return p;
}
export async function citizenPage(browser: Browser, idNo: string): Promise<Page> {
  const p = await newCtxPage(browser);
  await loginCitizen(p, idNo);
  return p;
}
export async function anonPage(browser: Browser): Promise<Page> {
  return newCtxPage(browser);
}

export async function newStaff(username: string): Promise<APIRequestContext> {
  const t = await newApi();
  await loginStaff(t, username);
  return t;
}
export async function newCitizen(idNo: string): Promise<APIRequestContext> {
  const t = await newApi();
  await loginCitizen(t, idNo);
  return t;
}

/** ดึงแถว Audit (ล็อกอิน audit1 ใหม่ → เพิ่ม STAFF_LOGIN 1 แถว) */
export async function auditItems(query = ''): Promise<any[]> {
  const a = await newStaff('audit1');
  const r = await api(a, 'GET', `/api/audit${query ? '?' + query : ''}`);
  expect(r.status, `audit1 GET /api/audit?${query}`).toBe(200);
  return r.json.items as any[];
}

export async function downloadOf(page: Page, testid: string): Promise<Buffer> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testid).click()]);
  return fs.readFileSync(await dl.path());
}

/** ตีกลับ/ไม่อนุมัติผ่านจอ (เปิดกล่องเหตุผลถ้ายังไม่เปิด) */
export async function reasonAction(page: Page, kind: 'return' | 'reject', reason: string): Promise<void> {
  const input = page.getByTestId(`${kind}-reason`);
  if (!(await input.isVisible())) await page.getByTestId(`${kind}-btn`).click();
  await input.fill(reason);
  await page.getByTestId(`${kind}-submit`).click();
}

export async function dataAttrs(page: Page, testid: string, attrs: string[]): Promise<Array<Record<string, string>>> {
  return page.getByTestId(testid).evaluateAll((els, as) =>
    els.map((e) => Object.fromEntries((as as string[]).map((a) => [a, e.getAttribute(a) ?? '']))), attrs);
}

export async function texts(page: Page, testid: string): Promise<string[]> {
  return page.getByTestId(testid).evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
}

export type RoleKey = 'anon' | 'somchai' | 'reg1' | 'head1' | 'exec1' | 'audit1' | 'admin1';
/** เปิด context แยกต่อบทบาท (ใช้หลัง reset เท่านั้น) */
export async function rolePages(browser: Browser): Promise<Record<RoleKey, Page>> {
  return {
    anon: await anonPage(browser),
    somchai: await citizenPage(browser, ID.somchai),
    reg1: await staffPage(browser, 'off.reg1'),
    head1: await staffPage(browser, 'head1'),
    exec1: await staffPage(browser, 'exec1'),
    audit1: await staffPage(browser, 'audit1'),
    admin1: await staffPage(browser, 'admin1'),
  };
}

export const STATUS_TH: Record<string, string> = {
  DRAFT: 'ร่าง', PENDING_PAYMENT: 'รอชำระเงิน', SUBMITTED: 'ส่งคำขอแล้ว', IN_REVIEW: 'กำลังตรวจสอบ', NEED_FIX: 'รอแก้ไขเอกสาร',
  PENDING_APPROVAL: 'รออนุมัติ', APPROVED: 'อนุมัติ', COMPLETED: 'เสร็จสิ้น', REJECTED: 'ไม่อนุมัติ', CANCELLED: 'ยกเลิก',
};
export const LEVEL_TH: Record<string, string> = {
  normal: 'ปกติ', near: 'ใกล้ครบกำหนด', overdue: 'เกินกำหนด', paused: 'หยุดนับ', closed: 'ปิดแล้ว',
};
