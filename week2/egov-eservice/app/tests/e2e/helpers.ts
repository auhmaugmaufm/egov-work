import * as path from 'path';
import { APIRequestContext, Page, request as pwRequest, expect } from '@playwright/test';

export const BASE_URL: string = process.env.BASE_URL ?? 'http://localhost:3000';
export const DB_PATH: string = process.env.DB_PATH ?? path.resolve(__dirname, '../../data/app.db');
export const TESTFILES: string = path.resolve(__dirname, 'testfiles');
export const PASS = 'Test@1234';
export const ID = { somchai: '1101700123456', somying: '3100600987659', mana: '5500400111221', piti: '1909900555015', bad: '1101700123457' } as const;
export type Target = Page | APIRequestContext;
export interface ApiResult { status: number; json: any; text: string; headers: Record<string, string>; body: Buffer; }

// pdf-parse ไม่มี type
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (b: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js');

export function file(name: string): string { return path.join(TESTFILES, name); }

const apis: APIRequestContext[] = [];
export async function newApi(): Promise<APIRequestContext> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  apis.push(c);
  return c;
}
/** เรียกใน test.afterEach */
export async function disposeApis(): Promise<void> {
  for (const c of apis.splice(0)) await c.dispose().catch(() => undefined);
}

function reqOf(t: Target): APIRequestContext {
  return typeof (t as Page).goto === 'function' ? (t as Page).request : (t as APIRequestContext);
}

export async function api(t: Target, method: string, p: string, body?: unknown,
  opts?: { multipart?: Record<string, any>; headers?: Record<string, string> }): Promise<ApiResult> {
  const r = reqOf(t);
  const o: any = { method, failOnStatusCode: false, headers: opts?.headers };
  if (opts?.multipart) o.multipart = opts.multipart;
  else if (body !== undefined) o.data = body;
  const res = await r.fetch(p, o);
  const buf = await res.body();
  const text = buf.toString('utf8');
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status(), json, text, headers: res.headers(), body: buf };
}

export async function reset(): Promise<void> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  try {
    const res = await c.post('/api/test/reset', { failOnStatusCode: false });
    expect(res.status(), 'reset POST /api/test/reset').toBe(200);
    const j = await res.json();
    expect(j.now, 'reset now').toBe('2026-12-01T09:00:00+07:00');
  } finally { await c.dispose(); }
}

export async function setClock(iso: string): Promise<void> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  try {
    const res = await c.put('/api/test/clock', { data: { now: iso }, failOnStatusCode: false });
    expect(res.status(), `setClock PUT /api/test/clock ${iso}`).toBe(200);
    expect((await res.json()).now, `setClock now ${iso}`).toBe(iso);
  } finally { await c.dispose(); }
}

export async function getClock(): Promise<string> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  try {
    const res = await c.get('/api/test/clock', { failOnStatusCode: false });
    expect(res.status(), 'getClock GET /api/test/clock').toBe(200);
    return (await res.json()).now as string;
  } finally { await c.dispose(); }
}

export async function loginCitizen(t: Target, idNo: string, otp = '123456'): Promise<{ registered: boolean }> {
  const s = await api(t, 'POST', '/api/auth/thaid/start', { idNo });
  expect(s.status, `loginCitizen ${idNo} /api/auth/thaid/start`).toBe(200);
  const v = await api(t, 'POST', '/api/auth/thaid/verify', { idNo, otp });
  expect(v.status, `loginCitizen ${idNo} /api/auth/thaid/verify`).toBe(200);
  return { registered: v.json.registered as boolean };
}

export async function loginStaff(t: Target, username: string, password = PASS): Promise<{ role: string; dept: string | null; landing: string }> {
  const r = await api(t, 'POST', '/api/auth/staff/login', { username, password });
  expect(r.status, `loginStaff ${username} /api/auth/staff/login`).toBe(200);
  return r.json;
}

export async function logout(t: Target): Promise<void> {
  const r = await api(t, 'POST', '/api/auth/logout');
  expect(r.status, 'logout /api/auth/logout').toBe(204);
}

export async function createDraft(t: Target, body: { serviceId: string; qty?: number; areaSqm?: number }): Promise<string> {
  const r = await api(t, 'POST', '/api/drafts', body);
  expect(r.status, `createDraft ${JSON.stringify(body)} /api/drafts`).toBe(201);
  return r.json.draftId as string;
}

