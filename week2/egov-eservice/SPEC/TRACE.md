# TRACE · ตารางตรวจย้อนกลับ (FR · BR · NFR · TC 51 · BUG 12 · testid · error)

> ใช้ตรวจว่าทุกข้อของโจทย์มีบล็อกรับผิดชอบ · "บล็อกหลัก" = บล็อกที่ต้องเขียนตรรกะ · "ร่วม" = บล็อกที่ต้องทำส่วนหนึ่ง (หน้า/ข้อมูล/ฟังก์ชัน) ให้ข้อนั้นผ่าน · T1/T2 = ผู้เขียน test · Z1 รวมทุกข้อ

## 1. FR → บล็อก (29 ข้อ)

| FR | ความต้องการ (ย่อ) | บล็อกหลัก | ร่วม | TC |
|---|---|---|---|---|
| FR-01 | ล็อกอิน ThaiD จำลอง + ออกจากระบบ | B04 | B02 (`isValidThaiId`) · B01 (session, header logout) | AUTH-01 AUTH-02 |
| FR-02 | ลงทะเบียนครั้งแรก + PDPA | B04 | B01 (pending session) · B05 (`citizen-welcome`) | AUTH-03 |
| FR-03 | เจ้าหน้าที่ SSO จำลอง + RBAC หน้า | B04 | B01 (`requirePage`/`requireApi` · nav) · ทุกบล็อกหน้า | AUTH-04 RBAC-03 |
| FR-04 | แคตตาล็อก 3 บริการ + ค่าธรรมเนียมทันที | B05 | B02 (`calcFee`) | FEE-01 |
| FR-05 | แนบไฟล์ ตรวจ magic bytes ขนาด จำนวน | B05 | B02 (`detectFileType` `MAX_*`) · B01 (`multipartSingle`) | UPLOAD-01 UPLOAD-02 |
| FR-06 | เอกสารบังคับครบก่อนชำระ + บอกชื่อที่ขาด | B05 | B06 (409 `MISSING_DOCS`) · B02 (`missingDocs`) | SUBMIT-02 |
| FR-07 | บันทึกร่าง/กลับมาทำต่อ (ร่างไม่มีเลข) | B05 | B03 (DR-0001/0002) | SUBMIT-03 |
| FR-08 | ชำระ QR จำลอง ออกเลขคำขอ + ใบเสร็จ | B06 | B05 (หน้าขั้น 3) · B02 (`fmt*` `beYear`) | SUBMIT-01 PAY-01..04 |
| FR-09 | ประชาชนดูรายการ สถานะ ไทม์ไลน์ กำหนดเสร็จ ระดับ | B05 | B02 (`slaLevel` views) | SUBMIT-01 SLA-03 RBAC-01 |
| FR-10 | ยกเลิก SUBMITTED ไม่มีผู้รับ · confirm · ลบร่าง · ชนกับรับเรื่อง | B05 | B07 (claim 409) · B06 (ref 404 หลังลบ) | SUBMIT-03 |
| FR-11 | ส่งแก้ภายใน 168 ชม. ไม่งั้นยกเลิกเอง | B07 (resubmit + hook) | B05 (ปุ่ม `submit-fix-btn`) · B02 (`fixDeadline` `extendDueForPause`) | WORKFLOW-06 SLA-02 QUEUE-03 |
| FR-12 | คิวแยกแผนก เรียงกำหนดเสร็จ กรองได้ | B07 (หน้า) | B08 (`GET /api/officer/queue`) · B02 (`selectQueue`) | QUEUE-01 |
| FR-13 | รับเรื่องครั้งละ 1 คน · งานในมือ ≤ 10 | B07 | – | QUEUE-02 QUEUE-03 |
| FR-14 | ตีกลับพร้อมเหตุผล ≤ 2 ครั้ง | B07 | B02 (`reasonOk`) | WORKFLOW-04 WORKFLOW-05 |
| FR-15 | ส่งต่ออัตโนมัติตามเส้นทาง | B07 | – | WORKFLOW-02 WORKFLOW-03 |
| FR-16 | อนุมัติ/ไม่อนุมัติตามอำนาจ | B07 | – | WORKFLOW-01..03 05 RBAC-02 |
| FR-17 | ออกเอกสาร (เลข ลายเซ็นจำลอง รหัส QR) + PDF | B08 | B07 (ปุ่ม `issue-btn`) · B05 (`download-doc-btn`) · B01 (`pdf` `crypto.hmacDoc`) | WORKFLOW-01 DOC-01 |
| FR-18 | `/verify/<รหัส>` ไม่ต้องล็อกอิน ชื่อปิดบัง | B08 | B02 (`maskName` `docValidUntil`) · B03 (K7M2Q9XA) | DOC-02 DOC-03 |
| FR-19 | กำหนดเสร็จ + ระดับเตือนทุกที่ | B02 | B05 B07 (แสดง) · B06 (คำนวณตอนชำระ) | SLA-01..03 |
| FR-20 | แจ้งเตือนในระบบตามระดับและผู้รับ ไม่แจ้งซ้ำ | B07 (hooks.js) | B01 (`bell-count` · `onRequest`) | NOTI-01 NOTI-02 |
| FR-21 | ปิดบังเลขบัตร + แสดงเลขเต็มพร้อมเหตุผล + Audit | B08 (unmask API · queue API) | B07 (UI) · B05 (`GET /api/cases` mask) · B02 (`maskId`) | PDPA-01..03 |
| FR-22 | Dashboard KPI กรองเดือน/บริการ | B09 | B02 (`isOnTime` `pct1`) | DASH-01 DASH-02 DASH-04 |
| FR-23 | ส่งออก Excel/PDF | B09 | B01 (`pdf`) | DASH-03 |
| FR-24 | Audit ดู/กรอง/CSV อ่านอย่างเดียว | B08 | B01 (`audit` logger) | AUDIT-01..03 |
| FR-25 | ผู้ดูแลแก้ค่าธรรมเนียม/SLA (ช่วงค่า) | B10 | – | RBAC-04 RBAC-06 |
| FR-26 | ผู้ดูแลจัดการวันหยุด | B10 | B06 (ใช้ตอนชำระ) | RBAC-04 RBAC-06 |
| FR-27 | ผู้ดูแลจัดการผู้ใช้/บทบาท | B10 | B04 (มีผลตอนล็อกอินใหม่) | RBAC-04 RBAC-06 |
| FR-28 | health + test hook (reset clock pay tamper) | B01 | B06 (pay) · B08 (tamper) · B03 (seed) | NFR-03 ทุก TC |
| FR-29 | เปิด/ดาวน์โหลดไฟล์แนบตามสิทธิ์ | B05 | B02 (`canViewCaseFiles`) · B07 (`doc-item` หน้าเจ้าหน้าที่) | RBAC-05 |

