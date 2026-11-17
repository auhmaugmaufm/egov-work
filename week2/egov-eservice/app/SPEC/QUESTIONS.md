# QUESTIONS · จุดที่โจทย์ขัดกัน/ไม่ชัด และสิ่งที่สถาปนิกตัดสินแทน

> ทุกข้อ "ตัดสินแล้ว" และสเปก Bxx/T ใช้คำตัดสินนี้แล้ว · ช่างห้ามเปลี่ยนเอง · ถ้า TA/หน่วยงานตอบต่าง ให้แก้ที่สเปกก่อนแล้วจึงแก้โค้ด
> บล็อกช่างที่เจอจุดไม่ชัดใหม่ให้เขียนใน `SPEC/QUESTIONS-<บล็อก>.md` (ไม่แก้ไฟล์นี้)
> ประเภท: **ขัดกัน** = เอกสารสองที่บอกต่างกัน · **ไม่ชัด** = ไม่ได้ระบุ · **ส่วนขยาย** = เพิ่มนอก CONTRACT เพื่อให้สร้างได้

## ก. ขัดกันในโจทย์

| # | ที่มา | ปัญหา | ตัดสิน | กระทบ |
|---|---|---|---|---|
| Q-01 | DECISIONS ข้อ 2 · REQUIREMENTS BR-01 vs TEST-PLAN TC-AUTH-01 · DECISIONS ข้อ 17 | สูตร checksum เขียนน้ำหนัก `(13 − i), i=1..12` (= 12…1) ซึ่งทำให้เลข seed ทุกเลข **ไม่ผ่าน** · แต่การคำนวณตัวอย่างใน TC-AUTH-01 ใช้น้ำหนัก 13…2 (Σ = 148) และ DECISIONS ข้อ 17 ยืนยันว่าเลข seed ถูกทุกเลข | ใช้น้ำหนัก **13, 12, …, 2** (= `14 − i` · สูตรมาตรฐานเลขบัตรไทย) · ถือว่า `(13 − i)` ในเอกสารเป็นการนับ i จาก 0 | B02 `isValidThaiId` |
| Q-02 | DECISIONS ข้อ 18 แถว "B03 กระทบอะไร" vs BUGS.md ตาราง 2/4 | DECISIONS บอกว่าใช้ฟังก์ชันวันทำการตัวเดียวทั้งกำหนดเสร็จและวันคงเหลือ · ถ้าทำเช่นนั้น เมื่อเปิด B03 ที่ ส. 5 ธ.ค. คำขอ 000011/000016 จะเป็น `ปกติ` แทน `ใกล้ครบกำหนด` → **TC-NOTI-02 ล้ม** ซึ่ง BUGS ไม่ได้ระบุว่า "อาจล้ม" (triage จะเป็น "ล้มเกินที่คาด") | **ทำตาม DECISIONS ข้อ 18** (DECISIONS ชนะเมื่อขัดกัน · และ BUGS B03 ก็บรรยายผลต่อวันคงเหลือของ TC-SLA-03 ส่วน B): B03 กระทบ `computeDueAt` `extendDueForPause` `remainingBusinessDays` → ล้ม SLA-01 SLA-02 (+ SLA-03 RBAC-04 อาจล้ม) และ **TC-NOTI-02 ส่วน B ล้มเกินที่คาด** · Z1 บันทึกใน triage ว่าเป็นผลข้างเคียงจากกฎเดียวกัน อ้าง Q-02 (ทบทวนโดยผู้ใช้/ผู้ช่วย แทนคำตัดสินเดิมของสถาปนิก) | B02 · TRACE ตาราง 5 · Z1 triage |
| Q-03 | TEST-DATA 4.1 (P01 P02 "หัวหน้า head1" · A01 "รอออกเอกสาร โดย off.reg1") vs REQUIREMENTS A-34 (`data-owner` ว่างสำหรับ APPROVED) | คอลัมน์ "ผู้ถือเรื่อง/อยู่ที่" ของ seed บอกตำแหน่ง ไม่ใช่ผู้ถือ | PENDING_APPROVAL และ APPROVED มี `owner = NULL` · ผู้รับแจ้งเตือน/ผู้มีสิทธิ์คิดจากบทบาท (head) และคอลัมน์ `issuer` (off.reg1) · `case-owner` แสดง `ยังไม่มีผู้รับ` | B03 B07 |
| Q-04 | CONTRACT 3 (PDF ต้องมี ชื่อผู้ยื่น บริการ ผู้ลงนาม ฯลฯ เป็นไทย) vs A-63 (ตรวจเฉพาะบรรทัด ASCII) | PDF ภาษาไทยต้องฝังฟอนต์ไทย (ไม่มีใน stack ที่กำหนด) | PDF มีเฉพาะบรรทัด ASCII (`docNo=… caseNo=… verify=… validUntil=…` + service/issuedAt/signer username/verifyUrl) · ข้อมูลไทยครบอยู่ที่หน้า `/verify` · **ส่งคำถาม**: ต้องการ PDF ภาษาไทยจริงหรือไม่ (ต้องเพิ่มฟอนต์/ไลบรารี) | B08 |
| Q-05 | CONTRACT 6.2 (`/api/documents/:docNo/pdf` "คนอื่น → 404") vs กติกา RBAC ทั่วไป (บทบาทผิด → 403) | executive/auditor/admin เรียก PDF ควรได้อะไร | ตาม CONTRACT: **404** (ไม่เผยว่ามีเอกสาร) · ไม่ล็อกอิน 401 | B08 |
| Q-06 | CONTRACT 6.3 claim "ลำดับตรวจ: สิทธิ์ → ALREADY_CLAIMED → WORKLOAD_LIMIT" vs TC-SUBMIT-03 ส่วน F (claim หลังยกเลิก → `409 INVALID_STATE`) | ลำดับไม่มี INVALID_STATE | สิทธิ์ (role/แผนก) → **INVALID_STATE** → ALREADY_CLAIMED → WORKLOAD_LIMIT | B07 |
| Q-07 | CONTRACT 6.3 forward ตอบ `{"status":"PENDING_APPROVAL"}` vs `{"status":"IN_REVIEW","step":2}` | รูป response ไม่สม่ำเสมอ | ตอบ `status` + `step` เสมอ (`null` สำหรับ SV-02 · `3` สำหรับ SV-03 ขั้นหัวหน้า) — เป็น superset ของ CONTRACT | B07 |

