คุณคือสถาปนิกซอฟต์แวร์ของโปรเจกต์ egov-eservice งานของคุณคือ "เขียนสเปก" เท่านั้น ห้ามเขียนโค้ดของระบบจริง

## บริบท
- ชุดโจทย์อยู่ที่ /workspace/egov-brief (README · USER-STORIES · REQUIREMENTS · CONTRACT · TEST-DATA · TEST-PLAN · BUGS · DECISIONS · brief/BRIEF.md) อ่านให้ครบทุกไฟล์ DECISIONS.md ชนะเมื่อขัดกัน
- แผนงานอยู่ที่ /workspace/plans/egov-eservice/blocks.json อ่านให้ครบ (13 บล็อก: B01–B10 เว็บ · T1 T2 Playwright · Z1 รวม)
- บล็อกช่างจะถูกทำโดยโมเดลราคาถูก (sonnet/medium และ haiku/low) ที่ **อ่านเฉพาะไฟล์สเปกของบล็อกตัวเอง** ไม่อ่านโจทย์ทั้งชุด ดังนั้นสเปกต้องครบในตัวเองจนช่างไม่ต้องตัดสินใจออกแบบเอง
- stack บังคับ: Node.js 20 + Express + better-sqlite3 + หน้า HTML render ฝั่งเซิร์ฟเวอร์ (template string ธรรมดา ไม่ใช้ framework ฝั่ง client) + docker compose service เดียว · Playwright (TypeScript) อยู่ใน tests/e2e

## ผลที่ต้องเขียน (ทั้งหมดอยู่ใน /workspace/plans/egov-eservice/app/SPEC/)
1. `00-OVERVIEW.md` — โครงโฟลเดอร์ทั้งหมด · ใครเขียนไฟล์ไหน (ไม่มีไฟล์ชนกัน) · interface ของ module (`src/modules/<ชื่อ>/routes.js` export function(app, ctx)) · ctx มีอะไร (db, clock, bug(code), audit(), auth middleware, render layout, rules) · schema DB เต็ม (CREATE TABLE ทุกตาราง ทุกคอลัมน์ · คอลัมน์เลขบัตรเก็บแบบเข้ารหัส AES-256-GCM) · ชุดสถานะคำขอ · รูปแบบ session/cookie · กติกาเวลา (อ่านจาก clock เท่านั้น เขตเวลา +07:00)
2. `B01.md` … `B10.md` — ไฟล์ละบล็อก แต่ละไฟล์ต้องมี:
   - ไฟล์ที่ต้องสร้าง (path เต็ม) และห้ามแตะไฟล์อื่น
   - route หน้า + API ทุกตัวของบล็อก: method · path · สิทธิ์ · request · response JSON ตรงตัว · status code ทุกกรณี
   - `data-testid` ทุกตัวที่หน้าในบล็อกต้องมี (ลอกจาก CONTRACT ข้อ 2 ตรงตัว) และค่าที่ต้องแสดง
   - ข้อความ error ทุกข้อความที่เกี่ยวข้อง **ลอกตรงตัวอักษร** จาก CONTRACT ข้อ 5
   - กฎตัวเลข + ค่าขอบทุกค่า (จาก DECISIONS/REQUIREMENTS) เป็นตาราง input → output
   - จุดฝัง BUG_MODE ของบล็อกนี้ (จาก BUGS.md) พร้อมตัวอย่างโค้ด 1–5 บรรทัด `if (ctx.bug('B05')) ...` ต้องอยู่ฝั่งเซิร์ฟเวอร์ และกระทบเฉพาะจุด
   - Audit event ที่บล็อกนี้ต้องบันทึก (ชื่อ event · ฟิลด์)
   - **ตารางตรวจเสร็จ**: คำสั่ง curl ที่รันได้จริงหลัง reset + ผลที่ต้องได้ (อย่างน้อย 5 แถวต่อบล็อก ครอบค่าขอบ)
   - B02: signature ของทุกฟังก์ชันใน src/core/rules.js + ตารางค่าขอบสำหรับ unit test (SLA ทุกแถวใน TEST-PLAN TC-SLA-01/02 และ TC-DASH-04)
   - B03: ข้อมูล seed ทั้งหมดลอกจาก TEST-DATA เป็น JSON/ตาราง พร้อมค่าที่ต้องนับได้หลัง reset
   - B09: ตัวเลข KPI ทุกค่าที่ต้องได้หลัง reset และสูตร
3. `T.md` — สำหรับ T1/T2: รายชื่อ TC ชุด A (AUTH FEE SUBMIT UPLOAD PAY QUEUE SLA NOTI) และชุด B (WORKFLOW DOC PDPA DASH AUDIT RBAC NFR) · โครง playwright.config.ts (baseURL, workers=1, retries=0, video/trace สำหรับ GIF) · helpers.ts ที่ต้องมี (reset, setClock, loginCitizen, loginStaff, api) พร้อม signature · กติกา: ชื่อ test ขึ้นต้นรหัส TC · reset ต้นทุก TC แล้วล็อกอินใหม่ · assert ค่าตามการ์ดตรงตัว ข้อความ assert ต้องบอกค่าคาดหวัง/ค่าจริง · ตรวจสิทธิ์ด้วยการยิง API ตรงไม่ใช่แค่ดูปุ่ม · ไฟล์ทดสอบอัปโหลดสร้างอย่างไร (TEST-DATA ข้อ 11)
4. `TRACE.md` — ตาราง FR/BR ทุกข้อ → บล็อกที่ทำ · TC ทุกตัว (51) → บล็อกที่ทำให้ผ่าน · BUG B01–B12 → บล็อก + ไฟล์ที่ฝัง ต้องไม่มีข้อตกหล่น
5. `QUESTIONS.md` — จุดที่โจทย์ขัดกันหรือไม่ชัด และสิ่งที่คุณตัดสินใจแทน (อ้างไฟล์ + หัวข้อ)

## กติกา
- เขียนภาษาไทยได้ แต่ชื่อ testid · path · ข้อความ error · ค่าตัวเลข ต้องลอกตรงตัวจากโจทย์
- ห้ามแก้ไฟล์ใน /workspace/egov-brief และ blocks.json
- ห้ามเขียนอะไรนอก /workspace/plans/egov-eservice/app/SPEC/
- ก่อนจบ ตรวจ TRACE.md ว่าครบ 51 TC และ 12 บั๊ก
- จบแล้วตอบสั้น: รายชื่อไฟล์ + จำนวนบรรทัด · จำนวนคำถามใน QUESTIONS.md · จุดเสี่ยง 3 ข้อที่ช่างอาจทำพลาด
