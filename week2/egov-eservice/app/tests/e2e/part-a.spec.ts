import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  BASE_URL, ID, file, newApi, disposeApis, api, reset, setClock, loginCitizen, loginStaff, logout,
  createDraft, upload, createQr, pay, newPaid, getCase, rowBy, Target,
} from './helpers';

// ───────────────────────── ตัวช่วยเฉพาะชุด A ─────────────────────────
const extraContexts: BrowserContext[] = [];
test.afterEach(async () => {
  await disposeApis();
  for (const c of extraContexts.splice(0)) await c.close().catch(() => undefined);
});

async function newCtxPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: BASE_URL, locale: 'th-TH', timezoneId: 'Asia/Bangkok', viewport: { width: 1280, height: 800 },
    recordVideo: { dir: test.info().outputDir, size: { width: 1280, height: 800 } } }); // อัดวิดีโอไว้ทำ GIF (ไม่กระทบผลตรวจ)
  extraContexts.push(ctx);
  return ctx.newPage();
}

async function uiLoginCitizen(page: Page, idNo: string, url: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('thaid-id-input').fill(idNo);
  await page.getByTestId('thaid-submit').click();
  await expect(page.getByTestId('otp-step'), `uiLoginCitizen ${idNo} otp-step`).toBeVisible();
  await page.getByTestId('otp-input').fill('123456');
  await page.getByTestId('otp-submit').click();
  await page.waitForURL(url);
}

async function newStaffApi(username: string): Promise<Target> {
  const t = await newApi();
  await loginStaff(t, username);
  return t;
}
async function newCitizenApi(idNo: string): Promise<Target> {
  const t = await newApi();
  await loginCitizen(t, idNo);
  return t;
}

async function claim(t: Target, caseNo: string) {
  return api(t, 'POST', `/api/officer/cases/${caseNo}/claim`);
}

async function auditItems(event: string): Promise<any[]> {
  const a = await newStaffApi('audit1');
  const r = await api(a, 'GET', `/api/audit?event=${event}`);
  expect(r.status, `audit1 GET /api/audit?event=${event}`).toBe(200);
  return r.json.items as any[];
}

async function queueOrder(page: Page): Promise<string[]> {
  return page.getByTestId('queue-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-case-no') ?? ''));
}
const EG = (n: number | string) => `EG-2569-${String(n).padStart(6, '0')}`;
const egList = (ns: number[]) => ns.map(EG);