## 2. BR → บล็อก (29 ข้อ)

| BR | กฎ (ย่อ) | บล็อกหลัก · ฟังก์ชัน/ไฟล์ | ร่วม | TC |
|---|---|---|---|---|
| BR-01 | เลขบัตร 13 หลัก + checksum | B02 `isValidThaiId` | B04 | AUTH-01 |
| BR-02 | OTP ผิด 3 ครั้งล็อก 15 นาที | B04 `routes.js` (otp_attempts) | B01 clock | AUTH-02 |
| BR-03 | ลงทะเบียน: เบอร์ 10 หลัก ขึ้นต้น 0 + ยินยอม | B04 | B01 crypto | AUTH-03 |
| BR-04 | SV-01 ฿20 × 1–5 ฉบับ | B02 `calcFee` | B05 | FEE-01 SUBMIT-01 RBAC-04 |
| BR-05 | SV-03 ตามพื้นที่ · SV-02 ฿500 | B02 `calcFee` (จุด B01) | B05 | FEE-01 |
| BR-06 | ชนิดไฟล์จาก magic bytes | B02 `detectFileType` | B05 `upload.js` | UPLOAD-02 SUBMIT-02 |
| BR-07 | ≤ 5,242,880 ไบต์ · ≤ 5 ไฟล์ | B05 `upload.js` (จุด B02) | B01 multipart 8 MB · body 7 MB | UPLOAD-01 |
| BR-08 | เอกสารบังคับ · แบบแปลน PDF เท่านั้น | B05 (`missing-docs` `PLAN_NOT_PDF`) | B06 (409) · B02 `missingDocs` | SUBMIT-02 |
| BR-09 | เลข EG ออกเมื่อชำระ รีเซ็ตรายปี ไม่ซ้ำ | B06 | B02 `beYear` `fmtCaseNo` · B01 `nextCounter` | SUBMIT-01 PAY-02..04 |
| BR-10 | QR < 15:00 | B06 `qrUsable` (จุด B05) | – | PAY-01 |
| BR-11 | ยอดพอดี · ล็อกยอด · idempotent · RC | B06 | B10 (แก้ราคา) | PAY-02 RBAC-04 |
| BR-12 | D0 + N วันทำการ 16:30 · คำนวณครั้งเดียว | B02 `computeDueAt` (จุด B03) | B06 | SLA-01 SUBMIT-01 RBAC-04 |
| BR-13 | หยุดนับระหว่าง NEED_FIX | B02 `extendDueForPause` (จุด B03 B04) | B07 resubmit | SLA-02 |
| BR-14 | ระดับเตือน ปกติ/ใกล้/เกิน | B02 `slaLevel` `remainingBusinessDays` | B05 B07 B08 (แสดง) | SLA-03 |
| BR-15 | ผู้รับแจ้งเตือน · 1 ครั้งต่อระดับ/คำขอ/คน | B07 `hooks.js` | B01 bell-count | NOTI-01 NOTI-02 |
| BR-16 | ลำดับคิว | B02 `selectQueue` | B07 (หน้า) · B08 (API) | QUEUE-01 WORKFLOW-02 |
| BR-17 | รับเรื่องครั้งละ 1 คน (409) | B07 claim (จุด B08) | – | QUEUE-02 |
| BR-18 | งานในมือ ≤ 10 ตรวจตอนรับเท่านั้น | B07 claim + resubmit | – | QUEUE-03 |
| BR-19 | ตีกลับ ≤ 2 · เหตุผล ≥ 10 · หลังครบ | B07 return (จุด B12) · pages.js | B02 `reasonOk` | WORKFLOW-04 WORKFLOW-05 |
| BR-20 | 168 ชม. แล้วยกเลิกอัตโนมัติ | B07 `hooks.js` + resubmit | B02 `fixDeadline` · B05 (UI) | WORKFLOW-06 |
| BR-21 | อำนาจและเส้นทาง · RBAC 401/403 | B07 approve/forward (จุด B07) | B01 middleware · B04 landing · ทุกบล็อก API | RBAC-02 RBAC-03 WORKFLOW-01..03 AUTH-04 |
| BR-22 | เห็นเฉพาะของตัวเอง · ยกเลิก · ลบร่าง | B05 `loadCaseForCitizen` (จุด B06) | B08 (PDF 404) | RBAC-01 SUBMIT-03 |
| BR-23 | อายุเอกสาร · verify 4 ผล · ปิดบังชื่อ | B08 `verifyDoc` | B02 `docValidUntil` `maskName` · B03 | DOC-01..03 |
| BR-24 | ปิดบังเลขบัตร · unmask · ผู้บริหารไม่เห็น PII | B08 (queue API จุด B09 · unmask จุด B11) | B05 (case API) · B07 (UI) · B09 (dashboard/export) · B01 (`crypto`) · B03 (เข้ารหัส seed) | PDPA-01..03 DASH-01 DASH-03 NFR-04 |
| BR-25 | KPI · ทันกำหนด (รวม 16:30:00) · `–` | B09 `computeKpi` (จุด B10) | B02 `isOnTime` `pct1` `formatPct` | DASH-01 DASH-02 DASH-04 WORKFLOW-01 |
| BR-26 | รายปีรวมยอด · ส่งออกเท่าจอ · Audit EXPORT | B09 | B01 `pdf` | DASH-02 DASH-03 |
| BR-27 | Audit 10 เหตุการณ์ · กรองเวลาไทย · CSV · 405 | B08 | B01 `audit.js` · B04 B07 B09 B10 (บันทึกเหตุการณ์) | AUDIT-01..03 PDPA-03 |
| BR-28 | ช่วงค่าที่ admin แก้ได้ · วันหยุดซ้ำ · แก้ตัวเอง | B10 | – | RBAC-06 |
| BR-29 | สิทธิ์ไฟล์แนบ | B02 `canViewCaseFiles` | B05 (API) · B07 (UI) | RBAC-05 |