## ข. ไม่ชัด → สถาปนิกตัดสิน

| # | ที่มา | ปัญหา | ตัดสิน | บล็อก |
|---|---|---|---|---|
| Q-08 | CONTRACT 5/6.2 `cancel` | สถานะที่ยกเลิกไม่ได้นอกจาก "มีผู้รับแล้ว" ตอบรหัสอะไร | IN_REVIEW / NEED_FIX / PENDING_APPROVAL / APPROVED (และ SUBMITTED ที่มี owner) → `409 CANNOT_CANCEL` · COMPLETED / REJECTED / CANCELLED → `409 INVALID_STATE` | B05 |
| Q-09 | CONTRACT 6.3 return | ลำดับตรวจ RETURN_LIMIT กับ REASON_TOO_SHORT | สิทธิ์ → สถานะ → **RETURN_LIMIT** → REASON_TOO_SHORT (ครบ 2 ครั้งแล้วตอบ 409 เสมอ) · T ส่งเหตุผล 10 ตัวทุกครั้งเพื่อตัดความกำกวม | B07 · T |
| Q-10 | BUGS B07 · TEST-PLAN TC-WORKFLOW-01 "อาจล้ม ถ้าถอดการตรวจสิทธิ์อนุมัติทั้งหมด" | บั๊ก B07 กว้างแค่ไหน | ข้ามเฉพาะการตรวจ "ต้องเป็น head" ของ **approve SV-02/03** · reject และ SV-01 ไม่เปลี่ยน → WORKFLOW-01 ไม่ล้ม | B07 |
| Q-11 | TEST-DATA 9.1 · A-34 | คำขอ APPROVED อยู่คิวแผนกไหน | `current_dept = 'registry'` ทุกบริการหลังอนุมัติ (ผู้ออกเอกสารเป็นเจ้าหน้าที่ทะเบียนเสมอ A-27) | B07 |
| Q-12 | A-27 · DECISIONS ข้อ 18 | SV-01 ใครเป็นผู้ออกเอกสาร | `issuer` = ผู้ถือที่กดอนุมัติ · SV-02/03 = เจ้าหน้าที่ทะเบียนที่ claim ขั้นแรก (บันทึกตอน claim) | B07 B08 |
| Q-13 | A-46 · DECISIONS ข้อ 9 | ยกเลิกอัตโนมัติแล้ว owner/เวลา/รหัส error | `cancelled_at = fix_deadline` · owner คงเดิม · `cancel_reason='FIX_EXPIRED'` · ส่งแก้หลังจากนั้น → `409 FIX_WINDOW_EXPIRED` · ไทม์ไลน์ `AUTO_CANCEL` ที่เวลาเส้นตาย | B07 |
| Q-14 | CONTRACT 6.2 resubmit "multipart ไม่บังคับ" | ไฟล์ที่แนบตอนส่งแก้เป็นเอกสารประเภทไหน · ตรวจอะไร | `doc_key='extra'` · นับรวมเพดาน 5 ไฟล์ · ตรวจขนาด/ชนิดแบบเดียวกัน (ไม่มีบั๊ก B02 ที่จุดนี้) | B07 |
| Q-15 | A-42 · BR-11 | ร่าง DRAFT แสดงราคาเก่าหรือใหม่หลัง admin แก้ | DRAFT คำนวณด้วยราคาปัจจุบันทุกครั้ง (`GET /api/drafts/:id`) · ล็อกยอดตอน DRAFT→PENDING_PAYMENT · QR ใหม่ของ PENDING_PAYMENT ใช้ยอดที่ล็อก | B05 B06 |
| Q-16 | CONTRACT 2.5 `payment-status` (PENDING/PAID/EXPIRED) | QR เก่าหลังกด "สร้าง QR ใหม่" มีสถานะอะไร | ภายในเก็บ `SUPERSEDED` · API แสดง `EXPIRED` · จ่าย ref เก่า → `410 QR_EXPIRED` | B06 |
| Q-17 | TEST-DATA ข้อ 4 (ไม่ระบุผู้อนุมัติ/ผู้ออก/เหตุผลไม่อนุมัติของคำขอประวัติ 000001–000008 และไทม์ไลน์) | seed ต้องมีค่าเหล่านี้ | เลือกค่าในสเปก B03 (SV-01 อนุมัติ `off.reg1` · SV-02/03 `head1` · ผู้ออก `off.reg1` · 000008 เหตุผล `เอกสารประกอบไม่ครบถ้วน` · ไทม์ไลน์ 47 แถว) — ไม่กระทบ TC | B03 |
| Q-18 | CONTRACT 2.11 `user-role-select` มี `citizen` | admin ตั้งบัญชีเจ้าหน้าที่เป็น citizen ได้ไหม | API ปฏิเสธ `400 INVALID_ROLE` (บัญชี staff ใช้ระบบประชาชนไม่ได้ · option ยังแสดงตาม CONTRACT) · **ส่งคำถาม Q-16 ของหน่วยงาน** | B10 |
| Q-19 | CONTRACT 6.4/6.5 + TC-AUDIT-01 (16 แถว) + TC-RBAC-06 (5 แถว) | ADMIN_CHANGE บันทึกกี่แถวเมื่อส่งหลายฟิลด์/ค่าเดิม | 1 แถวต่อฟิลด์ที่ **ค่าเปลี่ยนจริง** · ค่าเดิมไม่บันทึก (ทำให้ `PUT {"fee":25,"sla":3}` = 1 แถว และการทดสอบซ้ำทั้งจอ+API ไม่เพิ่มจำนวน) | B10 |
| Q-20 | CONTRACT 2.10 | `audit-case-no` ของเหตุการณ์ที่ไม่มีเลขคำขอ | ข้อความ `–` · `data-case-no=""` | B08 · T |
| Q-21 | CONTRACT 2.9 / A-41 | ตัวเลือกใน `period-select` | 12 เดือนย้อนหลังจากเดือนของนาฬิกา + ปีของเดือนเหล่านั้น (`YYYY`) · ค่าใน query ที่ไม่อยู่ในรายการก็เพิ่มให้ | B09 |
| Q-22 | CONTRACT 7 | ชื่อไฟล์ส่งออก Dashboard | `dashboard-<period>-<service>.xlsx/.pdf` · ชีตชื่อ `Dashboard` | B09 |
| Q-23 | CONTRACT 6.1 ("ยังไม่ลงทะเบียน → cookie เฉพาะ /register") | ทำ cookie จำกัด path หรือไม่ | ใช้ cookie `sid` เดียว แต่ session ชนิด `pending` ใช้ได้เฉพาะ `/register` และ `POST /api/auth/register` (cookie path `/register` จะทำให้ API register ไม่ได้รับ cookie) | B01 B04 |
| Q-24 | BR-01/BR-02 (ThaiD จำลอง) | เลขที่ checksum ถูกแต่ไม่อยู่ใน seed | ถือเป็นประชาชนใหม่ ชื่อ `ผู้ใช้ ThaiD (จำลอง)` → ไปลงทะเบียน | B04 |
| Q-25 | BR-02 | ตัวนับหลังล็อก | ตอนล็อกตั้ง `fail_count = 0` + `locked_until` · ครบ 15:00 ล้าง `locked_until` → ผิดครั้งถัดไปนับ 1 (เหลือ 2) | B04 |
| Q-26 | CONTRACT 2.6 / A-28 | officer แผนกอื่นเปิดหน้า/API รายละเอียดคำขอได้ไหม | ได้ (ข้อมูลปิดบังเลขบัตร) · ไฟล์แนบตาม BR-29 · ปุ่มตามสิทธิ์ · unmask ได้ทุก officer/head | B05 B07 B08 |
| Q-27 | A-44 | นับความยาวเหตุผลแบบไหน | `String(reason).trim().length >= 10` (หน่วย UTF-16 · TC ใช้ ASCII) | B02 |
| Q-28 | BUGS.md ("ทำงานเมื่อ TEST_MODE=1 เท่านั้นก็ได้") | BUG_MODE มีผลนอก TEST_MODE ไหม | มีผลเฉพาะ `TEST_MODE=1` | B01 |
| Q-29 | REQUIREMENTS NFR-05 / Q-08 | HTTPS ระหว่างส่ง | นอกขอบเขตเครื่อง local · README ระบุให้ deploy หลัง reverse proxy TLS · **ส่งคำถามหน่วยงาน** (Q-08) | B01 |
| Q-30 | README ข้อ 3.4 · CONTRACT 0.8 | ค่าเริ่มต้น TEST_MODE ใน docker compose | ไม่ตั้ง = ปิด (`TEST_MODE: ${TEST_MODE:-}`) → ต้องรัน `TEST_MODE=1 docker compose up -d --build` · ตอนเริ่มใน TEST_MODE ลบไฟล์ DB แล้ว seed ใหม่ (กัน schema/ข้อมูลเก่าค้าง) | B01 Z1 |
| Q-31 | TEST-PLAN TC-NFR-03 "ปิด hook (ถ้ารันเว็บได้สองโหมด)" | ต้องเปิดเว็บสองตัวไหม | ส่วนนี้ทำเมื่อมี env `BASE_URL_NO_TEST` เท่านั้น ไม่งั้นบันทึก annotation (Z1 ตรวจมือด้วย `TEST_MODE= docker compose up`) | T2 Z1 |