/** อัปโหลดผ่านจอ แล้วรอจน file-item ครบจำนวน */
async function uiUpload(page: Page, inputTestId: string, f: string | { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  await page.getByTestId(inputTestId).setInputFiles(typeof f === 'string' ? file(f) : f);
}

async function notiUi(page: Page): Promise<{ pairs: string[]; bell: string | null; texts: string[] }> {
  await page.goto('/notifications');
  await expect(page.getByTestId('bell-count')).toBeVisible();
  const items = page.getByTestId('noti-item');
  // รอให้ DOM นิ่ง: noti-item หรือ noti-empty ต้องมีอย่างใดอย่างหนึ่ง
  await expect.poll(async () => (await items.count()) + (await page.getByTestId('noti-empty').count())).toBeGreaterThan(0);
  const pairs = await items.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-case-no')}:${e.getAttribute('data-level')}`));
  const texts = await items.evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
  const bell = (await page.getByTestId('bell-count').textContent())?.trim() ?? null;
  return { pairs: pairs.sort(), bell, texts };
}
async function notiApi(t: Target): Promise<string[]> {
  const r = await api(t, 'GET', '/api/notifications');
  expect(r.status, 'GET /api/notifications').toBe(200);
  return (r.json.items as any[]).map((i) => `${i.caseNo}:${i.level}`).sort();
}
const pairs = (items: Array<[number, string]>) => items.map(([n, l]) => `${EG(n)}:${l}`).sort();

// ───────────────────────── AUTH ─────────────────────────
test('TC-AUTH-01 เลขบัตร 13 หลัก + checksum', async ({ page }) => {
  await reset();
  const rows: Array<{ v: string; ok: boolean; why: string }> = [
    { v: '110170012345', ok: false, why: '12 หลัก' },
    { v: '11017001234567', ok: false, why: '14 หลัก' },
    { v: '1101700123457', ok: false, why: 'checksum ผิด' },
    { v: '11017001234ab', ok: false, why: 'ไม่ใช่ตัวเลขล้วน' },
    { v: '1101700123456', ok: true, why: 'ถูก' },
    { v: '3100600987659', ok: true, why: 'ถูก' },
    { v: '1909900555015', ok: true, why: 'ถูก' },
    { v: '5500400111221', ok: true, why: 'ถูก' },
  ];
  const anon = await newApi();
  for (const r of rows) {
    await test.step(`ค่า ${r.v} (${r.why})`, async () => {
      const lbl = `TC-AUTH-01 ${r.v}`;
      await page.goto('/login');
      await expect(page.getByTestId('otp-step'), `${lbl} otp-step ก่อนกรอก`).toHaveCount(0);
      await page.getByTestId('thaid-id-input').fill(r.v);
      await page.getByTestId('thaid-submit').click();
      if (r.ok) {
        await expect(page.getByTestId('otp-step'), `${lbl} otp-step`).toBeVisible();
        await expect(page.getByTestId('thaid-error'), `${lbl} thaid-error`).toHaveCount(0);
      } else {
        await expect(page.getByTestId('thaid-error'), `${lbl} thaid-error`).toHaveText('เลขบัตรประชาชนไม่ถูกต้อง');
        await expect(page.getByTestId('otp-step'), `${lbl} otp-step`).toHaveCount(0);
      }
      const res = await api(anon, 'POST', '/api/auth/thaid/start', { idNo: r.v });
      if (r.ok) {
        expect(res.status, `${lbl} API status`).toBe(200);
        expect(res.json, `${lbl} API body`).toEqual({ status: 'OTP_SENT' });
      } else {
        expect(res.status, `${lbl} API status`).toBe(400);
        expect(res.json?.code, `${lbl} API code`).toBe('INVALID_ID');
      }
    });
  }
});

test('TC-AUTH-02 OTP ผิด 3 ครั้งล็อก 15 นาที', async ({ page }) => {
  await reset();
  const verifyUrl = (r: { url(): string }) => r.url().includes('/api/auth/thaid/verify');
  await page.goto('/login');
  await page.getByTestId('thaid-id-input').fill(ID.piti);
  await page.getByTestId('thaid-submit').click();
  await expect(page.getByTestId('otp-step')).toBeVisible();

  const wrongOtp = async () => {
    await page.getByTestId('otp-input').fill('000000');
    const [resp] = await Promise.all([page.waitForResponse(verifyUrl), page.getByTestId('otp-submit').click()]);
    return resp;
  };
  await test.step('1 OTP ผิดครั้งที่ 1', async () => {
    const resp = await wrongOtp();
    expect(resp.status(), 'ขั้น 1 status').toBe(401);
    expect((await resp.json()).code, 'ขั้น 1 code').toBe('OTP_INVALID');
    await expect(page.getByTestId('otp-error'), 'ขั้น 1 otp-error').toHaveText('รหัส OTP ไม่ถูกต้อง');
    await expect(page.getByTestId('otp-attempts-left'), 'ขั้น 1').toHaveText('เหลือ 2 ครั้ง');
  });
  await test.step('2 OTP ผิดครั้งที่ 2', async () => {
    const resp = await wrongOtp();
    expect(resp.status(), 'ขั้น 2 status').toBe(401);
    await expect(page.getByTestId('otp-attempts-left'), 'ขั้น 2').toHaveText('เหลือ 1 ครั้ง');
  });
  await test.step('3 OTP ผิดครั้งที่ 3 → ล็อก', async () => {
    const resp = await wrongOtp();
    expect(resp.status(), 'ขั้น 3 status').toBe(423);
    expect((await resp.json()).code, 'ขั้น 3 code').toBe('LOCKED');
    await expect(page.getByTestId('lock-message'), 'ขั้น 3 lock-message').toHaveText('ผิดเกินกำหนด เลขบัตรนี้ถูกล็อก 15 นาที');
    await expect(page.getByTestId('lock-until'), 'ขั้น 3 lock-until').toHaveAttribute('data-iso', '2026-12-01T09:15:00+07:00');
  });

  const ctx = await newApi();
  const tryVerify = async (otp: string) => {
    await api(ctx, 'POST', '/api/auth/thaid/start', { idNo: ID.piti }); // อาจตอบ 423 ระหว่างล็อก (ไม่ assert)
    return api(ctx, 'POST', '/api/auth/thaid/verify', { idNo: ID.piti, otp });
  };
  await test.step('4 OTP ถูกขณะล็อก → 423', async () => {
    const r = await tryVerify('123456');
    expect(r.status, 'ขั้น 4 status').toBe(423);
    expect(r.json?.code, 'ขั้น 4 code').toBe('LOCKED');
  });
  await test.step('5 สมชายล็อกอินปกติ', async () => {
    const s = await newApi();
    const r = await loginCitizen(s, ID.somchai);
    expect(r.registered, 'ขั้น 5 registered').toBe(true);
  });
  await test.step('6 09:14:59 ยังล็อก', async () => {
    await setClock('2026-12-01T09:14:59+07:00');
    const r = await tryVerify('123456');
    expect(r.status, 'ขั้น 6 status').toBe(423);
  });
  await test.step('7 09:15:00 ปลดล็อก ตัวนับเริ่มใหม่', async () => {
    await setClock('2026-12-01T09:15:00+07:00');
    const s = await api(ctx, 'POST', '/api/auth/thaid/start', { idNo: ID.piti });
    expect(s.status, 'ขั้น 7 start status').toBe(200);
    const r = await api(ctx, 'POST', '/api/auth/thaid/verify', { idNo: ID.piti, otp: '000000' });
    expect(r.status, 'ขั้น 7 status').toBe(401);
    expect(r.json?.code, 'ขั้น 7 code').toBe('OTP_INVALID');
    expect(r.json?.attemptsLeft, 'ขั้น 7 attemptsLeft').toBe(2);
  });
  await test.step('8 OTP ถูก → ล็อกอินสำเร็จ', async () => {
    const r = await api(ctx, 'POST', '/api/auth/thaid/verify', { idNo: ID.piti, otp: '123456' });
    expect(r.status, 'ขั้น 8 status').toBe(200);
  });
  await test.step('9 RESET: ผิด 2 → ถูก → ออก → ผิด 2 ไม่ล็อก', async () => {
    await reset();
    const c = await newApi();
    const v = (otp: string) => api(c, 'POST', '/api/auth/thaid/verify', { idNo: ID.piti, otp });
    expect((await api(c, 'POST', '/api/auth/thaid/start', { idNo: ID.piti })).status, 'ขั้น 9 start 1').toBe(200);
    let r = await v('000000');
    expect([r.status, r.json?.attemptsLeft], 'ขั้น 9 ผิดครั้งที่ 1').toEqual([401, 2]);
    r = await v('000000');
    expect([r.status, r.json?.attemptsLeft], 'ขั้น 9 ผิดครั้งที่ 2').toEqual([401, 1]);
    r = await v('123456');
    expect(r.status, 'ขั้น 9 OTP ถูก').toBe(200);
    await logout(c);
    expect((await api(c, 'POST', '/api/auth/thaid/start', { idNo: ID.piti })).status, 'ขั้น 9 start 2').toBe(200);
    r = await v('000000');
    expect([r.status, r.json?.attemptsLeft], 'ขั้น 9 รอบใหม่ ผิดครั้งที่ 1').toEqual([401, 2]);
    r = await v('000000');
    expect([r.status, r.json?.attemptsLeft], 'ขั้น 9 รอบใหม่ ผิดครั้งที่ 2 (ต้องไม่ล็อก)').toEqual([401, 1]);
  });
});

test('TC-AUTH-03 ลงทะเบียนครั้งแรก', async ({ page }) => {
  await reset();
  const mobile = page.getByTestId('reg-mobile');
  const consent = page.getByTestId('reg-consent');
  await uiLoginCitizen(page, ID.mana, '**/register');

  await test.step('1 reg-name อ่านอย่างเดียว', async () => {
    const name = page.getByTestId('reg-name');
    await expect(name, 'ขั้น 1 ค่า').toHaveValue('มานะ ตั้งใจ');
    await expect(name, 'ขั้น 1 readOnly').toHaveJSProperty('readOnly', true);
    await name.focus();
    await page.keyboard.type('zzz');
    await expect(name, 'ขั้น 1 พิมพ์แล้วค่าไม่เปลี่ยน').toHaveValue('มานะ ตั้งใจ');
  });
  const badMobile = async (v: string, label: string) => {
    await mobile.fill(v);
    await consent.setChecked(true);
    await page.getByTestId('reg-submit').click();
    await expect(page.getByTestId('reg-error-mobile'), label).toHaveText('เบอร์มือถือต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0');
    await expect(page, `${label} URL`).toHaveURL(/\/register/);
  };
  await test.step('2 เบอร์ 9 หลัก', async () => { await badMobile('081234567', 'ขั้น 2 เบอร์ 081234567'); });
  await test.step('3 เบอร์ 11 หลัก', async () => { await badMobile('08123456789', 'ขั้น 3 เบอร์ 08123456789'); });
  await test.step('4 เบอร์ไม่ขึ้นต้น 0 / มีตัวอักษร', async () => {
    await badMobile('1812345678', 'ขั้น 4 เบอร์ 1812345678');
    await badMobile('08123abcde', 'ขั้น 4 เบอร์ 08123abcde');
  });
  await test.step('5 ไม่ติ๊กยินยอม', async () => {
    await mobile.fill('0845678901');
    await consent.setChecked(false);
    await page.getByTestId('reg-submit').click();
    await expect(page.getByTestId('reg-error-consent'), 'ขั้น 5').toHaveText('กรุณายินยอมการประมวลผลข้อมูลส่วนบุคคล (PDPA)');
    await expect(page, 'ขั้น 5 URL').toHaveURL(/\/register/);
  });
  await test.step('6 ลงทะเบียนสำเร็จ', async () => {
    await mobile.fill('0845678901');
    await consent.setChecked(true);
    await page.getByTestId('reg-email').fill('');
    await page.getByTestId('reg-submit').click();
    await page.waitForURL('**/citizen');
    await expect(page.getByTestId('citizen-welcome'), 'ขั้น 6').toHaveText('สวัสดี มานะ ตั้งใจ');
  });
  await test.step('7 ออกแล้วเข้าใหม่ ไม่ผ่าน /register', async () => {
    await page.getByTestId('logout-btn').click();
    await page.waitForURL('**/login');
    await uiLoginCitizen(page, ID.mana, '**/citizen');
    await expect(page.getByTestId('citizen-welcome'), 'ขั้น 7').toHaveText('สวัสดี มานะ ตั้งใจ');
  });
  await test.step('8 RESET แล้วเรียก API ตรง', async () => {
    await reset();
    const c = await newApi();
    const r = await loginCitizen(c, ID.mana);
    expect(r.registered, 'ขั้น 8 registered').toBe(false);
    const a = await api(c, 'POST', '/api/auth/register', { mobile: '081234567', email: '', consent: true });
    expect([a.status, a.json?.code], 'ขั้น 8 เบอร์ 9 หลัก').toEqual([400, 'INVALID_MOBILE']);
    const b = await api(c, 'POST', '/api/auth/register', { mobile: '0845678901', email: '', consent: false });
    expect([b.status, b.json?.code], 'ขั้น 8 consent false').toEqual([400, 'CONSENT_REQUIRED']);
  });
});

test('TC-AUTH-04 เจ้าหน้าที่ SSO จำลองและหน้าตั้งต้นตามบทบาท', async ({ page }) => {
  await reset();
  const accts = [
    { u: 'off.reg1', url: '/officer/queue', name: 'เจ้าหน้าที่ทะเบียน 1', role: 'เจ้าหน้าที่', dr: 'officer', dept: 'registry' },
    { u: 'off.reg2', url: '/officer/queue', name: 'เจ้าหน้าที่ทะเบียน 2', role: 'เจ้าหน้าที่', dr: 'officer', dept: 'registry' },
    { u: 'off.works1', url: '/officer/queue', name: 'เจ้าหน้าที่โยธา 1', role: 'เจ้าหน้าที่', dr: 'officer', dept: 'works' },
    { u: 'head1', url: '/head/approvals', name: 'หัวหน้าฝ่าย', role: 'หัวหน้าฝ่าย', dr: 'head', dept: null },
    { u: 'exec1', url: '/dashboard', name: 'ผู้บริหาร', role: 'ผู้บริหาร', dr: 'executive', dept: null },
    { u: 'audit1', url: '/audit', name: 'ผู้ตรวจสอบภายใน', role: 'ผู้ตรวจสอบภายใน', dr: 'auditor', dept: null },
    { u: 'admin1', url: '/admin/services', name: 'ผู้ดูแลระบบ', role: 'ผู้ดูแลระบบ', dr: 'admin', dept: null },
  ];
  const loginForm = async (u: string, p: string) => {
    await page.goto('/login');
    await page.getByTestId('login-tab-staff').click();
    await page.getByTestId('staff-username').fill(u);
    await page.getByTestId('staff-password').fill(p);
  };
  for (const a of accts) {
    await test.step(`ล็อกอิน ${a.u}`, async () => {
      const lbl = `TC-AUTH-04 ${a.u}`;
      await loginForm(a.u, 'Test@1234');
      await expect(page.getByTestId('staff-submit'), `${lbl} ปุ่ม`).toHaveText('เข้าสู่ระบบเจ้าหน้าที่ (SSO ภาครัฐ จำลอง)');
      await page.getByTestId('staff-submit').click();
      await page.waitForURL('**' + a.url);
      expect(new URL(page.url()).pathname, `${lbl} URL`).toBe(a.url);
      await expect(page.getByTestId('user-name'), `${lbl} user-name`).toHaveText(a.name);
      await expect(page.getByTestId('user-role'), `${lbl} user-role`).toHaveText(a.role);
      await expect(page.getByTestId('user-role'), `${lbl} data-role`).toHaveAttribute('data-role', a.dr);
      if (a.dept) await expect(page.getByTestId('user-role'), `${lbl} data-dept`).toHaveAttribute('data-dept', a.dept);
      await page.getByTestId('logout-btn').click();
      await page.waitForURL('**/login');
    });
  }
  const bad = [
    { u: 'off.reg1', p: 'wrong', why: 'รหัสผ่านผิด' },
    { u: 'nobody', p: 'Test@1234', why: 'username ไม่มี' },
    { u: '1101700123456', p: 'Test@1234', why: 'เลขบัตรในช่อง username' },
  ];
  const anon = await newApi();
  for (const b of bad) {
    await test.step(`ผิด: ${b.why}`, async () => {
      await loginForm(b.u, b.p);
      await page.getByTestId('staff-submit').click();
      await expect(page.getByTestId('staff-error'), `TC-AUTH-04 ${b.why}`).toHaveText('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      const r = await api(anon, 'POST', '/api/auth/staff/login', { username: b.u, password: b.p });
      expect([r.status, r.json?.code], `TC-AUTH-04 API ${b.why}`).toEqual([401, 'INVALID_CREDENTIALS']);
    });
  }
  await test.step('หลัง logout เปิด /officer/queue → /login', async () => {
    await page.goto('/officer/queue');
    await page.waitForURL('**/login');
    expect(new URL(page.url()).pathname, 'TC-AUTH-04 redirect').toBe('/login');
  });
});

// ───────────────────────── FEE ─────────────────────────
test('TC-FEE-01 ค่าธรรมเนียม SV-01/SV-02/SV-03', async ({ page }) => {
  await reset();
  await loginCitizen(page, ID.somchai);
  const fee = page.getByTestId('fee-total');
  const feeErr = page.getByTestId('fee-error');
  const toUpload = page.getByTestId('to-upload-btn');

  const sv03: Array<{ a: number; total: string; fee?: number; err?: string; code?: string }> = [
    { a: 0, total: '–', err: 'กรุณาระบุพื้นที่ 1–500 ตร.ม.', code: 'INVALID_AREA' },
    { a: -1, total: '–', err: 'กรุณาระบุพื้นที่ 1–500 ตร.ม.', code: 'INVALID_AREA' },
    { a: 1, total: '฿1,000', fee: 1000 },
    { a: 100, total: '฿1,000', fee: 1000 },
    { a: 101, total: '฿1,010', fee: 1010 },
    { a: 102, total: '฿1,020', fee: 1020 },
    { a: 250, total: '฿2,500', fee: 2500 },
    { a: 300, total: '฿3,000', fee: 3000 },
    { a: 499, total: '฿4,990', fee: 4990 },
    { a: 500, total: '฿5,000', fee: 5000 },
    { a: 501, total: '–', err: 'พื้นที่เกิน 500 ตร.ม. กรุณายื่นที่สำนักงาน', code: 'AREA_TOO_LARGE' },
  ];
  await page.goto('/citizen/new/SV-03');
  for (const r of sv03) {
    await test.step(`SV-03 area=${r.a}`, async () => {
      const lbl = `TC-FEE-01 SV-03 area=${r.a}`;
      await page.getByTestId('area-input').fill(String(r.a));
      await expect(fee, lbl).toHaveText(r.total);
      if (r.err) {
        await expect(feeErr, `${lbl} fee-error`).toHaveText(r.err);
        await expect(toUpload, `${lbl} to-upload-btn`).toBeDisabled();
      } else {
        await expect(feeErr, `${lbl} fee-error`).toHaveCount(0);
        await expect(toUpload, `${lbl} to-upload-btn`).toBeEnabled();
      }
      const a = await api(page, 'POST', '/api/drafts', { serviceId: 'SV-03', areaSqm: r.a });
      if (r.err) expect([a.status, a.json?.code], `${lbl} API`).toEqual([400, r.code]);
      else { expect(a.status, `${lbl} API status`).toBe(201); expect(a.json?.fee, `${lbl} API fee`).toBe(r.fee); }
    });
  }

  await page.goto('/citizen/new/SV-01');
  const sv01: Array<{ q: number; total: string; fee?: number }> = [
    { q: 0, total: '–' }, { q: 1, total: '฿20', fee: 20 }, { q: 2, total: '฿40', fee: 40 }, { q: 3, total: '฿60', fee: 60 },
    { q: 4, total: '฿80', fee: 80 }, { q: 5, total: '฿100', fee: 100 }, { q: 6, total: '–' },
  ];
  for (const r of sv01) {
    await test.step(`SV-01 qty=${r.q}`, async () => {
      const lbl = `TC-FEE-01 SV-01 qty=${r.q}`;
      await page.getByTestId('qty-input').fill(String(r.q));
      await expect(fee, lbl).toHaveText(r.total);
      if (r.fee === undefined) {
        await expect(feeErr, `${lbl} fee-error`).toHaveText('จำนวนฉบับต้อง 1–5 ฉบับ');
        await expect(toUpload, `${lbl} to-upload-btn`).toBeDisabled();
      } else {
        await expect(feeErr, `${lbl} fee-error`).toHaveCount(0);
        await expect(toUpload, `${lbl} to-upload-btn`).toBeEnabled();
      }
      const a = await api(page, 'POST', '/api/drafts', { serviceId: 'SV-01', qty: r.q });
      if (r.fee === undefined) expect([a.status, a.json?.code], `${lbl} API`).toEqual([400, 'INVALID_QTY']);
      else { expect(a.status, `${lbl} API status`).toBe(201); expect(a.json?.fee, `${lbl} API fee`).toBe(r.fee); }
    });
  }

  await test.step('SV-02 ฿500', async () => {
    await page.goto('/citizen/new/SV-02');
    await expect(fee, 'TC-FEE-01 SV-02').toHaveText('฿500');
    const a = await api(page, 'POST', '/api/drafts', { serviceId: 'SV-02' });
    expect(a.status, 'TC-FEE-01 SV-02 API status').toBe(201);
    expect(a.json?.fee, 'TC-FEE-01 SV-02 API fee').toBe(500);
  });
});

// ───────────────────────── SUBMIT ─────────────────────────
test('TC-SUBMIT-01 ยื่นคำขอ SV-01 ครบวงจร', async ({ page }) => {
  await reset();
  await loginCitizen(page, ID.somchai);
  await page.goto('/citizen');
  await page.getByTestId('start-service-SV-01').click();
  await expect(page.getByTestId('wizard-step'), 'ขั้น 1').toHaveText('1/3 กรอกข้อมูล');
  await page.getByTestId('qty-input').fill('2');
  await expect(page.getByTestId('fee-total'), 'ขั้น 1 fee-total').toHaveText('฿40');
  await page.getByTestId('to-upload-btn').click();

  await expect(page.getByTestId('wizard-step'), 'ขั้น 2').toHaveText('2/3 แนบเอกสาร');
  await expect(page.getByTestId('draft-id'), 'ขั้น 2 draft-id').toHaveText('DR-0003');
  await expect(page.getByTestId('to-payment-btn'), 'ขั้น 2 ก่อนแนบ').toBeDisabled();
  await uiUpload(page, 'upload-input-id-card', 'id-card.pdf');
  await expect(page.getByTestId('file-item'), 'ขั้น 2 file-item').toHaveCount(1);
  await expect(page.getByTestId('file-item'), 'ขั้น 2 data-doc-key').toHaveAttribute('data-doc-key', 'id-card');
  await expect(page.getByTestId('to-payment-btn'), 'ขั้น 2 หลังแนบ').toBeEnabled();
  await page.getByTestId('to-payment-btn').click();

  await expect(page.getByTestId('wizard-step'), 'ขั้น 3').toHaveText('3/3 ชำระเงิน');
  await expect(page.getByTestId('payment-amount'), 'ขั้น 3 payment-amount').toHaveText('฿40');
  await page.getByTestId('create-qr-btn').click();
  await expect(page.getByTestId('qr-ref'), 'ขั้น 3 qr-ref').toHaveText('PP-0002');
  await expect(page.getByTestId('qr-expires'), 'ขั้น 3 qr-expires').toHaveAttribute('data-iso', '2026-12-01T09:15:00+07:00');
  await expect(page.getByTestId('payment-status'), 'ขั้น 3 payment-status').toHaveText('รอชำระ');

  const p = await pay('PP-0002', 40);
  expect(p.status, 'ขั้น 4 pay status').toBe(200);
  expect(p.json, 'ขั้น 4 pay body').toEqual({ status: 'PAID', caseNo: 'EG-2569-000031', receiptNo: 'RC-2569-000031', duplicate: false });
  await page.getByTestId('refresh-payment-btn').click();
  await expect(page.getByTestId('payment-status'), 'ขั้น 4 payment-status').toHaveText('ชำระแล้ว');
  await expect(page.getByTestId('submitted-case-no'), 'ขั้น 4 submitted-case-no').toHaveText('EG-2569-000031');
  await expect(page.getByTestId('receipt-no'), 'ขั้น 4 receipt-no').toHaveText('RC-2569-000031');
  await expect(page.getByTestId('receipt-amount'), 'ขั้น 4 receipt-amount').toHaveText('฿40');
  await expect(page.getByTestId('receipt-paid-at'), 'ขั้น 4 receipt-paid-at').toHaveAttribute('data-iso', '2026-12-01T09:00:00+07:00');

  await page.getByTestId('go-case-btn').click();
  await page.waitForURL('**/citizen/cases/EG-2569-000031');
  await expect(page.getByTestId('case-status'), 'ขั้น 5 case-status').toHaveText('ส่งคำขอแล้ว');
  await expect(page.getByTestId('case-status'), 'ขั้น 5 data-status').toHaveAttribute('data-status', 'SUBMITTED');
  await expect(page.getByTestId('case-fee'), 'ขั้น 5 case-fee').toHaveText('฿40');
  await expect(page.getByTestId('sla-due'), 'ขั้น 5 sla-due').toHaveText('4 ธ.ค. 2569 16:30');
  await expect(page.getByTestId('sla-due'), 'ขั้น 5 sla-due data-iso').toHaveAttribute('data-iso', '2026-12-04T16:30:00+07:00');
  await expect(page.getByTestId('sla-level'), 'ขั้น 5 sla-level').toHaveText('ปกติ');
  await expect(page.getByTestId('cancel-case-btn'), 'ขั้น 5 cancel-case-btn').toHaveCount(1);
  await expect(page.getByTestId('case-step'), 'ขั้น 5 case-step').toHaveCount(0);

  await logout(page);
  await loginStaff(page, 'off.reg1');
  await page.goto('/officer/queue');
  const row = rowBy(page, 'queue-row', 'data-case-no', 'EG-2569-000031');
  await expect(row, 'คิว off.reg1 แถว 000031').toHaveCount(1);
  await expect(row.getByTestId('row-owner'), 'คิว row-owner').toHaveText('');
  await expect(row.getByTestId('claim-btn'), 'คิว claim-btn').toHaveCount(1);
  const order = await queueOrder(page);
  expect(order.indexOf('EG-2569-000031'), 'คิว: 000031 ต้องต่อจาก 000030').toBe(order.indexOf('EG-2569-000030') + 1);
  expect(order.indexOf('EG-2569-000030'), 'คิว: มี 000030').toBeGreaterThanOrEqual(0);
});

test('TC-SUBMIT-02 เอกสารบังคับครบก่อนชำระ', async ({ page }) => {
  await reset();
  await loginCitizen(page, ID.somchai);
  const toPay = page.getByTestId('to-payment-btn');
  const missing = page.getByTestId('missing-docs');
  const items = page.getByTestId('file-item');

  await test.step('SV-02', async () => {
    await page.goto('/citizen/new/SV-02');
    await expect(page.getByTestId('fee-total')).toHaveText('฿500');
    await page.getByTestId('to-upload-btn').click();
    await expect(page.getByTestId('wizard-step')).toHaveText('2/3 แนบเอกสาร');
    await uiUpload(page, 'upload-input-id-card', 'id-card.pdf');
    await expect(items, 'SV-02 id-card อย่างเดียว file-item').toHaveCount(1);
    await expect(toPay, 'SV-02 id-card อย่างเดียว to-payment-btn').toBeDisabled();
    await expect(missing, 'SV-02 id-card อย่างเดียว missing-docs').toHaveText('ยังขาดเอกสาร: แผนที่ตั้ง');
    await uiUpload(page, 'upload-input-map', 'map.pdf');
    await expect(items, 'SV-02 + map file-item').toHaveCount(2);
    await expect(toPay, 'SV-02 + map to-payment-btn').toBeEnabled();
    await expect(missing, 'SV-02 + map missing-docs').toHaveCount(0);
    await rowBy(page, 'file-item', 'data-doc-key', 'map').getByTestId('file-remove-btn').click();
    await expect(items, 'SV-02 ลบ map file-item').toHaveCount(1);
    await expect(toPay, 'SV-02 ลบ map to-payment-btn').toBeDisabled();
    await expect(missing, 'SV-02 ลบ map missing-docs').toHaveText('ยังขาดเอกสาร: แผนที่ตั้ง');
  });

  await test.step('SV-03 พื้นที่ 100', async () => {
    await page.goto('/citizen/new/SV-03');
    await page.getByTestId('area-input').fill('100');
    await expect(page.getByTestId('fee-total')).toHaveText('฿1,000');
    await page.getByTestId('to-upload-btn').click();
    await expect(page.getByTestId('wizard-step')).toHaveText('2/3 แนบเอกสาร');
    await uiUpload(page, 'upload-input-id-card', 'id-card.pdf');
    await expect(items, 'SV-03 id-card file-item').toHaveCount(1);
    await expect(toPay, 'SV-03 id-card to-payment-btn').toBeDisabled();
    await expect(missing, 'SV-03 id-card missing-docs').toHaveText('ยังขาดเอกสาร: แบบแปลน, โฉนด');
    await uiUpload(page, 'upload-input-deed', 'deed.pdf');
    await expect(items, 'SV-03 + deed file-item').toHaveCount(2);
    await expect(toPay, 'SV-03 + deed to-payment-btn').toBeDisabled();
    await expect(missing, 'SV-03 + deed missing-docs').toHaveText('ยังขาดเอกสาร: แบบแปลน');
    await uiUpload(page, 'upload-input-plan', 'plan-as-jpg.jpg');
    await expect(page.getByTestId('upload-error'), 'SV-03 plan jpg upload-error').toHaveText('แบบแปลนต้องเป็นไฟล์ PDF เท่านั้น');
    await expect(items, 'SV-03 plan jpg file-item').toHaveCount(2);
    await expect(toPay, 'SV-03 plan jpg to-payment-btn').toBeDisabled();
    await expect(missing, 'SV-03 plan jpg missing-docs').toHaveText('ยังขาดเอกสาร: แบบแปลน');
    await uiUpload(page, 'upload-input-plan', 'plan.pdf');
    await expect(items, 'SV-03 + plan.pdf file-item').toHaveCount(3);
    await expect(toPay, 'SV-03 + plan.pdf to-payment-btn').toBeEnabled();
    await expect(missing, 'SV-03 + plan.pdf missing-docs').toHaveCount(0);
  });

  await test.step('API MISSING_DOCS', async () => {
    const id = await createDraft(page, { serviceId: 'SV-03', areaSqm: 100 });
    expect((await upload(page, id, 'id-card', 'id-card.pdf')).status, 'API upload id-card').toBe(201);
    expect((await upload(page, id, 'deed', 'deed.pdf')).status, 'API upload deed').toBe(201);
    const r = await api(page, 'POST', `/api/drafts/${id}/payment`);
    expect([r.status, r.json?.code], 'API payment ขาดแบบแปลน').toEqual([409, 'MISSING_DOCS']);
    expect(r.json?.missing, 'API missing').toEqual(['แบบแปลน']);
    expect((await upload(page, id, 'plan', 'plan.pdf')).status, 'API upload plan').toBe(201);
    const ok = await api(page, 'POST', `/api/drafts/${id}/payment`);
    expect(ok.status, 'API payment ครบ').toBe(201);
  });
});

test('TC-SUBMIT-03 ร่าง การลบร่าง และการยกเลิก', async ({ page, browser }) => {
  await reset();
  await loginCitizen(page, ID.somchai);

  await test.step('ส่วน A ร่าง', async () => {
    await page.goto('/citizen');
    await expect(page.getByTestId('my-case-row'), 'A my-case-row').toHaveCount(10);
    await expect(page.getByTestId('my-draft-row'), 'A my-draft-row').toHaveCount(2);
    const d1 = rowBy(page, 'my-draft-row', 'data-draft-id', 'DR-0001');
    const d2 = rowBy(page, 'my-draft-row', 'data-draft-id', 'DR-0002');
    await expect(d1, 'A DR-0001 สถานะ').toHaveAttribute('data-status', 'DRAFT');
    await expect(d2, 'A DR-0002 สถานะ').toHaveAttribute('data-status', 'PENDING_PAYMENT');
    await expect(d1, 'A DR-0001 ไม่มี EG-').not.toContainText('EG-');
    await expect(d2, 'A DR-0002 ไม่มี EG-').not.toContainText('EG-');
    await d1.getByTestId('open-draft-btn').click();
    await expect(page.getByTestId('qty-input'), 'A DR-0001 qty').toHaveValue('2');
    await expect(page.getByTestId('fee-total'), 'A DR-0001 fee-total').toHaveText('฿40');

    await page.goto('/citizen/new/SV-01');
    await page.getByTestId('qty-input').fill('3');
    await expect(page.getByTestId('fee-total'), 'A qty 3').toHaveText('฿60');
    await page.getByTestId('save-draft-btn').click();
    await expect(page.getByTestId('draft-id'), 'A draft-id').toHaveText('DR-0003');
    await page.goto('/citizen');
    await expect(page.getByTestId('my-case-row'), 'A my-case-row หลังบันทึกร่าง').toHaveCount(10);
    const cases = await api(page, 'GET', '/api/cases');
    expect(cases.json.items.length, 'A GET /api/cases items').toBe(10);
    const drafts = await api(page, 'GET', '/api/drafts');
    expect(drafts.json.items.length, 'A GET /api/drafts items').toBe(3);
  });

  await test.step('ส่วน B ยกเลิก', async () => {
    await reset();
    await loginCitizen(page, ID.somchai);
    await page.goto('/citizen/cases/EG-2569-000030');
    await expect(page.getByTestId('cancel-case-btn'), 'B cancel-case-btn').toHaveCount(1);
    await page.getByTestId('cancel-case-btn').click();
    await expect(page.getByTestId('cancel-confirm-text'), 'B cancel-confirm-text').toHaveText('ค่าธรรมเนียมที่ชำระแล้วไม่คืน');
    await page.getByTestId('confirm-cancel-btn').click();
    await expect(page.getByTestId('case-status'), 'B case-status').toHaveText('ยกเลิก');
    await expect(page.getByTestId('case-status'), 'B data-status').toHaveAttribute('data-status', 'CANCELLED');
    await expect(page.getByTestId('no-refund-note'), 'B no-refund-note').toHaveText('ค่าธรรมเนียมที่ชำระแล้วไม่คืน');
    await expect(page.getByTestId('cancel-case-btn'), 'B cancel-case-btn หลังยกเลิก').toHaveCount(0);

    await logout(page);
    await loginStaff(page, 'off.reg1');
    await page.goto('/officer/queue');
    await expect(page.getByTestId('queue-row'), 'B queue-row').toHaveCount(16);
    await expect(rowBy(page, 'queue-row', 'data-case-no', 'EG-2569-000030'), 'B 000030 ในคิว').toHaveCount(0);

    await logout(page);
    await loginStaff(page, 'exec1');
    await page.goto('/dashboard');
    await expect(page.getByTestId('kpi-backlog'), 'B kpi-backlog').toHaveText('20');
    await expect(page.getByTestId('kpi-received'), 'B kpi-received').toHaveText('3');
  });

  await test.step('ส่วน C ยกเลิกไม่ได้เมื่อมีผู้รับ', async () => {
    await reset();
    await loginCitizen(page, ID.somchai);
    const staff = await newStaffApi('off.reg1');
    const c = await claim(staff, 'EG-2569-000030');
    expect(c.status, 'C claim 000030').toBe(200);
    await page.goto('/citizen/cases/EG-2569-000030');
    await expect(page.getByTestId('case-status'), 'C case-status').toHaveText('กำลังตรวจสอบ');
    await expect(page.getByTestId('cancel-case-btn'), 'C cancel-case-btn').toHaveCount(0);
    const r = await api(page, 'POST', '/api/cases/EG-2569-000030/cancel');
    expect([r.status, r.json?.code], 'C cancel 000030').toEqual([409, 'CANNOT_CANCEL']);
    expect(r.json?.message, 'C cancel message').toBe('ยกเลิกไม่ได้ คำขอมีเจ้าหน้าที่รับเรื่องแล้ว');
    const r13 = await api(page, 'POST', '/api/cases/EG-2569-000013/cancel');
    expect([r13.status, r13.json?.code], 'C cancel 000013').toEqual([409, 'CANNOT_CANCEL']);
  });

  await test.step('ส่วน E ลบร่าง', async () => {
    await reset();
    await loginCitizen(page, ID.somchai);
    expect((await api(page, 'DELETE', '/api/drafts/DR-0001')).status, 'E DELETE DR-0001').toBe(204);
    expect((await api(page, 'GET', '/api/drafts/DR-0001')).status, 'E GET DR-0001').toBe(404);
    await page.goto('/citizen');
    await expect(page.getByTestId('my-draft-row'), 'E my-draft-row').toHaveCount(1);
    await expect(rowBy(page, 'my-draft-row', 'data-draft-id', 'DR-0002'), 'E DR-0002').toHaveCount(1);
    expect((await api(page, 'DELETE', '/api/drafts/DR-0002')).status, 'E DELETE DR-0002').toBe(204);
    expect((await api(page, 'GET', '/api/payments/PP-0001')).status, 'E GET PP-0001').toBe(404);
    expect((await pay('PP-0001', 500)).status, 'E pay PP-0001').toBe(404);
  });

  await test.step('ส่วน F ยกเลิกชนกับรับเรื่อง', async () => {
    await reset();
    const somchai = await newCitizenApi(ID.somchai);
    const off1 = await newStaffApi('off.reg1');
    const [cancel, cl] = await Promise.all([
      api(somchai, 'POST', '/api/cases/EG-2569-000030/cancel'),
      claim(off1, 'EG-2569-000030'),
    ]);
    expect(!(cancel.status === 200 && cl.status === 200), `F ห้ามสำเร็จทั้งคู่ (cancel=${cancel.status} claim=${cl.status})`).toBe(true);
    const exec = await newStaffApi('exec1');
    const dash = await api(exec, 'GET', '/api/dashboard?period=2026-12&service=ALL');
    expect(dash.status, 'F dashboard').toBe(200);
    const w1 = (dash.json.workload as any[]).find((w) => w.username === 'off.reg1')?.count;
    const c = await getCase(somchai, 'EG-2569-000030');
    if (cancel.status === 200) {
      expect([cl.status, cl.json?.code], 'F ยกเลิกชนะ: claim').toEqual([409, 'INVALID_STATE']);
      expect(c.status, 'F ยกเลิกชนะ: status').toBe('CANCELLED');
      expect(c.owner || null, 'F ยกเลิกชนะ: owner').toBeNull();
      expect(w1, 'F ยกเลิกชนะ: งานในมือ off.reg1').toBe(3);
    } else {
      expect(cl.status, 'F รับเรื่องชนะ: claim').toBe(200);
      expect([cancel.status, cancel.json?.code], 'F รับเรื่องชนะ: cancel').toEqual([409, 'CANNOT_CANCEL']);
      expect(c.status, 'F รับเรื่องชนะ: status').toBe('IN_REVIEW');
      expect(c.owner, 'F รับเรื่องชนะ: owner').toBe('off.reg1');
      expect(w1, 'F รับเรื่องชนะ: งานในมือ off.reg1').toBe(4);
    }
  });
});

// ───────────────────────── UPLOAD ─────────────────────────
/** เปิดร่าง SV-01 (qty 1) ที่ขั้นแนบเอกสาร */
async function openUploadStep(page: Page): Promise<void> {
  await page.goto('/citizen/new/SV-01');
  await expect(page.getByTestId('fee-total')).toHaveText('฿20');
  await page.getByTestId('to-upload-btn').click();
  await expect(page.getByTestId('wizard-step')).toHaveText('2/3 แนบเอกสาร');
}

test('TC-UPLOAD-01 ขนาดและจำนวนไฟล์', async ({ page }) => {
  await reset();
  await loginCitizen(page, ID.somchai);
  await openUploadStep(page);
  const items = page.getByTestId('file-item');
  const err = page.getByTestId('upload-error');

  await test.step('ขนาด 5,242,879 → รับ', async () => {
    await uiUpload(page, 'upload-input-id-card', 'size-5242879.pdf');
    await expect(items, 'UI 5242879 file-item').toHaveCount(1);
    await items.first().getByTestId('file-remove-btn').click();
    await expect(items, 'UI 5242879 หลังลบ').toHaveCount(0);
  });
  await test.step('ขนาด 5,242,880 → รับ (ขอบ)', async () => {
    await uiUpload(page, 'upload-input-id-card', 'size-5242880.pdf');
    await expect(items, 'UI 5242880 file-item').toHaveCount(1);
    await expect(err, 'UI 5242880 upload-error').toHaveCount(0);
    await items.first().getByTestId('file-remove-btn').click();
    await expect(items, 'UI 5242880 หลังลบ').toHaveCount(0);
  });
  await test.step('ขนาด 5,242,881 → ปฏิเสธ', async () => {
    await uiUpload(page, 'upload-input-id-card', 'size-5242881.pdf');
    await expect(err, 'UI 5242881 upload-error').toHaveText('ไฟล์ใหญ่เกิน 5 MB');
    await expect(items, 'UI 5242881 file-item').toHaveCount(0);
  });
  await test.step('ขนาดผ่าน API', async () => {
    for (const [name, status] of [['size-5242879.pdf', 201], ['size-5242880.pdf', 201], ['size-5242881.pdf', 400]] as const) {
      const id = await createDraft(page, { serviceId: 'SV-01', qty: 1 });
      const r = await upload(page, id, 'id-card', name);
      expect(r.status, `API ${name} status`).toBe(status);
      if (status === 400) {
        expect(r.json?.code, `API ${name} code`).toBe('FILE_TOO_LARGE');
        expect(r.json?.message, `API ${name} message`).toBe('ไฟล์ใหญ่เกิน 5 MB');
      }
    }
  });

  await test.step('จำนวนไฟล์ผ่านจอ', async () => {
    await openUploadStep(page);
    await uiUpload(page, 'upload-input-id-card', 'id-card.pdf');
    await expect(items, 'UI count id-card').toHaveCount(1);
    for (let i = 1; i <= 4; i++) {
      await uiUpload(page, 'upload-input-extra', `multi-${i}.pdf`);
      await expect(items, `UI count หลัง multi-${i}`).toHaveCount(1 + i);
    }
    await expect(items, 'UI รวม 5 ไฟล์').toHaveCount(5);
    await uiUpload(page, 'upload-input-extra', 'multi-5.pdf');
    await expect(err, 'UI ไฟล์ที่ 6 upload-error').toHaveText('แนบได้สูงสุด 5 ไฟล์ต่อคำขอ');
    await expect(items, 'UI ไฟล์ที่ 6 file-item').toHaveCount(5);
    await items.first().getByTestId('file-remove-btn').click();
    await expect(items, 'UI ลบ 1 ไฟล์').toHaveCount(4);
    await uiUpload(page, 'upload-input-extra', 'multi-5.pdf');
    await expect(items, 'UI แนบ multi-5 หลังลบ').toHaveCount(5);
  });

  await test.step('จำนวนไฟล์ผ่าน API', async () => {
    const id = await createDraft(page, { serviceId: 'SV-01', qty: 1 });
    expect((await upload(page, id, 'id-card', 'id-card.pdf')).status, 'API id-card').toBe(201);
    for (let i = 1; i <= 4; i++) expect((await upload(page, id, 'extra', `multi-${i}.pdf`)).status, `API multi-${i}`).toBe(201);
    const r = await upload(page, id, 'extra', 'multi-5.pdf');
    expect([r.status, r.json?.code], 'API ไฟล์ที่ 6').toEqual([400, 'FILE_COUNT']);
    const d = await api(page, 'GET', `/api/drafts/${id}`);
    expect(d.json?.files?.length, 'API files.length หลังไฟล์ที่ 6 ถูกปฏิเสธ').toBe(5);
  });
});

test('TC-UPLOAD-02 ชนิดไฟล์จากเนื้อไฟล์', async ({ page }) => {
  await reset();
  await loginCitizen(page, ID.somchai);
  await openUploadStep(page);
  const items = page.getByTestId('file-item');
  const err = page.getByTestId('upload-error');
  const fs = require('fs') as typeof import('fs');

  for (const f of ['ok-id.pdf', 'real.jpg', 'real.png']) {
    await test.step(`UI รับ ${f}`, async () => {
      await uiUpload(page, 'upload-input-id-card', f);
      await expect(items, `UI ${f} file-item`).toHaveCount(1);
      await expect(err, `UI ${f} upload-error`).toHaveCount(0);
      await items.first().getByTestId('file-remove-btn').click();
      await expect(items, `UI ${f} หลังลบ`).toHaveCount(0);
    });
  }
  const rejects: Array<{ label: string; f: string | { name: string; mimeType: string; buffer: Buffer } }> = [
    { label: 'fake-text.pdf', f: 'fake-text.pdf' },
    { label: 'fake-text.jpg', f: 'fake-text.jpg' },
    { label: 'exe-as.png', f: 'exe-as.png' },
    { label: 'notes.txt', f: 'notes.txt' },
    { label: 'fake-text.pdf + Content-Type application/pdf', f: { name: 'fake-text.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(file('fake-text.pdf')) } },
  ];
  for (const r of rejects) {
    await test.step(`UI ปฏิเสธ ${r.label}`, async () => {
      await uiUpload(page, 'upload-input-id-card', r.f);
      await expect(err, `UI ${r.label} upload-error`).toHaveText('รองรับเฉพาะไฟล์ PDF, JPG, PNG');
      await expect(items, `UI ${r.label} file-item`).toHaveCount(0);
    });
  }

  await test.step('API', async () => {
    for (const f of ['ok-id.pdf', 'real.jpg', 'real.png']) {
      const id = await createDraft(page, { serviceId: 'SV-01', qty: 1 });
      const r = await upload(page, id, 'id-card', f);
      expect(r.status, `API รับ ${f}`).toBe(201);
    }
    const id = await createDraft(page, { serviceId: 'SV-01', qty: 1 });
    const apiRejects: Array<[string, string | undefined]> = [
      ['fake-text.pdf', undefined], ['fake-text.jpg', undefined], ['exe-as.png', undefined], ['notes.txt', undefined],
      ['fake-text.pdf', 'application/pdf'],
    ];
    for (const [name, mime] of apiRejects) {
      const lbl = `API ปฏิเสธ ${name}${mime ? ' (' + mime + ')' : ''}`;
      const r = await upload(page, id, 'id-card', name, mime ? { mimeType: mime } : undefined);
      expect([r.status, r.json?.code], lbl).toEqual([400, 'FILE_TYPE']);
      const d = await api(page, 'GET', `/api/drafts/${id}`);
      expect(d.json?.files?.length, `${lbl} files.length`).toBe(0);
    }
  });
});

// ───────────────────────── PAY ─────────────────────────
test('TC-PAY-01 อายุ QR 15:00', async ({ page }) => {
  const amount = 500;
  await test.step('รอบ 1 อายุ 5:00', async () => {
    await reset();
    await loginCitizen(await newApi(), ID.somchai);
    const r = await pay('PP-0001', amount);
    expect([r.status, r.json?.status, r.json?.caseNo], 'รอบ 1').toEqual([200, 'PAID', 'EG-2569-000031']);
  });
  await test.step('รอบ 2 อายุ 14:59', async () => {
    await reset();
    await setClock('2026-12-01T09:09:59+07:00');
    const r = await pay('PP-0001', amount);
    expect([r.status, r.json?.status, r.json?.caseNo], 'รอบ 2').toEqual([200, 'PAID', 'EG-2569-000031']);
  });
  await test.step('รอบ 3 อายุ 15:00 → 410', async () => {
    await reset();
    await setClock('2026-12-01T09:10:00+07:00');
    const t = await newCitizenApi(ID.somchai);
    const r = await pay('PP-0001', amount);
    expect([r.status, r.json?.code], 'รอบ 3 pay').toEqual([410, 'QR_EXPIRED']);
    const g = await api(t, 'GET', '/api/payments/PP-0001');
    expect(g.json?.status, 'รอบ 3 payment status').toBe('EXPIRED');
    const c = await api(t, 'GET', '/api/cases');
    expect(c.json?.items?.length, 'รอบ 3 GET /api/cases').toBe(10);

    await loginCitizen(page, ID.somchai);
    await page.goto('/citizen/new/SV-02?draft=DR-0002');
    await expect(page.getByTestId('qr-expired-msg'), 'รอบ 3 qr-expired-msg').toHaveText('QR หมดอายุ กรุณาสร้าง QR ใหม่');
    await expect(page.getByTestId('payment-status'), 'รอบ 3 payment-status').toHaveText('QR หมดอายุ');
    await expect(page.getByTestId('payment-status'), 'รอบ 3 data-status').toHaveAttribute('data-status', 'EXPIRED');
    await page.getByTestId('regenerate-qr-btn').click();
    await expect(page.getByTestId('qr-ref'), 'รอบ 3 qr-ref ใหม่').toHaveText('PP-0002');
    await expect(page.getByTestId('qr-expires'), 'รอบ 3 qr-expires ใหม่').toHaveAttribute('data-iso', '2026-12-01T09:25:00+07:00');
    const p2 = await pay('PP-0002', amount);
    expect([p2.status, p2.json?.caseNo], 'รอบ 3 pay PP-0002').toEqual([200, 'EG-2569-000031']);
  });
  await test.step('รอบ 4 อายุ 15:01 → 410', async () => {
    await reset();
    await setClock('2026-12-01T09:10:01+07:00');
    await loginCitizen(await newApi(), ID.somchai);
    const r = await pay('PP-0001', amount);
    expect([r.status, r.json?.code], 'รอบ 4').toEqual([410, 'QR_EXPIRED']);
  });
});

test('TC-PAY-02 ยอดเงินและ callback ซ้ำ', async () => {
  await reset();
  const t = await newCitizenApi(ID.somchai);
  const draftId = await createDraft(t, { serviceId: 'SV-01', qty: 1 });
  expect((await upload(t, draftId, 'id-card', 'id-card.pdf')).status, 'upload id-card').toBe(201);
  const qr = await createQr(t, draftId);
  expect(qr.ref, 'ref').toBe('PP-0002');
  expect(qr.amount, 'amount').toBe(20);
  const countCases = async () => (await api(t, 'GET', '/api/cases')).json.items.length as number;

  for (const [step, amt] of [[1, 19], [2, 21]] as const) {
    const r = await pay('PP-0002', amt);
    expect([r.status, r.json?.code], `ขั้น ${step} pay ${amt}`).toEqual([422, 'AMOUNT_MISMATCH']);
    expect((await api(t, 'GET', '/api/payments/PP-0002')).json?.status, `ขั้น ${step} status`).toBe('PENDING');
    expect(await countCases(), `ขั้น ${step} GET /api/cases`).toBe(10);
  }
  const ok = await pay('PP-0002', 20);
  expect([ok.status, ok.json?.status, ok.json?.caseNo, ok.json?.receiptNo], 'ขั้น 3 pay 20').toEqual([200, 'PAID', 'EG-2569-000031', 'RC-2569-000031']);
  expect(await countCases(), 'ขั้น 3 GET /api/cases').toBe(11);
  const dup = await pay('PP-0002', 20);
  expect([dup.status, dup.json?.duplicate, dup.json?.caseNo, dup.json?.receiptNo], 'ขั้น 4 callback ซ้ำ').toEqual([200, true, 'EG-2569-000031', 'RC-2569-000031']);
  expect(await countCases(), 'ขั้น 4 GET /api/cases').toBe(11);

  const next = await newPaid({ t, service: 'SV-01', qty: 1 });
  expect(next.caseNo, 'ขั้น 5 caseNo').toBe('EG-2569-000032');
  expect((await api(t, 'GET', `/api/payments/${next.ref}`)).json?.receiptNo, 'ขั้น 5 receiptNo').toBe('RC-2569-000032');
});

test('TC-PAY-03 ชำระพร้อมกัน เลขไม่ซ้ำ', async () => {
  await reset();
  const users = [await newCitizenApi(ID.somchai), await newCitizenApi(ID.somying)];
  const refs: string[] = [];
  const owner: Record<string, number> = {};
  for (let u = 0; u < users.length; u++) {
    for (let i = 0; i < 3; i++) {
      const id = await createDraft(users[u], { serviceId: 'SV-01', qty: 1 });
      expect((await upload(users[u], id, 'id-card', 'id-card.pdf')).status, `upload u${u} #${i}`).toBe(201);
      const qr = await createQr(users[u], id);
      refs.push(qr.ref);
      owner[qr.ref] = u;
    }
  }
  expect([...refs].sort(), 'refs').toEqual(['PP-0002', 'PP-0003', 'PP-0004', 'PP-0005', 'PP-0006', 'PP-0007']);
  const results = await Promise.all(refs.map((r) => pay(r, 20)));
  results.forEach((r, i) => expect(r.status, `pay ${refs[i]}`).toBe(200));
  const cases = results.map((r) => r.json.caseNo as string);
  const receipts = results.map((r) => r.json.receiptNo as string);
  const wantCases = [31, 32, 33, 34, 35, 36].map(EG);
  expect(new Set(cases).size, 'caseNo ไม่ซ้ำ').toBe(6);
  expect([...cases].sort(), 'ชุด caseNo').toEqual(wantCases);
  expect([...receipts].sort(), 'ชุด receiptNo').toEqual([31, 32, 33, 34, 35, 36].map((n) => `RC-2569-0000${n}`));
  for (let u = 0; u < users.length; u++) {
    const mine = cases.filter((_, i) => owner[refs[i]] === u).sort();
    const list = (await api(users[u], 'GET', '/api/cases')).json.items as any[];
    const newOnes = list.map((i) => i.caseNo as string).filter((n) => wantCases.includes(n)).sort();
    expect(newOnes, `GET /api/cases ผู้ใช้ ${u} เลขใหม่`).toEqual(mine);
    expect(newOnes.length, `ผู้ใช้ ${u} จำนวนเลขใหม่`).toBe(3);
  }
  const next = await newPaid({ t: users[0], service: 'SV-01' });
  expect(next.caseNo, 'ใบถัดไป').toBe('EG-2569-000037');
});

test('TC-PAY-04 เลขคำขอข้ามปี 2569 → 2570', async ({ page }) => {
  await reset();
  await loginCitizen(page, ID.somchai);
  let draftId = '';
  let ref = '';
  await test.step('1 23:58 สร้างร่าง + QR', async () => {
    await setClock('2026-12-31T23:58:00+07:00');
    await page.goto('/citizen/new/SV-01');
    await expect(page.getByTestId('fee-total')).toHaveText('฿20');
    await page.getByTestId('to-upload-btn').click();
    await uiUpload(page, 'upload-input-id-card', 'id-card.pdf');
    await expect(page.getByTestId('file-item'), 'ขั้น 1 file-item').toHaveCount(1);
    draftId = (await page.getByTestId('draft-id').textContent())?.trim() ?? '';
    await page.getByTestId('to-payment-btn').click();
    await page.getByTestId('create-qr-btn').click();
    await expect(page.getByTestId('payment-status'), 'ขั้น 1 payment-status').toHaveText('รอชำระ');
    ref = (await page.getByTestId('qr-ref').textContent())?.trim() ?? '';
    expect(ref, 'ขั้น 1 ref').toBe('PP-0002');
    const c = await api(page, 'GET', '/api/cases');
    expect(c.json.items.length, 'ขั้น 1 ยังไม่มีเลขคำขอใหม่').toBe(10);
  });
  await test.step('2 23:59 ชำระ', async () => {
    await setClock('2026-12-31T23:59:00+07:00');
    const r = await pay(ref, 20);
    expect([r.status, r.json?.caseNo, r.json?.receiptNo], 'ขั้น 2 pay').toEqual([200, 'EG-2569-000031', 'RC-2569-000031']);
    await page.getByTestId('refresh-payment-btn').click();
    await expect(page.getByTestId('submitted-case-no'), 'ขั้น 2 submitted-case-no').toHaveText('EG-2569-000031');
    await expect(page.getByTestId('receipt-no'), 'ขั้น 2 receipt-no').toHaveText('RC-2569-000031');
    await expect(page.getByTestId('receipt-paid-at'), 'ขั้น 2 receipt-paid-at').toHaveAttribute('data-iso', '2026-12-31T23:59:00+07:00');
  });
  await test.step('3 ปี 2570 ใบแรก', async () => {
    const n = await newPaid({ t: page, service: 'SV-01', at: '2027-01-01T00:00:00+07:00' });
    expect(n.caseNo, 'ขั้น 3 caseNo').toBe('EG-2570-000001');
    expect((await api(page, 'GET', `/api/payments/${n.ref}`)).json?.receiptNo, 'ขั้น 3 receiptNo').toBe('RC-2570-000001');
  });
  await test.step('4 ปี 2570 ใบที่ 2', async () => {
    const n = await newPaid({ t: page, service: 'SV-01', at: '2027-01-01T00:00:00+07:00' });
    expect(n.caseNo, 'ขั้น 4 caseNo').toBe('EG-2570-000002');
  });
  await test.step('5 เลขเดิมไม่ถูกแก้', async () => {
    const c = await getCase(page, 'EG-2569-000031');
    expect(c.caseNo, 'ขั้น 5 caseNo').toBe('EG-2569-000031');
  });
});

// ───────────────────────── QUEUE ─────────────────────────
test('TC-QUEUE-01 ลำดับคิวและขอบเขตแผนก', async ({ page }) => {
  await reset();
  const regOrder = egList([20, 22, 24, 23, 25, 26, 13, 15, 27, 28, 29, 30, 16, 18, 19, 12, 21]);
  const claimable = new Set(egList([24, 28, 29, 30]));

  await loginStaff(page, 'off.reg1');
  await page.goto('/officer/queue');
  await expect(page.getByTestId('queue-filter'), 'reg1 filter เริ่มต้น').toHaveValue('all');
  await expect(page.getByTestId('queue-row'), 'reg1 queue-row').toHaveCount(17);
  expect(await queueOrder(page), 'reg1 ลำดับ').toEqual(regOrder);
  const levels = await page.getByTestId('row-sla-level').evaluateAll((els) => els.slice(0, 3).map((e) => (e.textContent ?? '').trim()));
  expect(levels, 'reg1 row-sla-level 3 แถวแรก').toEqual(['เกินกำหนด', 'ใกล้ครบกำหนด', 'ใกล้ครบกำหนด']);
  const masks = await page.getByTestId('row-id-masked').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
  expect(masks.length, 'reg1 row-id-masked จำนวน').toBe(17);
  masks.forEach((m, i) => expect(m, `reg1 row-id-masked แถว ${i + 1}`).toMatch(/^X-XXXX-XXXXX-\d{2}-\d$/));
  await expect(page.getByTestId('claim-btn'), 'reg1 claim-btn รวม').toHaveCount(4);
  for (const no of regOrder) {
    await expect(rowBy(page, 'queue-row', 'data-case-no', no).getByTestId('claim-btn'), `reg1 claim-btn ${no}`).toHaveCount(claimable.has(no) ? 1 : 0);
  }
  await page.getByTestId('queue-filter').selectOption('unclaimed');
  await page.waitForURL(/filter=unclaimed/);
  await expect(page.getByTestId('queue-row'), 'reg1 unclaimed').toHaveCount(4);
  expect(await queueOrder(page), 'reg1 unclaimed ลำดับ').toEqual(egList([24, 28, 29, 30]));
  await page.getByTestId('queue-filter').selectOption('mine');
  await page.waitForURL(/filter=mine/);
  await expect(page.getByTestId('queue-row'), 'reg1 mine').toHaveCount(3);
  expect(await queueOrder(page), 'reg1 mine ลำดับ').toEqual(egList([20, 22, 23]));
  await expect(page.getByTestId('workload-count'), 'reg1 workload-count').toHaveText('3');
  const apiQ = await api(page, 'GET', '/api/officer/queue?filter=all');
  expect(apiQ.json.items.length, 'reg1 API queue').toBe(17);
  for (const nr of [17, 11, 14]) {
    expect(regOrder.includes(EG(nr)), `ไม่อยู่ในคิว ${EG(nr)}`).toBe(false);
  }

  await loginStaff(page, 'off.reg2');
  await page.goto('/officer/queue?filter=mine');
  await expect(page.getByTestId('queue-row'), 'reg2 mine').toHaveCount(9);
  expect(await queueOrder(page), 'reg2 mine ลำดับ').toEqual(egList([25, 26, 13, 15, 27, 16, 18, 12, 21]));
  await expect(page.getByTestId('workload-count'), 'reg2 workload-count').toHaveText('9');

  await loginStaff(page, 'off.works1');
  await page.goto('/officer/queue');
  await expect(page.getByTestId('queue-row'), 'works1 queue-row').toHaveCount(1);
  expect(await queueOrder(page), 'works1 ลำดับ').toEqual([EG(10)]);
  const wq = await api(page, 'GET', '/api/officer/queue?filter=all');
  expect((wq.json.items as any[]).map((i) => i.caseNo), 'works1 API queue').toEqual([EG(10)]);

  await loginStaff(page, 'head1');
  await page.goto('/officer/queue');
  await expect(page.getByTestId('queue-row'), 'head1 queue-row').toHaveCount(18);
  expect(await queueOrder(page), 'head1 ลำดับ').toEqual(egList([20, 22, 24, 10, 23, 25, 26, 13, 15, 27, 28, 29, 30, 16, 18, 19, 12, 21]));
  await expect(page.getByTestId('claim-btn'), 'head1 claim-btn').toHaveCount(0);
});

test('TC-QUEUE-02 รับเรื่องซ้อน (พร้อมกันและต่อกัน)', async ({ browser }) => {
  await test.step('ส่วน 1 พร้อมกัน (UI)', async () => {
    await reset();
    const pA = await newCtxPage(browser);
    const pB = await newCtxPage(browser);
    await loginStaff(pA, 'off.reg1');
    await loginStaff(pB, 'off.reg2');
    await pA.goto('/officer/queue');
    await pB.goto('/officer/queue');
    const rowA = rowBy(pA, 'queue-row', 'data-case-no', 'EG-2569-000028');
    const rowB = rowBy(pB, 'queue-row', 'data-case-no', 'EG-2569-000028');
    await expect(rowA.getByTestId('claim-btn')).toHaveCount(1);
    await expect(rowB.getByTestId('claim-btn')).toHaveCount(1);
    await Promise.all([rowA.getByTestId('claim-btn').click(), rowB.getByTestId('claim-btn').click()]);
    await expect.poll(async () => (await pA.getByTestId('action-error').count()) + (await pB.getByTestId('action-error').count()),
      { message: 'ส่วน 1: ต้องมีผู้แพ้ที่เห็น action-error 1 คน' }).toBe(1);
    const aLost = (await pA.getByTestId('action-error').count()) === 1;
    const loser = aLost ? pA : pB;
    const winner = aLost ? pB : pA;
    const winnerUser = aLost ? 'off.reg2' : 'off.reg1';
    const winnerName = aLost ? 'เจ้าหน้าที่ทะเบียน 2' : 'เจ้าหน้าที่ทะเบียน 1';
    await expect(loser.getByTestId('action-error'), 'ส่วน 1 action-error').toHaveText('มีเจ้าหน้าที่รับเรื่องนี้แล้ว');
    await expect(rowBy(winner, 'queue-row', 'data-case-no', 'EG-2569-000028').getByTestId('row-owner'), 'ส่วน 1 row-owner').toHaveText(winnerName);
    const c = await getCase(winner, 'EG-2569-000028');
    expect(c.owner, 'ส่วน 1 owner').toBe(winnerUser);
    expect(c.status, 'ส่วน 1 status').toBe('IN_REVIEW');
    const claims = (await auditItems('CLAIM')).filter((i) => i.caseNo === EG(28));
    expect(claims.length, 'ส่วน 1 Audit CLAIM 000028').toBe(1);
  });

  await test.step('ส่วน 2 พร้อมกัน (API)', async () => {
    await reset();
    const c1 = await newStaffApi('off.reg1');
    const c2 = await newStaffApi('off.reg2');
    const calls = [c1, c1, c1, c1, c1, c2, c2, c2, c2, c2].map((c) => claim(c, EG(29)));
    const rs = await Promise.all(calls);
    const oks = rs.filter((r) => r.status === 200);
    expect(oks.length, `ส่วน 2 จำนวน 200 (status ทั้งหมด ${rs.map((r) => r.status).join(',')})`).toBe(1);
    const others = rs.filter((r) => r.status !== 200);
    expect(others.map((r) => [r.status, r.json?.code]), 'ส่วน 2 อีก 9').toEqual(Array(9).fill([409, 'ALREADY_CLAIMED']));
    const c = await getCase(c1, EG(29));
    expect(c.owner, 'ส่วน 2 owner').toBe(oks[0].json.owner);
    const claims = (await auditItems('CLAIM')).filter((i) => i.caseNo === EG(29));
    expect(claims.length, 'ส่วน 2 Audit CLAIM 000029').toBe(1);
  });

  await test.step('ส่วน 3 ต่อกัน', async () => {
    await reset();
    const c1 = await newStaffApi('off.reg1');
    const c2 = await newStaffApi('off.reg2');
    const r1 = await claim(c1, EG(29));
    expect([r1.status, r1.json?.owner], 'ส่วน 3 off.reg1 claim').toEqual([200, 'off.reg1']);
    const r2 = await claim(c2, EG(29));
    expect([r2.status, r2.json?.code], 'ส่วน 3 off.reg2 claim').toEqual([409, 'ALREADY_CLAIMED']);
    expect(r2.json?.message, 'ส่วน 3 ข้อความ').toBe('มีเจ้าหน้าที่รับเรื่องนี้แล้ว');
    expect((await getCase(c1, EG(29))).owner, 'ส่วน 3 owner').toBe('off.reg1');
    const p = await newCtxPage(browser);
    await loginStaff(p, 'off.reg2');
    await p.goto('/officer/queue');
    await expect(p.getByTestId('workload-count'), 'ส่วน 3 workload-count off.reg2').toHaveText('9');
    const r3 = await claim(c1, EG(29));
    expect([r3.status, r3.json?.code], 'ส่วน 3 off.reg1 claim ซ้ำ').toEqual([409, 'ALREADY_CLAIMED']);
    const claims = (await auditItems('CLAIM')).filter((i) => i.caseNo === EG(29));
    expect(claims.length, 'ส่วน 3 Audit CLAIM 000029').toBe(1);
  });
});

test('TC-QUEUE-03 งานในมือสูงสุด 10', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const wl = page.getByTestId('workload-count');
  const claimRow = (no: string) => rowBy(page, 'queue-row', 'data-case-no', no).getByTestId('claim-btn');
  await reset();
  await loginStaff(page, 'off.reg2');
  await page.goto('/officer/queue');

  await test.step('1 งานในมือ 9', async () => { await expect(wl, 'ขั้น 1').toHaveText('9'); });
  await test.step('2 claim 000028 (ครั้งที่ 10)', async () => {
    await claimRow(EG(28)).click();
    await expect(wl, 'ขั้น 2').toHaveText('10');
  });
  await test.step('3 claim 000029 (ครั้งที่ 11) ไม่สำเร็จ', async () => {
    await claimRow(EG(29)).click();
    await expect(page.getByTestId('action-error'), 'ขั้น 3 action-error').toHaveText('รับงานได้สูงสุด 10 เรื่อง');
    const r = await claim(page, EG(29));
    expect([r.status, r.json?.code], 'ขั้น 3 API').toEqual([409, 'WORKLOAD_LIMIT']);
    const c = await getCase(page, EG(29));
    expect(c.status, 'ขั้น 3 status 000029').toBe('SUBMITTED');
    expect(c.owner || null, 'ขั้น 3 owner 000029').toBeNull();
    await expect(wl, 'ขั้น 3 workload-count').toHaveText('10');
  });
  await test.step('4 อนุมัติ 000025 → งานในมือ 9', async () => {
    await page.goto(`/officer/cases/${EG(25)}`);
    await page.getByTestId('approve-btn').click();
    await expect(page.getByTestId('case-status'), 'ขั้น 4 case-status').toHaveAttribute('data-status', 'APPROVED');
    await page.goto('/officer/queue');
    await expect(wl, 'ขั้น 4 workload-count').toHaveText('9');
  });
  await test.step('5 claim 000029 อีกครั้ง', async () => {
    await claimRow(EG(29)).click();
    await expect(wl, 'ขั้น 5').toHaveText('10');
  });
  await test.step('6 off.reg1 claim 000030', async () => {
    const off1 = await newStaffApi('off.reg1');
    const r = await claim(off1, EG(30));
    expect(r.status, 'ขั้น 6').toBe(200);
  });
  await test.step('7 RESET ตีกลับ 000025 → 8', async () => {
    await reset();
    await loginStaff(page, 'off.reg2');
    await page.goto(`/officer/cases/${EG(25)}`);
    await page.getByTestId('return-btn').click();
    await page.getByTestId('return-reason').fill('xxxxxxxxxx');
    await page.getByTestId('return-submit').click();
    await expect(page.getByTestId('case-status'), 'ขั้น 7 case-status').toHaveText('รอแก้ไขเอกสาร');
    await page.goto('/officer/queue');
    await expect(wl, 'ขั้น 7 workload-count').toHaveText('8');
  });
  await test.step('8 claim 000028 และ 000029', async () => {
    await claimRow(EG(28)).click();
    await expect(wl, 'ขั้น 8 หลัง 000028').toHaveText('9');
    await claimRow(EG(29)).click();
    await expect(wl, 'ขั้น 8 หลัง 000029').toHaveText('10');
  });
  await test.step('9 สมหญิงส่งแก้ → 11', async () => {
    const pS = await newCtxPage(browser);
    await loginCitizen(pS, ID.somying);
    await pS.goto(`/citizen/cases/${EG(25)}`);
    await pS.getByTestId('submit-fix-btn').click();
    await expect(pS.getByTestId('case-status'), 'ขั้น 9 case-status').toHaveText('กำลังตรวจสอบ');
    expect((await getCase(page, EG(25))).owner, 'ขั้น 9 owner').toBe('off.reg2');
    await page.goto('/officer/queue');
    await expect(wl, 'ขั้น 9 workload-count').toHaveText('11');
  });
  await test.step('10 claim 000030 → WORKLOAD_LIMIT', async () => {
    await claimRow(EG(30)).click();
    await expect(page.getByTestId('action-error'), 'ขั้น 10 action-error').toHaveText('รับงานได้สูงสุด 10 เรื่อง');
    const r = await claim(page, EG(30));
    expect([r.status, r.json?.code], 'ขั้น 10 API').toEqual([409, 'WORKLOAD_LIMIT']);
    expect(r.json?.message, 'ขั้น 10 message').toBe('รับงานได้สูงสุด 10 เรื่อง');
    await expect(wl, 'ขั้น 10 workload-count').toHaveText('11');
  });
});

// ───────────────────────── SLA ─────────────────────────
test('TC-SLA-01 กำหนดเสร็จตามตารางวันที่', async ({ page }) => {
  test.setTimeout(240_000);
  type Row = { c: string; service: 'SV-01' | 'SV-02' | 'SV-03'; at: string; iso: string; text: string };
  const rows: Row[] = [
    { c: 'a', service: 'SV-01', at: '2026-12-01T09:00:00+07:00', iso: '2026-12-04T16:30:00+07:00', text: '4 ธ.ค. 2569 16:30' },
    { c: 'b', service: 'SV-01', at: '2026-12-01T16:29:00+07:00', iso: '2026-12-04T16:30:00+07:00', text: '4 ธ.ค. 2569 16:30' },
    { c: 'c', service: 'SV-01', at: '2026-12-01T16:30:00+07:00', iso: '2026-12-08T16:30:00+07:00', text: '8 ธ.ค. 2569 16:30' },
    { c: 'd', service: 'SV-01', at: '2026-12-04T10:00:00+07:00', iso: '2026-12-11T16:30:00+07:00', text: '11 ธ.ค. 2569 16:30' },
    { c: 'e', service: 'SV-01', at: '2026-12-05T10:00:00+07:00', iso: '2026-12-14T16:30:00+07:00', text: '14 ธ.ค. 2569 16:30' },
    { c: 'f', service: 'SV-02', at: '2026-12-01T09:00:00+07:00', iso: '2026-12-17T16:30:00+07:00', text: '17 ธ.ค. 2569 16:30' },
    { c: 'g', service: 'SV-03', at: '2026-12-01T09:00:00+07:00', iso: '2026-12-24T16:30:00+07:00', text: '24 ธ.ค. 2569 16:30' },
    { c: 'h', service: 'SV-01', at: '2026-12-29T10:00:00+07:00', iso: '2027-01-05T16:30:00+07:00', text: '5 ม.ค. 2570 16:30' },
    { c: 'i', service: 'SV-01', at: '2026-12-31T23:59:00+07:00', iso: '2027-01-07T16:30:00+07:00', text: '7 ม.ค. 2570 16:30' },
  ];
  for (const r of rows) {
    await test.step(`แถว ${r.c}`, async () => {
      const lbl = `TC-SLA-01 แถว ${r.c} (${r.service} ชำระ ${r.at})`;
      await reset();
      await loginCitizen(page, ID.somchai);
      const n = await newPaid({ t: page, service: r.service, at: r.at });
      expect(n.caseNo, `${lbl} caseNo`).toBe('EG-2569-000031');
      const c = await getCase(page, 'EG-2569-000031');
      expect(c.dueAt, `${lbl} dueAt`).toBe(r.iso);
      await page.goto('/citizen/cases/EG-2569-000031');
      await expect(page.getByTestId('sla-due'), `${lbl} sla-due data-iso`).toHaveAttribute('data-iso', r.iso);
      await expect(page.getByTestId('sla-due'), `${lbl} sla-due ข้อความ`).toHaveText(r.text);
    });
  }
});

test('TC-SLA-02 หยุดนับ SLA ระหว่างรอแก้ไข', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const T0 = '2026-12-01T09:00:00+07:00';
  const NO = 'EG-2569-000031';
  const staffReturn = async (staff: Target, caseNo: string) => {
    const c = await claim(staff, caseNo);
    expect(c.status, `claim ${caseNo}`).toBe(200);
    const r = await api(staff, 'POST', `/api/officer/cases/${caseNo}/return`, { reason: 'xxxxxxxxxx' });
    expect(r.status, `return ${caseNo}`).toBe(200);
  };

  await test.step('ส่วน 1 หยุดนับ 1 วันทำการ', async () => {
    await reset();
    await loginCitizen(page, ID.somchai);
    const n = await newPaid({ t: page, service: 'SV-01', at: T0 });
    expect(n.caseNo, 'ส่วน 1 caseNo').toBe(NO);
    expect((await getCase(page, NO)).dueAt, 'ส่วน 1 dueAt เริ่ม').toBe('2026-12-04T16:30:00+07:00');
    await setClock('2026-12-02T11:00:00+07:00');
    const staff = await newStaffApi('off.reg1');
    await staffReturn(staff, NO);
    await page.goto(`/citizen/cases/${NO}`);
    await expect(page.getByTestId('case-status'), 'ส่วน 1 case-status').toHaveText('รอแก้ไขเอกสาร');
    await expect(page.getByTestId('sla-level'), 'ส่วน 1 sla-level').toHaveText('หยุดนับ');
    await expect(page.getByTestId('sla-level'), 'ส่วน 1 data-level').toHaveAttribute('data-level', 'paused');
    await expect(page.getByTestId('fix-deadline'), 'ส่วน 1 fix-deadline').toHaveAttribute('data-iso', '2026-12-09T11:00:00+07:00');
    await setClock('2026-12-03T10:00:00+07:00');
    await page.getByTestId('submit-fix-btn').click();
    await expect(page.getByTestId('case-status'), 'ส่วน 1 หลังส่งแก้').toHaveText('กำลังตรวจสอบ');
    await expect(page.getByTestId('sla-due'), 'ส่วน 1 sla-due data-iso').toHaveAttribute('data-iso', '2026-12-08T16:30:00+07:00');
    await expect(page.getByTestId('sla-due'), 'ส่วน 1 sla-due ข้อความ').toHaveText('8 ธ.ค. 2569 16:30');
    await expect(page.getByTestId('sla-level'), 'ส่วน 1 sla-level หลังส่งแก้').toHaveText('ปกติ');
    expect((await getCase(page, NO)).dueAt, 'ส่วน 1 dueAt API').toBe('2026-12-08T16:30:00+07:00');
    const pO = await newCtxPage(browser);
    await loginStaff(pO, 'off.reg1');
    await pO.goto(`/officer/cases/${NO}`);
    await expect(pO.getByTestId('case-owner'), 'ส่วน 1 case-owner').toHaveText('off.reg1');
  });

  await test.step('ส่วน 2 seed 000017 ส่งแก้ 1 ธ.ค. 09:00', async () => {
    await reset();
    await loginCitizen(page, ID.somchai);
    await page.goto(`/citizen/cases/${EG(17)}`);
    await expect(page.getByTestId('sla-level'), 'ส่วน 2 ก่อนส่ง sla-level').toHaveText('หยุดนับ');
    await expect(page.getByTestId('sla-due'), 'ส่วน 2 ก่อนส่ง sla-due').toHaveAttribute('data-iso', '2026-11-27T16:30:00+07:00');
    await page.getByTestId('submit-fix-btn').click();
    await expect(page.getByTestId('case-status'), 'ส่วน 2 case-status').toHaveText('กำลังตรวจสอบ');
    await expect(page.getByTestId('sla-due'), 'ส่วน 2 sla-due').toHaveAttribute('data-iso', '2026-12-01T16:30:00+07:00');
    await expect(page.getByTestId('sla-level'), 'ส่วน 2 sla-level').toHaveText('ใกล้ครบกำหนด');
    expect((await getCase(page, EG(17))).dueAt, 'ส่วน 2 dueAt API').toBe('2026-12-01T16:30:00+07:00');
    const staff = await newStaffApi('off.reg1');
    expect((await getCase(staff, EG(17))).owner, 'ส่วน 2 owner').toBe('off.reg1');
  });

  await test.step('ส่วน 3 ส่งแก้ 4 ธ.ค. 10:00', async () => {
    await reset();
    await setClock('2026-12-04T10:00:00+07:00');
    await loginCitizen(page, ID.somchai);
    const r = await api(page, 'POST', `/api/cases/${EG(17)}/resubmit`);
    expect(r.status, 'ส่วน 3 resubmit status').toBe(200);
    expect((await getCase(page, EG(17))).dueAt, 'ส่วน 3 dueAt').toBe('2026-12-04T16:30:00+07:00');
    await page.goto(`/citizen/cases/${EG(17)}`);
    await expect(page.getByTestId('sla-level'), 'ส่วน 3 sla-level').toHaveText('ใกล้ครบกำหนด');
  });

  await test.step('ส่วน 4 ตีกลับและส่งแก้วันเดียวกัน', async () => {
    await reset();
    await loginCitizen(page, ID.somchai);
    const n = await newPaid({ t: page, service: 'SV-01', at: T0 });
    expect(n.caseNo, 'ส่วน 4 caseNo').toBe(NO);
    expect((await getCase(page, NO)).dueAt, 'ส่วน 4 dueAt เริ่ม').toBe('2026-12-04T16:30:00+07:00');
    await setClock('2026-12-02T09:00:00+07:00');
    const staff = await newStaffApi('off.reg1');
    await staffReturn(staff, NO);
    await setClock('2026-12-02T15:00:00+07:00');
    const r = await api(page, 'POST', `/api/cases/${NO}/resubmit`);
    expect(r.status, 'ส่วน 4 resubmit status').toBe(200);
    expect((await getCase(page, NO)).dueAt, 'ส่วน 4 dueAt').toBe('2026-12-04T16:30:00+07:00');
  });

  await test.step('ส่วน 5 คร่อมสุดสัปดาห์/วันหยุด ส่งแก้หลัง 16:30', async () => {
    await reset();
    await loginCitizen(page, ID.somchai);
    const n = await newPaid({ t: page, service: 'SV-01', at: T0 });
    expect(n.caseNo, 'ส่วน 5 caseNo').toBe(NO);
    expect((await getCase(page, NO)).dueAt, 'ส่วน 5 dueAt เริ่ม').toBe('2026-12-04T16:30:00+07:00');
    await setClock('2026-12-04T10:00:00+07:00');
    const staff = await newStaffApi('off.reg1');
    await staffReturn(staff, NO);
    await setClock('2026-12-08T17:00:00+07:00');
    const r = await api(page, 'POST', `/api/cases/${NO}/resubmit`);
    expect(r.status, 'ส่วน 5 resubmit status').toBe(200);
    const c = await getCase(page, NO);
    expect(c.dueAt, 'ส่วน 5 dueAt').toBe('2026-12-08T16:30:00+07:00');
    expect(c.slaLevel, 'ส่วน 5 slaLevel API').toBe('overdue');
    await page.goto(`/citizen/cases/${NO}`);
    await expect(page.getByTestId('sla-level'), 'ส่วน 5 sla-level').toHaveText('เกินกำหนด');
  });
});

test('TC-SLA-03 ระดับเตือน ปกติ/ใกล้/เกิน', async ({ page }) => {
  test.setTimeout(240_000);
  const levelText: Record<string, string> = { normal: 'ปกติ', near: 'ใกล้ครบกำหนด', overdue: 'เกินกำหนด', paused: 'หยุดนับ', closed: 'ปิดแล้ว' };

  await test.step('ส่วน A คำขอใหม่', async () => {
    await reset();
    await loginCitizen(page, ID.somchai);
    const n = await newPaid({ t: page, service: 'SV-01', at: '2026-12-01T09:00:00+07:00' });
    expect(n.caseNo, 'ส่วน A caseNo').toBe('EG-2569-000031');
    const rows: Array<[string, string]> = [
      ['2026-12-01T09:00:00+07:00', 'normal'], ['2026-12-02T09:00:00+07:00', 'normal'], ['2026-12-03T09:00:00+07:00', 'near'],
      ['2026-12-04T16:30:00+07:00', 'near'], ['2026-12-04T16:30:01+07:00', 'overdue'], ['2026-12-04T16:31:00+07:00', 'overdue'],
      ['2026-12-05T10:00:00+07:00', 'overdue'],
    ];
    for (const [clock, lv] of rows) {
      await setClock(clock);
      await page.goto('/citizen/cases/EG-2569-000031');
      await expect(page.getByTestId('sla-level'), `ส่วน A ${clock}`).toHaveText(levelText[lv]);
      await expect(page.getByTestId('sla-level'), `ส่วน A ${clock} data-level`).toHaveAttribute('data-level', lv);
      expect((await getCase(page, 'EG-2569-000031')).slaLevel, `ส่วน A ${clock} slaLevel API`).toBe(lv);
    }
  });

  await test.step('ส่วน B seed 000016', async () => {
    await reset();
    await loginStaff(page, 'off.reg2');
    const rows: Array<[string, string]> = [
      ['2026-12-03T09:00:00+07:00', 'normal'], ['2026-12-04T09:00:00+07:00', 'near'],
      ['2026-12-08T16:30:00+07:00', 'near'], ['2026-12-08T16:31:00+07:00', 'overdue'],
    ];
    for (const [clock, lv] of rows) {
      await setClock(clock);
      await page.goto(`/officer/cases/${EG(16)}`);
      await expect(page.getByTestId('sla-level'), `ส่วน B ${clock}`).toHaveText(levelText[lv]);
      await expect(page.getByTestId('sla-level'), `ส่วน B ${clock} data-level`).toHaveAttribute('data-level', lv);
      expect((await getCase(page, EG(16))).slaLevel, `ส่วน B ${clock} slaLevel API`).toBe(lv);
    }
  });

  await test.step('ส่วน C seed ที่ 09:00', async () => {
    await reset();
    await loginStaff(page, 'off.reg1');
    await page.goto('/officer/queue');
    const expected: Array<[number, string]> = [[20, 'เกินกำหนด'], [22, 'ใกล้ครบกำหนด'], [24, 'ใกล้ครบกำหนด'], [25, 'ปกติ']];
    for (const [n, text] of expected) {
      await expect(rowBy(page, 'queue-row', 'data-case-no', EG(n)).getByTestId('row-sla-level'), `ส่วน C ${EG(n)}`).toHaveText(text);
    }
    await logout(page);
    await loginCitizen(page, ID.somchai);
    await page.goto(`/citizen/cases/${EG(17)}`);
    await expect(page.getByTestId('sla-level'), 'ส่วน C 000017').toHaveText('หยุดนับ');
    await logout(page);
    await loginCitizen(page, ID.somying);
    await page.goto(`/citizen/cases/${EG(1)}`);
    await expect(page.getByTestId('sla-level'), 'ส่วน C 000001').toHaveText('ปิดแล้ว');
    await logout(page);
    await loginStaff(page, 'off.reg1');
    await setClock('2026-12-01T16:30:00+07:00');
    await page.goto('/officer/queue');
    await expect(rowBy(page, 'queue-row', 'data-case-no', EG(22)).getByTestId('row-sla-level'), 'ส่วน C 000022 @16:30:00').toHaveText('ใกล้ครบกำหนด');
    await setClock('2026-12-01T16:31:00+07:00');
    await page.goto('/officer/queue');
    await expect(rowBy(page, 'queue-row', 'data-case-no', EG(22)).getByTestId('row-sla-level'), 'ส่วน C 000022 @16:31:00').toHaveText('เกินกำหนด');
  });
});

// ───────────────────────── NOTI ─────────────────────────
/** TC-NOTI-01 ทั้งหมด (ใช้ซ้ำในส่วน A ของ NOTI-02) */
async function noti01Flow(page: Page): Promise<void> {
  await reset();
  await loginStaff(page, 'off.reg1'); // request แรกที่ 09:00
  const expect9 = {
    'off.reg1': { items: [[24, 'near'], [22, 'near'], [20, 'overdue']] as Array<[number, string]>, bell: '3' },
    'off.reg2': { items: [[24, 'near']] as Array<[number, string]>, bell: '1' },
    'head1': { items: [[20, 'overdue']] as Array<[number, string]>, bell: '1' },
    'off.works1': { items: [] as Array<[number, string]>, bell: '0' },
  };
  for (const [user, e] of Object.entries(expect9)) {
    await loginStaff(page, user);
    const ui = await notiUi(page);
    expect(ui.pairs, `NOTI-01 ${user} รายการบนจอ`).toEqual(pairs(e.items));
    expect(ui.bell, `NOTI-01 ${user} bell-count`).toBe(e.bell);
    expect(await notiApi(page), `NOTI-01 ${user} API`).toEqual(pairs(e.items));
    if (e.items.length === 0) await expect(page.getByTestId('noti-empty'), `NOTI-01 ${user} noti-empty`).toHaveText('ไม่มีแจ้งเตือน');
    for (const [n, l] of e.items) {
      const want = l === 'near' ? `คำขอ ${EG(n)} ใกล้ครบกำหนด` : `คำขอ ${EG(n)} เกินกำหนด`;
      expect(ui.texts.some((t) => t.includes(want)), `NOTI-01 ${user} ข้อความ "${want}" (จริง: ${ui.texts.join(' | ')})`).toBe(true);
    }
  }
  await setClock('2026-12-01T16:31:00+07:00');
  await loginStaff(page, 'off.reg1'); // request ใด ๆ
  const after = {
    'off.reg1': { items: [[24, 'near'], [22, 'near'], [20, 'overdue'], [22, 'overdue']] as Array<[number, string]>, bell: '4' },
    'head1': { items: [[20, 'overdue'], [22, 'overdue']] as Array<[number, string]>, bell: '2' },
    'off.reg2': { items: [[24, 'near']] as Array<[number, string]>, bell: '1' },
  };
  for (const [user, e] of Object.entries(after)) {
    await loginStaff(page, user);
    const ui = await notiUi(page);
    expect(ui.pairs, `NOTI-01 ต่อ ${user} รายการบนจอ`).toEqual(pairs(e.items));
    expect(ui.bell, `NOTI-01 ต่อ ${user} bell-count`).toBe(e.bell);
    expect(await notiApi(page), `NOTI-01 ต่อ ${user} API`).toEqual(pairs(e.items));
  }
}

test('TC-NOTI-01 ผู้รับแจ้งเตือนตามระดับ', async ({ page }) => {
  await noti01Flow(page);
});

test('TC-NOTI-02 ไม่แจ้งซ้ำ ข้ามระดับ และขั้นรออนุมัติ/รอออกเอกสาร', async ({ page }) => {
  test.setTimeout(240_000);

  await test.step('ส่วน A ไม่แจ้งซ้ำ', async () => {
    await noti01Flow(page);
    for (const [user, items, bell] of [
      ['off.reg1', [[24, 'near'], [22, 'near'], [20, 'overdue'], [22, 'overdue']], '4'],
      ['head1', [[20, 'overdue'], [22, 'overdue']], '2'],
    ] as Array<[string, Array<[number, string]>, string]>) {
      await loginStaff(page, user);
      for (let i = 0; i < 3; i++) {
        const ui = await notiUi(page);
        expect(ui.pairs, `ส่วน A ${user} เปิด /notifications ครั้งที่ ${i + 1}`).toEqual(pairs(items));
        expect(await notiApi(page), `ส่วน A ${user} API ครั้งที่ ${i + 1}`).toEqual(pairs(items));
      }
      for (let i = 0; i < 2; i++) {
        await page.goto(user === 'head1' ? '/head/approvals' : '/officer/queue');
        await expect(page.getByTestId('bell-count'), `ส่วน A ${user} bell-count หลังเปิดหน้า ${i + 1}`).toHaveText(bell);
      }
      const ui = await notiUi(page);
      expect(ui.bell, `ส่วน A ${user} bell-count สุดท้าย`).toBe(bell);
    }
  });

  await test.step('ส่วน B ข้ามระดับ (ส. 5 ธ.ค. 10:00)', async () => {
    await reset();
    await setClock('2026-12-05T10:00:00+07:00');
    const od = (ns: number[]): Array<[number, string]> => ns.map((n) => [n, 'overdue']);
    const exp: Record<string, { items: Array<[number, string]>; bell: string }> = {
      'off.reg1': { items: od([20, 22, 23, 24, 28, 29, 30]), bell: '7' },
      'off.reg2': { items: [...od([13, 15, 24, 25, 26, 27, 28, 29, 30]), [16, 'near']], bell: '10' },
      'off.works1': { items: od([10]), bell: '1' },
      'head1': { items: [...od([10, 13, 14, 15, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30]), [11, 'near']], bell: '15' },
    };
    for (const user of ['off.reg1', 'off.reg2', 'off.works1', 'head1']) await loginStaff(page, user);
    for (const [user, e] of Object.entries(exp)) {
      await loginStaff(page, user);
      const ui = await notiUi(page);
      expect(ui.pairs, `ส่วน B ${user} รายการบนจอ`).toEqual(pairs(e.items));
      expect(ui.bell, `ส่วน B ${user} bell-count`).toBe(e.bell);
      expect(await notiApi(page), `ส่วน B ${user} API`).toEqual(pairs(e.items));
    }
  });

  await test.step('ส่วน C ขั้นรออนุมัติและรอออกเอกสาร', async () => {
    const levelsOf = async (user: string, no: number, label: string, expected: string[]) => {
      await loginStaff(page, user);
      const ui = await notiUi(page);
      const ui1 = ui.pairs.filter((p) => p.startsWith(EG(no) + ':')).map((p) => p.split(':')[1]);
      expect(ui1, `${label} ${user} ${EG(no)} บนจอ`).toEqual(expected);
      const a = (await notiApi(page)).filter((p) => p.startsWith(EG(no) + ':')).map((p) => p.split(':')[1]);
      expect(a, `${label} ${user} ${EG(no)} API`).toEqual(expected);
    };
    await reset();
    await setClock('2026-12-04T09:00:00+07:00');
    await levelsOf('head1', 14, 'C เริ่ม', ['near']);
    await levelsOf('off.reg1', 14, 'C เริ่ม', []);
    await levelsOf('off.reg2', 14, 'C เริ่ม', []);

    await setClock('2026-12-04T16:31:00+07:00');
    await levelsOf('head1', 14, 'C 1', ['near', 'overdue']);
    await levelsOf('off.reg1', 14, 'C 1', []);
    await levelsOf('off.reg2', 14, 'C 1', []);

    await setClock('2026-12-08T09:00:00+07:00');
    await levelsOf('off.reg1', 19, 'C 2', ['near']);
    await levelsOf('off.reg2', 19, 'C 2', []);
    await levelsOf('head1', 19, 'C 2', []);

    await setClock('2026-12-09T16:31:00+07:00');
    await levelsOf('off.reg1', 19, 'C 3', ['near', 'overdue']);
    await levelsOf('head1', 19, 'C 3', ['overdue']);
    await levelsOf('off.reg2', 19, 'C 3', []);
  });
});