## 3. NFR → บล็อก (11 ข้อ)

| NFR | เรื่อง | บล็อก | TC |
|---|---|---|---|
| NFR-01 | Responsive 375/768/1280 | B01 (CSS ใน layout) · ทุกบล็อกหน้า (ใช้ `table-wrap` ไม่ fix width) | NFR-01 |
| NFR-02 | WCAG 2.1 AA (axe serious/critical = 0) | B01 (lang, title, skip link, focus, contrast) · ทุกบล็อกหน้า (label, th scope, role, id ไม่ซ้ำ) | NFR-02 |
| NFR-03 | คีย์บอร์ดอย่างเดียว + label | B04 (ฟอร์ม login/OTP Enter, focus OTP) · B05 (วิซาร์ด focus h2) | NFR-02 |
| NFR-04 | เข้ารหัสเลขบัตร+เบอร์ at rest | B01 (`crypto` · session ในหน่วยความจำ · `secure_delete`) · B03 · B04 | NFR-04 |
| NFR-05 | HTTPS ตอน deploy | นอกขอบเขต local (QUESTIONS Q-29) · B01 README ระบุ | – |
| NFR-06 | `GET /api/health` | B01 | NFR-03 |
| NFR-07 | ผู้ใช้พร้อมกัน (รับเรื่อง · ชำระ) | B07 (claim sync tx) · B06 (pay sync tx) | QUEUE-02 PAY-03 |
| NFR-08 | หน้าโหลด ≤ 3 วินาที | ทุกบล็อกหน้า (ไม่มี asset ภายนอก) | NFR-03 |
| NFR-09 | TEST_MODE · ผลซ้ำได้ · testid | B01 (guard, reset) · B03 (seed ตายตัว) | NFR-03 |
| NFR-10 | Asia/Bangkok · รูปแบบวันที่/เงิน · ISO +07:00 | B01 `clock` · B02 format | ทุก TC |
| NFR-11 | สถานะไม่ใช้สีอย่างเดียว | B02 `views.statusBadge/levelBadge` | NFR-02 |

