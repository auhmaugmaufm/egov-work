# T · สเปก Playwright (T1 ชุด A 22 TC · T2 ชุด B 29 TC)

> อ่าน: ไฟล์นี้ + `/workspace/egov-brief/TEST-PLAN.md` (เฉพาะ TC ของชุดตัวเอง) + `CONTRACT.md` + `TEST-DATA.md` · **ห้ามอ่าน `src/`** · ผลที่คาดหวังลอกจากการ์ด TC ตรงตัว **ห้ามเอาค่าจากหน้าจอมาเป็นคำตอบ**
> ไฟล์นี้บอก (1) โครงไฟล์/คอนฟิก (2) helper ที่ต้องมีพร้อม signature (3) กติกาเขียน test (4) วิธีใช้งานหน้าจอของเว็บนี้ (ที่การ์ดไม่ได้บอก) (5) ข้อควรระวังราย TC

## 1. ไฟล์และเจ้าของ (ห้ามแตะไฟล์อื่น)

| ไฟล์ | เจ้าของ | |
|---|---|---|
| `app/playwright.config.ts` | T1 | ข้อ 3 |
| `app/tests/e2e/tsconfig.json` | T1 | ข้อ 3.2 |
| `app/tests/e2e/global-setup.ts` | T1 | สร้างไฟล์ทดสอบ (ข้อ 6) |
| `app/tests/e2e/helpers.ts` | T1 | ข้อ 4 (T2 **ห้ามแก้**) |
| `app/tests/e2e/part-a.spec.ts` | T1 | 22 TC ชุด A |
| `app/tests/e2e/helpers-b.ts` | T2 | helper เพิ่มของชุด B (ถ้าต้องการ) |
| `app/tests/e2e/part-b.spec.ts` | T2 | 29 TC ชุด B |

dependency (อยู่ใน `package.json` ของ B01 แล้ว): `@playwright/test` `@axe-core/playwright` `pdf-parse` `exceljs` `typescript` `@types/node` · ติดตั้งเบราว์เซอร์: `npx playwright install chromium`

## 2. รายชื่อ TC (ชื่อ test = รหัส + ชื่อ ตรงตัวตามนี้)

### ชุด A (T1 · `part-a.spec.ts` · 22 TC)

| # | ชื่อ test | บั๊กที่ต้องจับ |
|---|---|---|
| 1 | `TC-AUTH-01 เลขบัตร 13 หลัก + checksum` | – |
| 2 | `TC-AUTH-02 OTP ผิด 3 ครั้งล็อก 15 นาที` | – |
| 3 | `TC-AUTH-03 ลงทะเบียนครั้งแรก` | – |
| 4 | `TC-AUTH-04 เจ้าหน้าที่ SSO จำลองและหน้าตั้งต้นตามบทบาท` | – |
| 5 | `TC-FEE-01 ค่าธรรมเนียม SV-01/SV-02/SV-03` | B01 |
| 6 | `TC-SUBMIT-01 ยื่นคำขอ SV-01 ครบวงจร` | – |
| 7 | `TC-SUBMIT-02 เอกสารบังคับครบก่อนชำระ` | – |
| 8 | `TC-SUBMIT-03 ร่าง การลบร่าง และการยกเลิก` | – |
| 9 | `TC-UPLOAD-01 ขนาดและจำนวนไฟล์` | B02 |
| 10 | `TC-UPLOAD-02 ชนิดไฟล์จากเนื้อไฟล์` | – |
| 11 | `TC-PAY-01 อายุ QR 15:00` | B05 |
| 12 | `TC-PAY-02 ยอดเงินและ callback ซ้ำ` | – |
| 13 | `TC-PAY-03 ชำระพร้อมกัน เลขไม่ซ้ำ` | – |
| 14 | `TC-PAY-04 เลขคำขอข้ามปี 2569 → 2570` | – |
| 15 | `TC-QUEUE-01 ลำดับคิวและขอบเขตแผนก` | – |
| 16 | `TC-QUEUE-02 รับเรื่องซ้อน (พร้อมกันและต่อกัน)` | B08 |
| 17 | `TC-QUEUE-03 งานในมือสูงสุด 10` | – |
| 18 | `TC-SLA-01 กำหนดเสร็จตามตารางวันที่` | B03 |
| 19 | `TC-SLA-02 หยุดนับ SLA ระหว่างรอแก้ไข` | B03 B04 |
| 20 | `TC-SLA-03 ระดับเตือน ปกติ/ใกล้/เกิน` | (B03 อาจล้ม) |
| 21 | `TC-NOTI-01 ผู้รับแจ้งเตือนตามระดับ` | – |
| 22 | `TC-NOTI-02 ไม่แจ้งซ้ำ ข้ามระดับ และขั้นรออนุมัติ/รอออกเอกสาร` | – |

### ชุด B (T2 · `part-b.spec.ts` · 29 TC)

