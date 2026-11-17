import * as fs from 'fs';
import * as path from 'path';

// สร้างไฟล์ทดสอบอัปโหลดตาม TEST-DATA ข้อ 11 (พอร์ตจาก make_testfiles.py ไบต์ต่อไบต์)
const DIR = path.resolve(__dirname, 'testfiles');

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u32(n: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; }
function u16(n: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; }

function pdf(n: number): Buffer {
  const head = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n', 'latin1');
  const tail = Buffer.from('\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');
  const pad = n - head.length - tail.length;
  if (pad < 0) throw new Error('pdf pad < 0');
  return Buffer.concat([head, Buffer.alloc(pad, 0x20), tail]);
}
function chunk(t: string, d: Buffer): Buffer {
  const tb = Buffer.from(t, 'latin1');
  return Buffer.concat([u32(d.length), tb, d, u32(crc32(Buffer.concat([tb, d])))]);
}
function png(n: number): Buffer {
  const ihdr = Buffer.concat([u32(1), u32(1), Buffer.from([8, 2, 0, 0, 0])]);
  const zlib = require('zlib') as typeof import('zlib');
  const idat = zlib.deflateSync(Buffer.from([0, 255, 0, 0]));
  const base = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  const pad = n - base.length - 12;
  if (pad < 2) throw new Error('png pad < 2');
  const text = Buffer.concat([Buffer.from('k\0', 'latin1'), Buffer.alloc(pad - 2, 0x78)]);
  return Buffer.concat([base.subarray(0, base.length - 12), chunk('tEXt', text), base.subarray(base.length - 12)]);
}
function jpg(n: number): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const pad = n - soi.length - app0.length - 2 - 4;
  return Buffer.concat([soi, app0, Buffer.from([0xff, 0xfe]), u16(pad + 2), Buffer.alloc(pad, 0x78), Buffer.from([0xff, 0xd9])]);
}

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(DIR, { recursive: true });
  const w = (name: string, data: Buffer) => fs.writeFileSync(path.join(DIR, name), data);
  for (const n of ['ok-id.pdf', 'id-card.pdf', 'map.pdf', 'plan.pdf', 'deed.pdf', ...[1, 2, 3, 4, 5, 6].map((i) => `multi-${i}.pdf`)]) w(n, pdf(1024));
  w('real.jpg', jpg(1024)); w('real.png', png(1024)); w('plan-as-jpg.jpg', jpg(1024));
  for (const n of [5242879, 5242880, 5242881]) w(`size-${n}.pdf`, pdf(n));
  w('fake-text.pdf', Buffer.from('hello')); w('fake-text.jpg', Buffer.from('hello')); w('notes.txt', Buffer.from('hello'));
  w('exe-as.png', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(1022, 0)]));

  // ตรวจขนาด
  const expected: Record<string, number> = { 'size-5242879.pdf': 5242879, 'size-5242880.pdf': 5242880, 'size-5242881.pdf': 5242881 };
  for (const f of fs.readdirSync(DIR)) {
    const size = fs.statSync(path.join(DIR, f)).size;
    const want = expected[f] ?? (['fake-text.pdf', 'fake-text.jpg', 'notes.txt'].includes(f) ? 5 : 1024);
    if (size !== want) throw new Error(`testfiles/${f}: ขนาด ${size} ไม่ตรง ${want}`);
  }
}