## 4. TC ทั้ง 51 ข้อ → บล็อกที่ทำให้ผ่าน

| # | TC | บล็อกเว็บที่ทำให้ผ่าน (หลัก → ร่วม) | test | บั๊กที่ต้องล้ม |
|---|---|---|---|---|
| 1 | TC-AUTH-01 | B04 → B02 | T1 | – |
| 2 | TC-AUTH-02 | B04 → B01 | T1 | – |
| 3 | TC-AUTH-03 | B04 → B05 B01 | T1 | – |
| 4 | TC-AUTH-04 | B04 → B01 B07 B08 B09 B10 | T1 | – |
| 5 | TC-FEE-01 | B05 → B02 | T1 | B01 |
| 6 | TC-SUBMIT-01 | B05 → B06 B02 B07 | T1 | – |
| 7 | TC-SUBMIT-02 | B05 → B06 B02 | T1 | – |
| 8 | TC-SUBMIT-03 | B05 → B06 B07 B09 | T1 | – |
| 9 | TC-UPLOAD-01 | B05 → B01 | T1 | B02 |
| 10 | TC-UPLOAD-02 | B05 → B02 | T1 | – |
| 11 | TC-PAY-01 | B06 → B05 | T1 | B05 |
| 12 | TC-PAY-02 | B06 → B05 | T1 | – |
| 13 | TC-PAY-03 | B06 → B01 | T1 | – |
| 14 | TC-PAY-04 | B06 → B02 B05 | T1 | – |
| 15 | TC-QUEUE-01 | B07 → B02 | T1 | – |
| 16 | TC-QUEUE-02 | B07 → B08 | T1 | B08 |
| 17 | TC-QUEUE-03 | B07 → B05 | T1 | – |
| 18 | TC-SLA-01 | B02 → B06 B05 | T1 | B03 |
| 19 | TC-SLA-02 | B02 → B07 B05 | T1 | B03 · B04 |
| 20 | TC-SLA-03 | B02 → B05 B07 | T1 | (B03 อาจล้ม: ส่วน B ศ.4 ธ.ค. ได้ `ปกติ`) |
| 21 | TC-NOTI-01 | B07 → B01 | T1 | – |
| 22 | TC-NOTI-02 | B07 → B01 | T1 | – |
| 23 | TC-WORKFLOW-01 | B07 → B08 B05 B09 | T2 | (B07 อาจล้ม · แบบของเราไม่ล้ม) |
| 24 | TC-WORKFLOW-02 | B07 → B08 | T2 | – |
| 25 | TC-WORKFLOW-03 | B07 → B08 | T2 | – |
| 26 | TC-WORKFLOW-04 | B07 → B05 B08 | T2 | B12 |
| 27 | TC-WORKFLOW-05 | B07 → B05 B09 | T2 | – |
| 28 | TC-WORKFLOW-06 | B07 → B05 B09 | T2 | – |
| 29 | TC-DOC-01 | B08 → B07 B05 B01 | T2 | – |
| 30 | TC-DOC-02 | B08 → B03 B02 | T2 | – |
| 31 | TC-DOC-03 | B08 → B07 B02 | T2 | – |
| 32 | TC-PDPA-01 | B07 → B05 B02 | T2 | – |
| 33 | TC-PDPA-02 | B08 → B05 B07 | T2 | B09 |
| 34 | TC-PDPA-03 | B08 → B07 | T2 | B11 |
| 35 | TC-DASH-01 | B09 → B03 | T2 | (B10 อาจล้ม) |
| 36 | TC-DASH-02 | B09 → B03 B02 | T2 | B10 |
| 37 | TC-DASH-03 | B09 → B08 B01 | T2 | (B10 อาจล้ม) |
| 38 | TC-DASH-04 | B09 → B07 B08 B02 | T2 | – |
| 39 | TC-AUDIT-01 | B08 → B04 B07 B09 B10 | T2 | B11 |
| 40 | TC-AUDIT-02 | B08 → B04 | T2 | – |
| 41 | TC-AUDIT-03 | B08 → B04 | T2 | – |
| 42 | TC-RBAC-01 | B05 → B08 | T2 | B06 |
| 43 | TC-RBAC-02 | B07 → B08 | T2 | B07 |
| 44 | TC-RBAC-03 | B01 → B04 B05 B07 B08 B09 B10 | T2 | – |
| 45 | TC-RBAC-04 | B10 → B05 B06 B04 B08 | T2 | (B03 อาจล้ม) |
| 46 | TC-RBAC-05 | B05 → B02 B07 | T2 | – |
| 47 | TC-RBAC-06 | B10 → B08 | T2 | – |
| 48 | TC-NFR-01 | B01 → ทุกบล็อกหน้า | T2 | – |
| 49 | TC-NFR-02 | B01 → ทุกบล็อกหน้า B02 | T2 | – |
| 50 | TC-NFR-03 | B01 → B03 B07 B08 B09 | T2 | – |
| 51 | TC-NFR-04 | B01 → B03 B04 | T2 | – |