## ค. ส่วนขยายนอก CONTRACT (เพิ่มเพื่อให้สร้างได้ · ไม่ขัด CONTRACT)

| # | เพิ่มอะไร | เหตุผล | บล็อก |
|---|---|---|---|
| Q-32 | `POST /api/fee/quote` | `fee-total` ต้องอัปเดตทันทีและบั๊ก B01 ต้องอยู่ฝั่งเซิร์ฟเวอร์ (BUGS กติกาข้อ 4) → หน้าถามราคาจากเซิร์ฟเวอร์ ไม่คำนวณใน JS | B05 |
| Q-33 | `PUT /api/drafts/:id` · `DELETE /api/drafts/:id/files/:fileId` | แก้จำนวน/พื้นที่ของร่างเดิม (`?draft=DR-0001`) และปุ่ม `file-remove-btn` ต้องมี API | B05 |
| Q-34 | ฟิลด์ `paidAt` ใน `GET /api/payments/:ref` · `latestRef` ใน `GET /api/drafts/:id` | `receipt-paid-at` ต้องมีเวลาชำระ · หน้าวิซาร์ดต้องรู้ ref ล่าสุด | B05 B06 |
| Q-35 | `POST /api/test/login-as` (TEST_MODE เท่านั้น · ไม่บันทึก Audit) | บล็อก B04–B10 ทำขนานกันโดยไม่รอ B04 แต่ตารางตรวจ curl ต้องล็อกอิน · **Playwright ห้ามใช้** · Z1 อาจลบได้หลังรวมถ้า TA ไม่อนุญาต hook เพิ่ม | B01 · ทุกบล็อก |
| Q-36 | รหัส error ส่วนขยาย `INVALID_SERVICE` `INVALID_DOC_KEY` `INVALID_DATE` `INVALID_ROLE` `INVALID_DEPT` `INVALID_PERIOD` `BAD_REQUEST` `INTERNAL` | กรณีที่ CONTRACT ไม่ได้ระบุ (รูปแบบ `{code,message}` ตาม A-38) | ทุกบล็อก |
| Q-37 | session ในหน่วยความจำ (ไม่ใช่ DB) · `PRAGMA secure_delete=ON` | กันเลขบัตรของผู้กำลังลงทะเบียนค้างในไฟล์ DB (TC-NFR-04 grep ไฟล์) · restart แล้วต้องล็อกอินใหม่ | B01 |
| Q-38 | `GET /api/officer/queue` (JSON) อยู่ใน module `docs` (B08) ส่วนหน้า `/officer/queue` อยู่ `workflow` (B07) | blocks.json ให้ B08 ฝังบั๊ก B09 (API คิวส่งเลขเต็ม) แต่ห้ามบล็อกแตะไฟล์กัน → ย้าย API ไป B08 และให้ทั้งสองใช้ `rules.selectQueue` ตัวเดียวกันเพื่อให้ผลตรงกัน | B07 B08 |
| Q-39 | DAG: B04–B10 รอแค่ B02 แต่ตารางตรวจต้องใช้ seed (B03) | ทุกตารางตรวจระบุให้รอ `src/seed.js` ก่อน (poll ทุก 60 วิ สูงสุด 30 นาที) · แถวที่ต้องใช้ API ของบล็อกอื่นระบุไว้ในวงเล็บ | ทุกบล็อก |

## ง. คำถามที่ควรส่ง TA/หน่วยงาน (นอกเหนือ Q-xx เดิมใน REQUIREMENTS)

1. Q-01: ยืนยันสูตร checksum (น้ำหนัก 13…2) และแก้ข้อความ `(13 − i)` ใน DECISIONS/REQUIREMENTS
2. Q-02: B03 ควรกระทบ "วันคงเหลือ" หรือไม่ (ถ้าใช่ต้องเพิ่ม TC-NOTI-02 ในคอลัมน์ "อาจล้มด้วย" ของ BUGS)
3. Q-04: PDF เอกสารต้องเป็นภาษาไทยหรือไม่ (ต้องเพิ่มฟอนต์ไทย)
4. Q-18: admin เปลี่ยนบัญชีเจ้าหน้าที่เป็น citizen ได้หรือไม่
5. Q-35: อนุญาต test hook เพิ่ม (`/api/test/login-as`) ใน TEST_MODE หรือไม่