function mimeOf(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'text/plain';
}

export async function upload(t: Target, draftId: string, docKey: string, fileName: string, opts?: { mimeType?: string }): Promise<ApiResult> {
  const fs = require('fs') as typeof import('fs');
  const buffer = fs.readFileSync(file(fileName));
  return api(t, 'POST', `/api/drafts/${draftId}/files`, undefined, {
    multipart: { docKey, file: { name: fileName, mimeType: opts?.mimeType ?? mimeOf(fileName), buffer } },
  });
}

export async function createQr(t: Target, draftId: string): Promise<{ ref: string; amount: number; qrExpiresAt: string }> {
  const r = await api(t, 'POST', `/api/drafts/${draftId}/payment`);
  expect(r.status, `createQr /api/drafts/${draftId}/payment`).toBe(201);
  return { ref: r.json.ref, amount: r.json.amount, qrExpiresAt: r.json.qrExpiresAt };
}

export async function pay(ref: string, amount: number | string): Promise<ApiResult> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  try {
    const res = await c.post(`/api/test/payments/${ref}/pay`, { data: { amount }, failOnStatusCode: false });
    const buf = await res.body();
    const text = buf.toString('utf8');
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: res.status(), json, text, headers: res.headers(), body: buf };
  } finally { await c.dispose(); }
}

export async function newPaid(o: { t?: Target; idNo?: string; service: 'SV-01' | 'SV-02' | 'SV-03'; at?: string; qty?: number; areaSqm?: number })
  : Promise<{ caseNo: string; ref: string; draftId: string; t: Target }> {
  if (o.at) await setClock(o.at);
  let t = o.t;
  if (!t) { t = await newApi(); await loginCitizen(t, o.idNo ?? ID.somchai); }
  const body: { serviceId: string; qty?: number; areaSqm?: number } = { serviceId: o.service };
  if (o.service === 'SV-01') body.qty = o.qty ?? 1;
  if (o.service === 'SV-03') body.areaSqm = o.areaSqm ?? 100;
  const draftId = await createDraft(t, body);
  const docs: Array<[string, string]> =
    o.service === 'SV-01' ? [['id-card', 'id-card.pdf']]
    : o.service === 'SV-02' ? [['id-card', 'id-card.pdf'], ['map', 'map.pdf']]
    : [['id-card', 'id-card.pdf'], ['plan', 'plan.pdf'], ['deed', 'deed.pdf']];
  for (const [key, name] of docs) {
    const u = await upload(t, draftId, key, name);
    expect(u.status, `newPaid upload ${key} ${name}`).toBe(201);
  }
  const qr = await createQr(t, draftId);
  const p = await pay(qr.ref, qr.amount);
  expect(p.status, `newPaid pay ${qr.ref}`).toBe(200);
  const g = await api(t, 'GET', `/api/payments/${qr.ref}`);
  expect(g.status, `newPaid GET /api/payments/${qr.ref}`).toBe(200);
  return { caseNo: g.json.caseNo as string, ref: qr.ref, draftId, t };
}

export async function getCase(t: Target, caseNo: string): Promise<any> {
  const r = await api(t, 'GET', `/api/cases/${caseNo}`);
  expect(r.status, `getCase /api/cases/${caseNo}`).toBe(200);
  return r.json;
}

export async function tabUntil(page: Page, testid: string, max = 80): Promise<void> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((id) => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') === id, testid);
    if (hit) return;
  }
  throw new Error(`tabUntil: กด Tab ${max} ครั้งแล้วไม่พบ focus ที่ data-testid="${testid}"`);
}

export async function pdfText(buf: Buffer): Promise<string> {
  return (await pdfParse(new Uint8Array(buf) as any)).text + '\n' + buf.toString('latin1');
}

export function deepHasKey(obj: unknown, key: string): boolean {
  if (obj === null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some((v) => deepHasKey(v, key));
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === key) return true;
    if (deepHasKey(v, key)) return true;
  }
  return false;
}

export async function readXlsx(buf: Buffer): Promise<string[][]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row: any) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell: any) => { cells.push(cell.text); });
    rows.push(cells);
  });
  return rows;
}

export function rowBy(page: Page, testid: string, attr: string, value: string) {
  return page.locator(`[data-testid="${testid}"][${attr}="${value}"]`);
}