จำนวน: ชุด A (T1) 22 ข้อ (#1–22) · ชุด B (T2) 29 ข้อ (#23–51) · รวม **51**

## 5. BUG_MODE B01–B12 → บล็อก + ไฟล์ที่ฝัง

| บั๊ก | บล็อก | ไฟล์ · ฟังก์ชัน | โค้ดจุดฝัง (ย่อ) | TC ที่ต้องล้ม | TC ที่อาจล้มด้วย |
|---|---|---|---|---|---|
| B01 | B02 | `src/core/rules.js` · `calcFee` | `over = bug('B01') ? a > 101 : a >= 101` | TC-FEE-01 | – |
| B02 | B05 | `src/modules/cases/upload.js` · `validateUpload` | `tooBig = ctx.bug('B02') ? size >= MAX : size > MAX` | TC-UPLOAD-01 | – |
| B03 | B02 | `src/core/rules.js` · `computeDueAt` + `extendDueForPause` + `remainingBusinessDays` | `ig = bug('B03')` ส่งเป็น `ignoreHolidays` | TC-SLA-01 · TC-SLA-02 | TC-SLA-03 (อาจล้ม) · TC-RBAC-04 (ล้ม: ขั้น 7) · **TC-NOTI-02 ส่วน B (ล้มเกินที่ BUGS ระบุ: head1 = 14 แทน 15 · อธิบายด้วย Q-02)** |
| B04 | B02 | `src/core/rules.js` · `extendDueForPause` | `if (bug('B04')) return dueAt` | TC-SLA-02 | – |
| B05 | B06 | `src/modules/payment/routes.js` · `qrUsable` | `bug('B05') ? age <= 15m : age < 15m` | TC-PAY-01 | – |
| B06 | B05 | `src/modules/cases/routes.js` · `loadCaseForCitizen` | `if (row.applicant_id !== user.id && !ctx.bug('B06')) return null` | TC-RBAC-01 | – |
| B07 | B07 | `src/modules/workflow/routes.js` · approve | `if (!sv01 && role !== 'head' && !ctx.bug('B07')) 403` | TC-RBAC-02 | TC-WORKFLOW-01 (ไม่ล้มในแบบนี้) |
| B08 | B07 | `src/modules/workflow/routes.js` · claim | `if (row.owner && !ctx.bug('B08')) 409 ALREADY_CLAIMED` | TC-QUEUE-02 | – |
| B09 | B08 | `src/modules/docs/routes.js` · `GET /api/officer/queue` | `if (ctx.bug('B09')) item.idNo = idNo` | TC-PDPA-02 | – |
| B10 | B09 | `src/modules/dashboard/routes.js` · `computeKpi` | `denom = ctx.bug('B10') ? received : closed` | TC-DASH-02 | TC-DASH-01 · TC-DASH-03 |
| B11 | B08 | `src/modules/docs/routes.js` · unmask | `if (!ctx.bug('B11')) ctx.audit(… 'UNMASK' …)` | TC-PDPA-03 · TC-AUDIT-01 | – |
| B12 | B07 | `src/modules/workflow/routes.js` · return + `pages.js` (`return-btn`) | `if (!ctx.bug('B12') && return_count >= 2) 409` · ปุ่ม `(ctx.bug('B12') \|\| return_count < 2)` | TC-WORKFLOW-04 | – |

ครบ 12 ตัว (B01 B02 B03 B04 B05 B06 B07 B08 B09 B10 B11 B12) · ทุกตัวอยู่ฝั่งเซิร์ฟเวอร์ · B01 B03 B04 อยู่ใน rules.js ฟังก์ชันต่างกัน (B03+B04 อยู่ฟังก์ชันเดียวกันแต่คนละบรรทัด รวมกันแล้วผล = B04 ชนะในฟังก์ชันนั้น ซึ่งเป็น union ของผลล้มที่คาด)

## 6. testid (CONTRACT ข้อ 2) → บล็อกที่ render

| CONTRACT | testid | บล็อก |
|---|---|---|
| 2.1 | `app-header` `user-name` `user-role` `logout-btn` `nav-*` `nav-bell` `bell-count` `forbidden-msg` `not-found-msg` · `action-error` `action-success` (ผ่าน `App.*`) | B01 (ทุกบล็อกเรียกใช้) |
| 2.2 | `login-tab-citizen` `login-tab-staff` `thaid-id-input` `thaid-submit` `thaid-error` `otp-step` `otp-input` `otp-submit` `otp-error` `otp-attempts-left` `lock-message` `lock-until` `staff-username` `staff-password` `staff-submit` `staff-error` | B04 |
| 2.3 | `reg-name` `reg-mobile` `reg-email` `reg-consent` `reg-submit` `reg-error-mobile` `reg-error-consent` | B04 |
| 2.4 | `citizen-welcome` `start-service-SV-0x` `my-case-row` `my-draft-row` `row-case-no` `row-service` `row-status` `row-due` `row-draft-id` `open-draft-btn` | B05 |
| 2.5 | `wizard-step` `service-name` `qty-input` `area-input` `fee-total` `fee-error` `draft-id` `save-draft-btn` `to-upload-btn` `upload-input-*` `file-item` `file-remove-btn` `upload-error` `missing-docs` `to-payment-btn` `payment-amount` `create-qr-btn` `qr-image` `qr-ref` `qr-expires` `qr-expired-msg` `regenerate-qr-btn` `payment-status` `refresh-payment-btn` `submitted-case-no` `receipt-no` `receipt-amount` `receipt-paid-at` `go-case-btn` | B05 |
| 2.6 (citizen) | `case-no` `case-status` `case-service` `case-step` `case-fee` `sla-due` `sla-level` `case-timeline` `timeline-item` `closed-at` `doc-item` `doc-download-link` `case-id-full` `doc-no` `verify-code` `doc-qr` `download-doc-btn` `cancel-case-btn` `cancel-confirm-text` `confirm-cancel-btn` `return-reason-display` `fix-deadline` `fix-upload-input` `submit-fix-btn` `no-refund-note` | B05 |
| 2.6 (officer) | `case-no` `case-status` `case-service` `case-step` `case-fee` `applicant-name` `sla-due` `sla-level` `case-timeline` `timeline-item` `closed-at` `case-owner` `return-count` `doc-item` `doc-download-link` `applicant-id` `show-full-id-btn` `unmask-reason` `unmask-submit` `unmask-error` `full-id` `claim-btn` `return-btn` `return-reason` `return-submit` `return-reason-error` `forward-note` `forward-btn` `approve-btn` `reject-btn` `reject-reason` `reject-submit` `reject-reason-error` `issue-btn` `doc-no` `verify-code` `doc-qr` | B07 (ปุ่ม unmask/issue ยิง API ของ B08) |
| 2.7 | `queue-filter` `queue-table` `queue-row` `row-case-no` `row-service` `row-applicant` `row-id-masked` `row-status` `row-due` `row-sla-level` `row-owner` `claim-btn` `workload-count` `queue-empty` | B07 |
| 2.8 | `approval-row` `row-case-no` `row-service` `row-applicant` `row-due` `approval-open` | B07 |
| 2.9 | `period-select` `service-select` `kpi-received` `kpi-closed` `kpi-ontime-pct` `kpi-backlog` `kpi-overdue` `workload-row` `workload-value` `export-xlsx-btn` `export-pdf-btn` | B09 |
| 2.10 | `audit-filter-actor` `audit-filter-event` `audit-filter-from` `audit-filter-to` `audit-apply-btn` `audit-count` `audit-row` `audit-time` `audit-actor` `audit-role` `audit-event` `audit-case-no` `audit-transition` `audit-detail` `audit-export-csv-btn` (ห้ามมี `audit-edit-btn` `audit-delete-btn`) | B08 |
| 2.11 | `service-row` `svc-fee-SV-0x` `svc-fee-per-sqm-SV-03` `svc-sla-SV-0x` `svc-save-SV-0x` `holiday-date-input` `holiday-name-input` `holiday-add-btn` `holiday-row` `holiday-delete-btn` `user-row` `user-role-select` `user-dept-select` `user-save-btn` | B10 |
| 2.12 | `noti-item` `noti-empty` | B07 |
| 2.13 | `verify-result` `verify-doc-no` `verify-applicant` `verify-service` `verify-issued` `verify-signer` `verify-expires` | B08 |

## 7. ข้อความ error (CONTRACT ข้อ 5) → บล็อกที่ส่ง

| code | บล็อก |
|---|---|
| `INVALID_ID` `OTP_INVALID` `LOCKED` `INVALID_CREDENTIALS` `INVALID_MOBILE` `CONSENT_REQUIRED` | B04 |
| `INVALID_QTY` `INVALID_AREA` `AREA_TOO_LARGE` | B05 (ผ่าน B02 `calcFee`) · B06 (ตอนล็อกยอด) |
| `FILE_TOO_LARGE` `FILE_TYPE` `FILE_COUNT` `PLAN_NOT_PDF` | B05 · (B07 resubmit ใช้ 3 ตัวแรก) · B01 (multer → FILE_TOO_LARGE/FILE_COUNT) |
| `MISSING_DOCS` `QR_EXPIRED` `AMOUNT_MISMATCH` | B06 |
| `NOT_FOUND` | ทุกบล็อก (B01 fallback) |
| `CANNOT_CANCEL` | B05 |
| `FIX_WINDOW_EXPIRED` `ALREADY_CLAIMED` `WORKLOAD_LIMIT` `RETURN_LIMIT` `REASON_TOO_SHORT` | B07 |
| `REASON_REQUIRED` `METHOD_NOT_ALLOWED` | B08 |
| `INVALID_STATE` `FORBIDDEN` | B05 B06 B07 B08 · `FORBIDDEN` ทุกบล็อกผ่าน `ctx.requireApi` |
| `UNAUTHENTICATED` | B01 `requireApi` · B04 |
| `INVALID_FEE` `INVALID_SLA` `DUPLICATE_HOLIDAY` `SELF_ROLE_CHANGE` | B10 |
| `INVALID_TIME` | B01 |
| ข้อความหน้า `ไม่มีสิทธิ์เข้าถึงหน้านี้` · `ไม่พบคำขอ` | B01 (`renderForbidden` `renderCaseNotFound`) |

## 8. Audit 10 เหตุการณ์ → บล็อก

| event | บล็อก | TC |
|---|---|---|
| `STAFF_LOGIN` | B04 | AUDIT-01 AUDIT-03 |
| `CLAIM` `RETURN` `FORWARD` `APPROVE` `REJECT` | B07 | AUDIT-01 QUEUE-02 WORKFLOW-04 RBAC-02 |
| `ISSUE` `UNMASK` | B08 | AUDIT-01 PDPA-03 |
| `EXPORT` | B09 (Dashboard) · B08 (Audit CSV) | DASH-03 AUDIT-01 |
| `ADMIN_CHANGE` | B10 | AUDIT-01 RBAC-04 RBAC-06 |

## 9. ผลตรวจความครบ (สถาปนิกตรวจแล้ว)

| ตรวจ | ผล |
|---|---|
| FR-01 … FR-29 มีบล็อกหลักทุกข้อ | ✅ 29/29 |
| BR-01 … BR-29 มีบล็อกหลักทุกข้อ | ✅ 29/29 |
| NFR-01 … NFR-11 | ✅ 11/11 (NFR-05 HTTPS นอกขอบเขต local · บันทึกใน QUESTIONS) |
| TC 51 ข้อ มีบล็อกเว็บ + บล็อก test | ✅ 51/51 (T1 22 · T2 29) |
| BUG 12 ตัว มีบล็อก ไฟล์ ฟังก์ชัน | ✅ 12/12 |
| ไม่มีสองบล็อกเขียนไฟล์เดียวกัน | ✅ (C2 ใน 00-OVERVIEW · B01 ห้ามสร้าง seed.js/rules.js) |
| method+path ไม่ซ้ำข้ามบล็อก | ✅ (C4 · `GET /api/officer/queue` เป็นของ B08 เท่านั้น · หน้า `/officer/queue` ของ B07) |