| # | ชื่อ test | บั๊กที่ต้องจับ |
|---|---|---|
| 1 | `TC-WORKFLOW-01 SV-01 อนุมัติ + ออกเอกสาร` | (B07 อาจล้ม) |
| 2 | `TC-WORKFLOW-02 SV-02 ผ่านหัวหน้า` | – |
| 3 | `TC-WORKFLOW-03 SV-03 สามขั้นตอน` | – |
| 4 | `TC-WORKFLOW-04 ตีกลับสูงสุด 2 ครั้ง และผลหลังครบ` | B12 |
| 5 | `TC-WORKFLOW-05 เหตุผล ≥ 10 ตัวอักษร (ตีกลับ/ไม่อนุมัติ)` | – |
| 6 | `TC-WORKFLOW-06 เวลาแก้ไข 168 ชั่วโมง` | – |
| 7 | `TC-DOC-01 ออกเอกสารและข้อมูลใน PDF` | – |
| 8 | `TC-DOC-02 ตรวจเอกสาร /verify` | – |
| 9 | `TC-DOC-03 เอกสารหมดอายุและลายเซ็นไม่ตรง` | – |
| 10 | `TC-PDPA-01 ปิดบังเลขบัตรบนจอ` | – |
| 11 | `TC-PDPA-02 API (JSON) ไม่ส่งเลขบัตรเต็ม` | B09 |
| 12 | `TC-PDPA-03 แสดงเลขเต็มต้องมีเหตุผลและ Audit` | B11 |
| 13 | `TC-DASH-01 Dashboard ตัวเลขเริ่มต้น` | (B10 อาจล้ม) |
| 14 | `TC-DASH-02 Dashboard ย้อนหลัง พ.ย. ต.ค. รายปี` | B10 |
| 15 | `TC-DASH-03 ส่งออก Excel/PDF เท่าหน้าจอ และไม่มีข้อมูลส่วนบุคคล` | (B10 อาจล้ม) |
| 16 | `TC-DASH-04 ค่าขอบ "ทันกำหนด" 16:29:59 / 16:30:00 / 16:30:01` | – |
| 17 | `TC-AUDIT-01 เหตุการณ์และฟิลด์ใน Audit` | B11 |
| 18 | `TC-AUDIT-02 Audit แก้/ลบไม่ได้ (405)` | – |
| 19 | `TC-AUDIT-03 กรองช่วงวันที่ตามเวลาไทย` | – |
| 20 | `TC-RBAC-01 ประชาชนเปิดคำขอคนอื่นไม่ได้ (IDOR)` | B06 |
| 21 | `TC-RBAC-02 เจ้าหน้าที่อนุมัติ SV-02 ไม่ได้ (API)` | B07 |
| 22 | `TC-RBAC-03 ตารางสิทธิ์หน้า/API ตามบทบาท` | – |
| 23 | `TC-RBAC-04 ผู้ดูแลระบบ: บริการ วันหยุด ผู้ใช้ และยอดที่ล็อก` | (B03 อาจล้ม) |
| 24 | `TC-RBAC-05 สิทธิ์เปิด/ดาวน์โหลดไฟล์แนบ` | – |
| 25 | `TC-RBAC-06 ผู้ดูแลระบบ: ช่วงค่าที่ยอมรับ` | – |
| 26 | `TC-NFR-01 Responsive 375/768/1280` | – |
| 27 | `TC-NFR-02 WCAG: axe + คีย์บอร์ด + label + สถานะไม่ใช้สีอย่างเดียว` | – |
| 28 | `TC-NFR-03 Health เวลาโหลด และผลซ้ำได้` | – |
| 29 | `TC-NFR-04 เข้ารหัสข้อมูลส่วนบุคคลที่เก็บ (inspection)` | – |

รวม 22 + 29 = **51** · ห้ามรวม TC สองข้อใน test เดียว · ห้ามแตก TC เดียวเป็นหลาย test (ใช้ `test.step('ส่วน A …', …)` แทน)

## 3. คอนฟิก

### 3.1 `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['part-a.spec.ts', 'part-b.spec.ts'],
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false, workers: 1, retries: 0,
  timeout: 180_000, expect: { timeout: 7_000 },
  reporter: [['list'], ['json', { outputFile: 'test-report/results.json' }], ['html', { outputFolder: 'test-report/html', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on', video: { mode: 'on', size: { width: 1280, height: 800 } }, screenshot: 'only-on-failure',
    acceptDownloads: true, locale: 'th-TH', timezoneId: 'Asia/Bangkok',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
});
```
(video ทุก test ไว้ให้ Z1 แปลงเป็น GIF ของ TC ระดับ P1 · trace ไว้ดูตอนล้ม)

### 3.2 `tests/e2e/tsconfig.json`
`{"compilerOptions":{"target":"ES2022","module":"commonjs","moduleResolution":"node","strict":true,"esModuleInterop":true,"skipLibCheck":true,"noEmit":true,"types":["node"]},"include":["./**/*.ts","../../playwright.config.ts"]}` · `pdf-parse` ไม่มี type → `const pdfParse: (b: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js');`

### 3.3 คำสั่ง
```bash
TEST_MODE=1 docker compose up -d --build          # เว็บ (Z1 เป็นคนรัน)
npx playwright test --list                        # T1: 22 รายการ · T2: +29 = 51
npx tsc -p tests/e2e --noEmit                     # 0 error
BASE_URL=http://localhost:3000 DB_PATH=./data/app.db npx playwright test --reporter=list
```

## 4. `tests/e2e/helpers.ts` (T1 เขียน · signature ตรงตัว · T2 import ใช้)

```ts
import { APIRequestContext, Page, request as pwRequest, expect } from '@playwright/test';
export const BASE_URL: string;              // process.env.BASE_URL ?? 'http://localhost:3000'
export const DB_PATH: string;               // process.env.DB_PATH ?? path.resolve(__dirname, '../../data/app.db')
export const TESTFILES: string;             // path.resolve(__dirname, 'testfiles')
export const PASS = 'Test@1234';
export const ID = { somchai: '1101700123456', somying: '3100600987659', mana: '5500400111221', piti: '1909900555015', bad: '1101700123457' } as const;
export type Target = Page | APIRequestContext;
export interface ApiResult { status: number; json: any; text: string; headers: Record<string, string>; body: Buffer; }

export function file(name: string): string;                                   // path.join(TESTFILES, name)
export async function newApi(): Promise<APIRequestContext>;                   // pwRequest.newContext({ baseURL: BASE_URL }) · cookie jar ใหม่
export async function api(t: Target, method: string, path: string, body?: unknown,
                          opts?: { multipart?: Record<string, any>; headers?: Record<string, string> }): Promise<ApiResult>;
        // Page → ใช้ page.request (cookie เดียวกับเบราว์เซอร์) · ไม่ throw เมื่อ status ≥ 400 (failOnStatusCode:false) · json = null ถ้า parse ไม่ได้
export async function reset(): Promise<void>;                                 // POST /api/test/reset ผ่าน context ชั่วคราว · expect 200 และ now = '2026-12-01T09:00:00+07:00'
export async function setClock(iso: string): Promise<void>;                   // PUT /api/test/clock · expect 200 และ now === iso
export async function getClock(): Promise<string>;
export async function loginCitizen(t: Target, idNo: string, otp?: string): Promise<{ registered: boolean }>;
        // POST /api/auth/thaid/start + /verify (OTP '123456') · expect 200 ทั้งคู่
export async function loginStaff(t: Target, username: string, password?: string): Promise<{ role: string; dept: string | null; landing: string }>;
export async function logout(t: Target): Promise<void>;                       // POST /api/auth/logout
export async function createDraft(t: Target, body: { serviceId: string; qty?: number; areaSqm?: number }): Promise<string>;   // คืน draftId · expect 201
export async function upload(t: Target, draftId: string, docKey: string, fileName: string,
                             opts?: { mimeType?: string }): Promise<ApiResult>;   // multipart {docKey, file:{name, mimeType, buffer}}
export async function createQr(t: Target, draftId: string): Promise<{ ref: string; amount: number; qrExpiresAt: string }>;  // expect 201
export async function pay(ref: string, amount: number | string): Promise<ApiResult>;   // POST /api/test/payments/<ref>/pay (ไม่ต้องล็อกอิน)
export async function newPaid(o: { t?: Target; idNo?: string; service: 'SV-01' | 'SV-02' | 'SV-03'; at?: string; qty?: number; areaSqm?: number })
        : Promise<{ caseNo: string; ref: string; draftId: string; t: Target }>;
        // สูตร NEW_PAID ของ TEST-PLAN: at → setClock · ไม่มี t → newApi()+loginCitizen(idNo ?? somchai) · createDraft (SV-01 qty ?? 1 · SV-03 areaSqm ?? 100)
        // → upload ไฟล์บังคับ (SV-01 id-card.pdf · SV-02 + map.pdf · SV-03 id-card.pdf plan.pdf deed.pdf) → createQr → pay(ref, amount) → GET /api/payments/<ref> → caseNo
export async function getCase(t: Target, caseNo: string): Promise<any>;       // GET /api/cases/<caseNo> · expect 200 → json
export async function tabUntil(page: Page, testid: string, max?: number): Promise<void>;
        // กด Tab ทีละครั้ง (สูงสุด max=80) จน document.activeElement มี data-testid === testid · ไม่เจอ → throw พร้อมบอก testid
export async function pdfText(buf: Buffer): Promise<string>;                  // (await pdfParse(buf)).text + '\n' + buf.toString('latin1')
export function deepHasKey(obj: unknown, key: string): boolean;               // ค้นทุกชั้น
export async function readXlsx(buf: Buffer): Promise<string[][]>;             // exceljs → ชีตแรก → [[A,B],…] ด้วย cell.text
export function rowBy(page: Page, testid: string, attr: string, value: string);   // page.locator(`[data-testid="${testid}"][${attr}="${value}"]`)
```
- ทุก helper ที่ยิง API ใช้ `expect(res.status, '<ชื่อ helper> <path>').toBe(…)` ให้ข้อความล้มบอกค่าที่คาด/ค่าจริง
- `newApi()` ทุกตัวต้อง `dispose()` ท้าย test (เก็บใน array แล้ว dispose ใน `test.afterEach`)

## 5. กติกาการเขียน test (ทั้ง T1 และ T2)

| # | กติกา |
|---|---|
| 1 | ชื่อ test ขึ้นต้นรหัส TC ตามข้อ 2 ตรงตัว · 1 TC = 1 `test()` · ส่วนย่อยใช้ `test.step` |
| 2 | **บรรทัดแรกของทุก TC = `await reset()`** · ทุกครั้งที่การ์ดเขียน RESET กลาง TC ให้ `reset()` ซ้ำ แล้ว **ล็อกอินใหม่ทุกบัญชี** (cookie เก่าใช้ไม่ได้ · สร้าง `newApi()` ใหม่หรือเรียก `loginCitizen/loginStaff` ซ้ำบน page เดิม) |
| 3 | ค่าคาดหวัง = ค่าบนการ์ด TC (ตัวเลข/ข้อความ/ISO ตรงตัว) · ข้อความไทยและ `–` (U+2013) `→` (U+2192) `·` (U+00B7) พิมพ์ตรงตัวในซอร์ส |
| 4 | ทุก assert มีป้ายบอกตำแหน่ง: `await expect(page.getByTestId('fee-total'), 'TC-FEE-01 SV-03 area=101').toHaveText('฿1,010')` · `expect(r.status, 'claim 000029 by off.reg2').toBe(409)` → เวลาล้ม Playwright พิมพ์ Expected/Received ให้เอง · ห้าม assert แบบ `toBeTruthy()` กับค่าที่การ์ดกำหนดตัวเลข |
| 5 | **สิทธิ์ตรวจด้วยการยิง API ตรงเสมอ** (เช่น `POST /api/cases/…/approve` ต้องได้ 403) นอกเหนือจากดูว่าปุ่มไม่มี (`toHaveCount(0)`) |
| 6 | "ปุ่มต้องไม่มี" = `toHaveCount(0)` · "ใช้ไม่ได้" = `toBeDisabled()` · "ไม่แสดง" = `toHaveCount(0)` (เว็บนี้ไม่ render องค์ประกอบที่ไม่เข้าเงื่อนไข) |
| 7 | ห้าม `page.waitForTimeout` เพื่อรอผล · ใช้ `expect(...).toHaveText` (auto-retry) หรือ `expect.poll(async () => …)` |
| 8 | ห้ามใช้ `/api/test/login-as` (มีไว้ตรวจบล็อกเท่านั้น · ไม่บันทึก `STAFF_LOGIN`) · test hook ที่ใช้ได้: `reset` `clock` `payments/<ref>/pay` `documents/<docNo>/tamper` |
| 9 | ห้ามอ่านโค้ดเว็บ · ห้ามแก้ค่าคาดหวังให้ตรงจอ · ถ้าการ์ดกับ CONTRACT ขัดกัน ให้ใช้การ์ดและจดใน `SPEC/QUESTIONS-T1.md` / `QUESTIONS-T2.md` |
| 10 | วันเวลาตรวจที่ `data-iso` เป็นหลัก + ข้อความไทยตามการ์ด (`4 ธ.ค. 2569 16:30`) |
| 11 | TC ห้ามพึ่งข้อมูลที่ TC ก่อนหน้าทิ้งไว้ (เลขคำขอใหม่หลัง reset = `EG-2569-000031` · ร่าง `DR-0003` · ref `PP-0002` · เอกสาร `DOC-2569-000002`) |
| 12 | หลัง `reset()` อย่าเปิดหน้า/ยิง API ปกติก่อน `setClock()` ถ้าการ์ดต้องการให้ "request แรก" เกิดที่เวลาอื่น (แจ้งเตือนประเมินตอน request แรก · `/api/test/*` ไม่นับ) |
| 13 | `test.setTimeout(240_000)` สำหรับ TC ยาว (SLA-01 NFR-01 NFR-02 RBAC-03 RBAC-05 DOC-03) |

## 6. ไฟล์ทดสอบอัปโหลด (`global-setup.ts` · TEST-DATA ข้อ 11)

- พอร์ตสคริปต์ Python ใน TEST-DATA ข้อ 11 เป็น TypeScript **ไบต์ต่อไบต์** เขียนลง `tests/e2e/testfiles/` (สร้างทุกครั้งที่รัน · `.gitignore` แล้ว)
- ไฟล์: `ok-id.pdf` `id-card.pdf` `map.pdf` `plan.pdf` `deed.pdf` `multi-1.pdf`…`multi-6.pdf` (PDF 1,024) · `real.jpg` `real.png` `plan-as-jpg.jpg` (1,024) · `size-5242879.pdf` `size-5242880.pdf` `size-5242881.pdf` · `fake-text.pdf` `fake-text.jpg` `notes.txt` (`hello` 5 ไบต์) · `exe-as.png` (`MZ` + 0 รวม 1,024)
- `pdf(n)`: `'%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n'` + ช่องว่าง + `'\ntrailer<</Root 1 0 R>>\n%%EOF\n'` ให้ยาว n · `jpg(n)`: `FF D8` + APP0 (`FF E0 00 10 'JFIF' 00 01 01 00 00 01 00 01 00 00`) + `FF FE` + ความยาว (2 ไบต์ big-endian = pad+2) + `'x'`×pad + `FF D9` (pad = n − 26) · `png(n)`: ตาม Python (signature + IHDR 1×1 + IDAT `zlib.deflateSync([0,255,0,0])` + tEXt เติมขนาด + IEND) · **ทำ CRC32 เอง** (ตาราง 256 ค่า polynomial `0xEDB88320`) เพราะ `zlib.crc32` ไม่มีใน Node 20 รุ่นต้น
- ท้าย global-setup ตรวจขนาด: `size-5242879.pdf` = 5242879 · `size-5242880.pdf` = 5242880 · `size-5242881.pdf` = 5242881 · ไฟล์ 1,024 ทุกไฟล์ = 1024 → ไม่ตรง throw
- ส่งไฟล์ปลอมพร้อม Content-Type: `setInputFiles({ name: 'fake-text.pdf', mimeType: 'application/pdf', buffer })` / API `upload(t, id, key, 'fake-text.pdf', { mimeType: 'application/pdf' })`

## 7. วิธีใช้งานหน้าจอของเว็บนี้ (สิ่งที่การ์ดไม่ได้บอก)

| งาน | วิธี |
|---|---|
| ล็อกอินประชาชนผ่านจอ | `/login` (แท็บประชาชนเปิดอยู่แล้ว) → fill `thaid-id-input` → click `thaid-submit` → รอ `otp-step` → fill `otp-input` → click `otp-submit` → `waitForURL('**/citizen')` (หรือ `/register`) · Enter ในช่องก็ส่งฟอร์มได้ · ช่อง OTP ได้ focus อัตโนมัติ |
| ล็อกอินเจ้าหน้าที่ผ่านจอ | click `login-tab-staff` → fill `staff-username` `staff-password` → click `staff-submit` → URL = landing |
| ออกจากระบบ | click `logout-btn` → `waitForURL('**/login')` |
| ล็อกอินผ่าน API แล้วใช้หน้า | `await loginStaff(page, 'off.reg1')` (ใช้ `page.request` → cookie ติดเบราว์เซอร์) แล้ว `page.goto(...)` |
| วิซาร์ดขั้น 1 | `/citizen/new/SV-0x` · fill `qty-input`/`area-input` → รอ `fee-total` เปลี่ยน (เว็บถามราคาจากเซิร์ฟเวอร์) · ค่าผิด → `fee-error` + `fee-total` = `–` + `to-upload-btn` disabled · `save-draft-btn` → `draft-id` แสดง · `to-upload-btn` → ขั้น 2 (`wizard-step` = `2/3 แนบเอกสาร`) และมี `draft-id` |
| วิซาร์ดขั้น 2 | `setInputFiles` ที่ `upload-input-<docKey>` (อัปโหลดทันที) → รอ `file-item` จำนวนที่คาด หรือ `upload-error` · `upload-input-extra` รับหลายไฟล์ (ส่งทีละไฟล์ หยุดที่ไฟล์แรกที่ผิด) · ลบไฟล์ = click `file-remove-btn` ในแถว `file-item` · `to-payment-btn` → ขั้น 3 |
| วิซาร์ดขั้น 3 | `payment-amount` · click `create-qr-btn` → `qr-ref` `qr-expires` `payment-status` (`รอชำระ`) · ชำระด้วย `pay(ref, amount)` แล้ว click `refresh-payment-btn` (หน้าก็ poll เองทุก 3 วิ) → `payment-status` = `ชำระแล้ว` + `submitted-case-no` `receipt-no` `receipt-amount` `receipt-paid-at` `go-case-btn` · หมดอายุ → `qr-expired-msg` + `regenerate-qr-btn` |
| เปิดร่างเดิม | `/citizen/new/SV-02?draft=DR-0002` (PENDING_PAYMENT เปิดที่ขั้น 3 ทันที) · `open-draft-btn` ในแถว `my-draft-row` |
| ยกเลิกคำขอ | `/citizen/cases/<no>` → click `cancel-case-btn` → เห็น `cancel-confirm-text` → click `confirm-cancel-btn` → หน้า reload |
| ส่งแก้ไข | `/citizen/cases/<no>` → (แนบ `fix-upload-input` ได้ไม่บังคับ) → click `submit-fix-btn` → reload |
| รับเรื่องในคิว | `rowBy(page,'queue-row','data-case-no','EG-2569-000028').getByTestId('claim-btn').click()` → สำเร็จหน้า reload · ไม่สำเร็จ `action-error` (ไม่ reload) |
| ตัวกรองคิว | `selectOption` ที่ `queue-filter` → หน้า navigate → `waitForURL(/filter=unclaimed/)` |
| ตีกลับ / ไม่อนุมัติ | click `return-btn` → fill `return-reason` → click `return-submit` (ผิด → `return-reason-error`) · click `reject-btn` → `reject-reason` → `reject-submit` (ผิด → `reject-reason-error`) · สำเร็จหน้า reload |
| ส่งต่อ / อนุมัติ / ออกเอกสาร | (fill `forward-note`) click `forward-btn` · click `approve-btn` · click `issue-btn` → reload |
| แสดงเลขเต็ม | click `show-full-id-btn` → fill `unmask-reason` → click `unmask-submit` → `full-id` (หรือ `unmask-error`) · ไม่ reload |
| Dashboard | `selectOption('period-select', '2026-11')` → `waitForURL(/period=2026-11/)` · แล้ว `selectOption('service-select','SV-02')` → `waitForURL(/service=SV-02/)` · หรือ `page.goto('/dashboard?period=2026-11&service=SV-02')` |
| ดาวน์โหลด | `const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-xlsx-btn').click()]); const buf = fs.readFileSync(await dl.path())` (ใช้กับ `export-pdf-btn` `audit-export-csv-btn` `download-doc-btn` `doc-download-link` เช่นกัน · หรือยิง href ผ่าน `api()` ก็ได้) |
| Audit ตัวกรอง | fill `audit-filter-actor` / `selectOption('audit-filter-event', 'UNMASK')` / fill `audit-filter-from` `audit-filter-to` (`YYYY-MM-DD`) → click `audit-apply-btn` → `waitForURL(/\/audit\?/)` · หลังส่งออก CSV ต้อง reload หน้าจึงเห็น `audit-count` ใหม่ |
| Admin บริการ | fill `svc-fee-SV-01` → click `svc-save-SV-01` → `action-success` visible (ไม่ reload) · ผิด → `action-error` |
| Admin วันหยุด/ผู้ใช้ | fill `holiday-date-input` (`2026-12-02`) + `holiday-name-input` → click `holiday-add-btn` → reload → `holiday-row` · `holiday-delete-btn` ในแถว · ผู้ใช้: `selectOption` ใน `user-role-select`/`user-dept-select` ของแถว → `user-save-btn` |
| แจ้งเตือน | `/notifications` → `noti-item` (`data-case-no` `data-level` · ข้อความตรงตัว) · `bell-count` อยู่ใน header ทุกหน้า |

## 8. ข้อควรระวังราย TC (อ่านคู่กับการ์ดใน TEST-PLAN)

### ชุด A
| TC | หมายเหตุ |
|---|---|
| AUTH-01 | ก่อนลองแต่ละค่า `page.goto('/login')` ใหม่ (otp-step ต้องไม่มี = `toHaveCount(0)`) · พิมพ์ 14 ตัวได้ (ไม่มี maxlength) · ยิง API ค่าเดียวกันด้วย |
| AUTH-02 | ขั้น 1–3 ผ่านจอ (ตรวจ `otp-error` `otp-attempts-left` `lock-message` `lock-until[data-iso]`) ขั้นอื่นใช้ API ได้ · ขั้น 9 RESET แล้วใช้ context ใหม่ · ระหว่างขั้นห้าม reset |
| AUTH-03 | `reg-name` → `toHaveValue('มานะ ตั้งใจ')` + `toHaveJSProperty('readOnly', true)` · ขั้น 8: `reset()` → `newApi()` → thaid/start+verify (ได้ `registered:false`) → `POST /api/auth/register` |
| AUTH-04 | ล็อกอินทีละบัญชีผ่านจอ ตรวจ URL + `user-name` + `user-role` (`data-role` `data-dept`) → `logout-btn` · ผิด 3 แบบ → `staff-error` เหมือนกัน · หลัง logout เปิด `/officer/queue` → URL `/login` |
| FEE-01 | ทุกค่าตรวจทั้งจอ (`fee-total` `fee-error` `to-upload-btn` disabled) และ `POST /api/drafts` (`fee` หรือ status/code) · **แถว 101 ต้องคาด `฿1,010` / `fee:1010`** (จับ B01) |
| SUBMIT-01 | ร่างใหม่ = `DR-0003` · QR `PP-0002` หมดอายุ `2026-12-01T09:15:00+07:00` · ทุกค่าตามการ์ด · คิว off.reg1 ต้องมีแถว 000031 ต่อจาก 000030 (ตรวจ index ใน `queue-row`) |
| SUBMIT-02 | ส่วน API: `createDraft(SV-03 areaSqm 100)` + upload `id-card.pdf` `deed.pdf` → `POST /api/drafts/:id/payment` = 409 `MISSING_DOCS` `missing` = `["แบบแปลน"]` → upload `plan.pdf` → 201 |
| SUBMIT-03 | ส่วน F: context สมชาย + context off.reg1 แยกกัน · `Promise.all([cancel, claim])` · ยอมรับผลได้ 2 แบบตามการ์ด แต่ห้าม 200 ทั้งคู่ · ตรวจสถานะสุดท้ายให้สอดคล้องกับฝั่งที่ชนะ |
| UPLOAD-01 | ตรวจทั้งจอและ API (สร้างร่างแยกสำหรับ API) · **5,242,880 ต้องรับ** (จับ B02) · 5,242,881 ต้อง 400 `FILE_TOO_LARGE` ไม่ใช่ 413 |
| UPLOAD-02 | หลังทุกไฟล์ที่ปฏิเสธ `GET /api/drafts/:id` → `files.length` ไม่เพิ่ม |
| PAY-01 | `PP-0001` ของ `DR-0002` (seed) · รอบ 3 (09:10:00) **ต้อง 410** (จับ B05) · รอบ 3 ส่วนจอ: เปิด `?draft=DR-0002` → `regenerate-qr-btn` → `PP-0002` หมดอายุ `09:25:00` |
| PAY-02 | สร้างร่าง+ไฟล์+QR ด้วย helper (ยังไม่จ่าย) → ref `PP-0002` · ขั้น 5 ได้ `EG-2569-000032` |
| PAY-03 | สมชายและสมหญิงคนละ `newApi()` · คนละ 3 ร่าง → QR `PP-0002`…`PP-0007` · `Promise.all` จ่ายทั้ง 6 · เทียบเป็น Set |
| PAY-04 | `setClock('2026-12-31T23:58:00+07:00')` → สร้าง+QR · `23:59:00` จ่าย · `2027-01-01T00:00:00+07:00` ร่างใหม่+QR+จ่าย → `EG-2570-000001` |
| QUEUE-01 | อ่านลำดับ `data-case-no` ของ `queue-row` ทั้งหมดแล้วเทียบ array ตรงตัว · head1 18 แถว `claim-btn` = 0 |
| QUEUE-02 | ส่วน 1: `browser.newContext()` 2 ตัว (off.reg1 / off.reg2) เปิดคิวทั้งคู่ → `Promise.all` click `claim-btn` ของ 000028 → ผู้ชนะ 1 คน ผู้แพ้เห็น `action-error` · Audit CLAIM ผ่าน `audit1` (`GET /api/audit?event=CLAIM` กรองด้วย caseNo) = 1 · ส่วน 2: API 10 ครั้งพร้อมกัน · **ส่วน 3 ต่อกัน: คนที่ 2 ต้อง 409** (จับ B08 แน่นอน) |
| QUEUE-03 | ขั้น 4 อนุมัติ 000025 ผ่านจอ · ขั้น 7 RESET แล้วล็อกอินใหม่ · ขั้น 9 สมหญิงคนละ context กด `submit-fix-btn` · `workload-count` = `11` |
| SLA-01 | วน 9 แถว: `reset()` → `newPaid({service, at})` → ตรวจ `dueAt` (API) + `sla-due` `data-iso` และข้อความบนหน้า `/citizen/cases/EG-2569-000031` · ใช้ `test.step('แถว c', …)` · ค่าคาดตามการ์ดตรงตัว (จับ B03) |
| SLA-02 | 5 ส่วน แต่ละส่วนเริ่ม `reset()` · ส่วน 2 ต้องคาด `dueAt` `2026-12-01T16:30:00+07:00` และ `ใกล้ครบกำหนด` (จับ B04) |
| SLA-03 | ส่วน A/B ตั้งนาฬิกาแล้ว `page.reload()` อ่าน `sla-level` (+ `slaLevel` ใน API) · ส่วน B ใช้ seed 000016 ผ่าน `/officer/cases/EG-2569-000016` (off.reg2) |
| NOTI-01 | `reset()` แล้ว request แรกคือ `loginStaff(off.reg1)` ที่ 09:00 · อ่านทั้ง `/notifications` และ `GET /api/notifications` ของแต่ละคน · ต่อ: `setClock(16:31)` แล้วยิง request ใดก็ได้ |
| NOTI-02 | ส่วน B: `reset()` → `setClock('2026-12-05T10:00:00+07:00')` **ก่อน** request ใด ๆ → แล้วจึงล็อกอิน · `bell-count` ตามการ์ด (7 · 10 · 1 · 15) · ส่วน C ตามลำดับเวลา |

### ชุด B
| TC | หมายเหตุ |
|---|---|
| WORKFLOW-01 | ขั้น 2 ยิง API ด้วย off.reg1 → 403 · ขั้น 5 PDF: `pdfText(buf)` มี `docNo=DOC-2569-000002 caseNo=EG-2569-000025` · `Content-Disposition` มี `DOC-2569-000002.pdf` · ขั้น 6 dashboard ผ่าน API |
| WORKFLOW-02 | ขั้น 6 ต้องยิง `POST /api/officer/cases/EG-2569-000013/issue` ด้วย off.reg1 → 403 · `/verify/<code>` เปิดใน context ใหม่ที่ไม่ล็อกอิน |
| WORKFLOW-03 | `case-step` ตรงตัว `ขั้นตอน 2/3 · ฝ่ายโยธา` · ขั้น 5 ยิง claim ด้วย off.reg1 → 403 |
| WORKFLOW-04 | ส่วน A/C ใช้ context สมชายสลับกับเจ้าหน้าที่ · **`POST …/return` ครั้งที่ 3 ต้อง 409 `RETURN_LIMIT` และ `return-btn` = 0** (จับ B12) · ส่วน C ยิง reject ด้วย off.reg2 → 403 · Audit FORWARD `detail` มี `ส่งต่อให้หัวหน้าพิจารณา` (`GET /api/audit?event=FORWARD` ด้วย audit1) |
| WORKFLOW-05 | เหตุผลใช้ ASCII (`'x'.repeat(9)` · `'x'.repeat(10)` · `' '.repeat(10)`) · ส่วน B dashboard ผ่าน API |
| WORKFLOW-06 | รอบ B: `setClock(14:00)` แล้วเปิดหน้า → `CANCELLED` · `timeline-item[data-iso="2026-12-04T14:00:00+07:00"]` count ≥ 1 · resubmit → 409 · `exec1` backlog 20 |
| DOC-01 | ทั้งหมดผ่าน API · `GET /api/verify/<code>` และหน้า `/verify/<code>` (context ไม่ล็อกอิน) · ออกซ้ำ → 409 |
| DOC-02 | context ใหม่ไม่มี cookie · `response.status()` ของ `page.goto` = 200 / 404 · ข้อความทั้งหน้า (`page.content()`) ไม่มี `ใจดี` และ `1101700123456` |
| DOC-03 | แต่ละส่วนเริ่ม `reset()` · ตั้งนาฬิกาแล้วเปิด `/verify/<code>` ใหม่ (context ไม่ล็อกอิน) · ส่วน E `setClock('2028-02-29T10:00:00+07:00')` ก่อน approve/issue · ส่วน D ใช้ `POST /api/test/documents/DOC-2569-000001/tamper` |
| PDPA-01 | `page.content()` ไม่มี `3100600987659` และ `3-1006-00987-65-9` |
| PDPA-02 | ทุก response ในรายการ: `JSON.stringify(json)` ไม่ match `/\d{13}/` และ `/\d-\d{4}-\d{5}-\d{2}-\d/` · `deepHasKey(json,'idNo') === false` · `idMasked` ตรง `/^X-XXXX-XXXXX-\d{2}-\d$/` · ทำทั้ง off.reg1 และ head1 (จับ B09 ที่ `/api/officer/queue`) |
| PDPA-03 | ขั้น 5 ล็อกอิน audit1 → `/audit` → `selectOption('audit-filter-event','UNMASK')` → `audit-apply-btn` → `audit-count` = `1` (จับ B11) |
| DASH-01 | ตรวจจอ + `GET /api/dashboard?period=2026-12&service=ALL` (`ontimePct` = `null`) · `page.innerText('body')` ไม่ match `/\d{13}/` `/0\d{9}/` และไม่มี 4 ชื่อ |
| DASH-02 | ทุกแถวตรวจทั้งจอ (`goto('/dashboard?period=…&service=…')` หรือ selectOption + waitForURL) และ API · `2026-11` ALL ต้อง `85.7%` · `2026` ALL ต้อง `87.5%` (จับ B10) |
| DASH-03 | `readXlsx(buf)` → แถว 2–6 คอลัมน์ B เท่ากับ `kpi-*` บนจอ · PDF: `pdfText` มี `kpi received=26 closed=7 ontime=85.7% backlog=21 overdue=1` · ตรวจ PII บนข้อความที่ดึงออกมา · Audit EXPORT = 3 |
| DASH-04 | ล็อกอิน off.reg1 off.reg2 exec1 ครั้งเดียวที่ `2026-12-03T16:00:00+07:00` · เปลี่ยนนาฬิกาโดย **ไม่ reset** · ตรวจ `closed-at[data-iso]` ของแต่ละใบ + `closed`/`onTime` จาก API · ไม่ assert `ontimePct` |
| AUDIT-01 | ล็อกอิน **ครั้งเดียวต่อบัญชี** ด้วย `loginStaff(newApi())` (6 บัญชี → STAFF_LOGIN 6) · audit1 ใช้ page (`loginStaff(page,'audit1')` ครั้งเดียว) · `audit-count` = 16 · CSV ผ่านปุ่ม แล้ว reload → 17 (จับ B11) |
| AUDIT-02 | `PUT/PATCH/DELETE` ทั้ง `/api/audit/<id>` และ `/api/audit` ทั้งในชื่อ admin1 และ audit1 · `DELETE /api/audit/999999` → 405 |
| AUDIT-03 | สร้าง L1–L5 ด้วย `setClock` + `loginStaff(newApi(), …)` ทีละแถว · กรองทั้ง API (`?from=&to=`) และจอ |
| RBAC-01 | หน้า 404: `page.goto` status = 404 + `not-found-msg` · API body เทียบ `{"code":"NOT_FOUND","message":"ไม่พบคำขอ"}` ตรงตัวทั้งเลขของคนอื่นและเลขไม่มีจริง (จับ B06) |
| RBAC-02 | **ยิง API ตรง** (จับ B07) · ขั้น 7 นับ APPROVE ผ่าน `GET /api/audit?event=APPROVE` |
| RBAC-03 | `reset()` ก่อนแต่ละบทบาท · หน้า: ✓ = `response.status()` 200 · 403 = status 403 + `forbidden-msg` · → = `page.url()` ลงท้าย `/login` · API: anon ใช้ `newApi()` ไม่ล็อกอิน · แถว claim ทำเป็นลำดับสุดท้าย · ส่วน D นับ `nav-*` ทุกตัว (`toHaveCount(0/1)`) |
| RBAC-04 | admin context แยกจากสมชาย · ขั้น 4 `fee-total` บนจอ · ขั้น 5 จอ `payment-amount` = `฿500` ที่ `?draft=DR-0002` · ขั้น 8 exec1 ล็อกอินใหม่ผ่าน API → `landing` = `/audit` และ `/dashboard` = 403 |
| RBAC-05 | `fileId` อ่านจาก `GET /api/cases/:caseNo/files` ของผู้ที่มีสิทธิ์ (สมหญิง/head1) แล้วใช้ยิงในชื่อคนอื่น · เนื้อไฟล์ขึ้นต้น `%PDF` · ไม่ล็อกอิน = `newApi()` เปล่า |
| RBAC-06 | ทำทั้งผ่านจอ (`action-error` ข้อความตรงตัว) และ API · Audit ADMIN_CHANGE = 5 (เว็บบันทึกเฉพาะค่าที่เปลี่ยนจริง จึงทำซ้ำค่าเดิมผ่านจอและ API ได้) |
| NFR-01 | 3 viewport × 11 หน้า: `await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)` ต้อง true (ข้อความล้มบอก viewport+หน้า) · งานหลักที่ 375 ตามการ์ด |
| NFR-02 | `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()` → `violations.filter(v => ['serious','critical'].includes(v.impact!))` ต้องว่าง (ข้อความล้มแสดง id ของ rule) · moderate/minor `test.info().annotations.push(...)` · ส่วน B ใช้ `tabUntil` + `keyboard.press` ห้าม click · focus ring: `getComputedStyle(activeElement).outlineStyle !== 'none'` หรือ `boxShadow !== 'none'` · ส่วน D ใช้ตาราง CONTRACT 4.1/4.2 map `data-status`/`data-level` → ข้อความ แล้ว `page.emulateMedia({ forcedColors: 'active' })` ตรวจซ้ำ |
| NFR-03 | health ใช้ `newApi()` ไม่มี cookie · body เทียบ `{"status":"ok"}` ด้วย `toEqual` · เวลาโหลดวัดรอบที่ 2 · S1/S2 ตามการ์ด · `PUT /api/test/clock {"now":"2026-12-01 09:00"}` → 400 `INVALID_TIME` · ส่วน "ปิด hook": ถ้ามี env `BASE_URL_NO_TEST` ให้ยิง `POST <BASE_URL_NO_TEST>/api/test/reset` → 404 ไม่งั้นบันทึก annotation `skip-part` |
| NFR-04 | หลังมานะลงทะเบียน (`0845678901`) อ่าน `fs.readFileSync(DB_PATH)` (+ `DB_PATH-wal` ถ้ามี) เป็น Buffer → `buf.indexOf(Buffer.from(v)) === -1` ทุกค่าในการ์ด (12 ค่า) · ตัวควบคุมบวก: สมชาย `GET /api/cases/EG-2569-000005` → `idNo` = `1101700123456` · `test.info().annotations` บันทึก `AES-256-GCM` |

## 9. เกณฑ์เสร็จ

| บล็อก | เกณฑ์ |
|---|---|
| T1 | `npx playwright test --list` แสดง 22 test ของ `part-a.spec.ts` ชื่อตรงข้อ 2 · `npx tsc -p tests/e2e --noEmit` ไม่มี error · global-setup สร้างไฟล์ขนาดตรง |
| T2 | `--list` แสดง 29 test ของ `part-b.spec.ts` (รวมทั้งหมด 51) · tsc ไม่มี error · ไม่แก้ `helpers.ts` |
| Z1 (ภายหลัง) | เว็บถูกต้อง 51/51 passed สองรอบติด · BUG_MODE ทีละตัวล้มตาม `SPEC/TRACE.md` ตาราง 3 |
