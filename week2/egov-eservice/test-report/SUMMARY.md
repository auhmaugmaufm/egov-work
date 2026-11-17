# LAB 4 · ผลรัน TEST-PLAN (TEST_MODE=1 ไม่ตั้ง BUG_MODE)

**ผลสุดท้าย: ผ่าน 51/51** · ล้ม 0 · flaky 0 · ใช้เวลา 131 วินาที · รันบน host (Docker Desktop · Chromium · macOS)

| TC | ผล | ประเภทที่ล้ม (ระหว่างทาง) | แก้อะไร |
|---|---|---|---|
| TC-AUTH-01 | ✅ ผ่าน | – | – |
| TC-AUTH-02 | ✅ ผ่าน | – | – |
| TC-AUTH-03 | ✅ ผ่าน | – | – |
| TC-AUTH-04 | ✅ ผ่าน | – | – |
| TC-FEE-01 | ✅ ผ่าน | – | – |
| TC-SUBMIT-01 | ✅ ผ่าน | – | – |
| TC-SUBMIT-02 | ✅ ผ่าน | – | – |
| TC-SUBMIT-03 | ✅ ผ่าน | – | – |
| TC-UPLOAD-01 | ✅ ผ่าน | – | – |
| TC-UPLOAD-02 | ✅ ผ่าน | – | – |
| TC-PAY-01 | ✅ ผ่าน | – | – |
| TC-PAY-02 | ✅ ผ่าน | – | – |
| TC-PAY-03 | ✅ ผ่าน | – | – |
| TC-PAY-04 | ✅ ผ่าน | – | – |
| TC-QUEUE-01 | ✅ ผ่าน | – | – |
| TC-QUEUE-02 | ✅ ผ่าน | – | – |
| TC-QUEUE-03 | ✅ ผ่าน | – | – |
| TC-SLA-01 | ✅ ผ่าน | – | – |
| TC-SLA-02 | ✅ ผ่าน | – | – |
| TC-SLA-03 | ✅ ผ่าน | – | – |
| TC-NOTI-01 | ✅ ผ่าน | – | – |
| TC-NOTI-02 | ✅ ผ่าน | – | – |
| TC-WORKFLOW-01 | ✅ ผ่าน | – | – |
| TC-WORKFLOW-02 | ✅ ผ่าน | – | – |
| TC-WORKFLOW-03 | ✅ ผ่าน | test ผิด | รอบ 2 ล้มแบบไม่นิ่ง: claim-btn ทำ location.reload() แต่ test goto ทันที → ERR_ABORTED · แก้: รอ load ก่อน goto · ค่าคาดหวังไม่เปลี่ยน |
| TC-WORKFLOW-04 | ✅ ผ่าน | – | – |
| TC-WORKFLOW-05 | ✅ ผ่าน | – | – |
| TC-WORKFLOW-06 | ✅ ผ่าน | – | – |
| TC-DOC-01 | ✅ ผ่าน | – | – |
| TC-DOC-02 | ✅ ผ่าน | – | – |
| TC-DOC-03 | ✅ ผ่าน | – | – |
| TC-PDPA-01 | ✅ ผ่าน | – | – |
| TC-PDPA-02 | ✅ ผ่าน | – | – |
| TC-PDPA-03 | ✅ ผ่าน | – | – |
| TC-DASH-01 | ✅ ผ่าน | – | – |
| TC-DASH-02 | ✅ ผ่าน | – | – |
| TC-DASH-03 | ✅ ผ่าน | test ผิด | รอบ 1 ค้างรอ response ของลิงก์ดาวน์โหลด (Chromium ไม่ส่ง event นี้) · เว็บส่ง PDF ถูกตาม BR-26 (ตรวจด้วย curl) · แก้: ตรวจ Content-Type ด้วย GET ซ้ำหลังขั้น Audit (Audit ยัง = 3) · ค่าคาดหวังไม่เปลี่ยน |
| TC-DASH-04 | ✅ ผ่าน | – | – |
| TC-AUDIT-01 | ✅ ผ่าน | – | – |
| TC-AUDIT-02 | ✅ ผ่าน | – | – |
| TC-AUDIT-03 | ✅ ผ่าน | – | – |
| TC-RBAC-01 | ✅ ผ่าน | – | – |
| TC-RBAC-02 | ✅ ผ่าน | – | – |
| TC-RBAC-03 | ✅ ผ่าน | – | – |
| TC-RBAC-04 | ✅ ผ่าน | – | – |
| TC-RBAC-05 | ✅ ผ่าน | – | – |
| TC-RBAC-06 | ✅ ผ่าน | – | – |
| TC-NFR-01 | ✅ ผ่าน | – | – |
| TC-NFR-02 | ✅ ผ่าน | test ผิด | รอบ 1: Control+A บน Mac ไม่ใช่เลือกทั้งหมด → qty=11 → เว็บปิดปุ่มถูกตาม BR-04 (1–5) · แก้: ControlOrMeta+A · ค่าคาดหวังไม่เปลี่ยน |
| TC-NFR-03 | ✅ ผ่าน | – | – |
| TC-NFR-04 | ✅ ผ่าน | – | – |

## ประวัติการรัน
| รอบ | ผล | หมายเหตุ |
|---|---|---|
| 1 | 49/51 | ล้ม DASH-03 · NFR-02 |
| 2 | 50/51 | 2 ข้อแรกผ่าน · WORKFLOW-03 ล้มไม่นิ่ง |
| 3 | 51/51 | |
| 4 | 51/51 | เปิด recordVideo ให้ context ที่ test สร้างเอง เพื่อทำ GIF (ผลชุดนี้คือ results.json) |

## สรุปการจำแนก
- เว็บผิด: 0 · test ผิด: 3 · แผนผิด: 0 (ไม่มีคำถามใหม่ถึง TA)
- ข้อสังเกตถึง TA (ไม่ใช่แผนผิด): การ์ด TC-NFR-02 เขียน `Control+A` ซึ่งบน macOS ไม่ใช่ "เลือกทั้งหมด"

## ไฟล์ในโฟลเดอร์นี้
- `results.json` ผลรัน · `index.html` รายงาน Playwright (เปิดด้วย `npx playwright show-report test-report`) · `run-log.txt` log รอบสุดท้าย
- `gif/` GIF ของ TC ระดับ P1: 40 จาก 43 ข้อ · ไม่มี GIF 3 ข้อ (TC-PAY-02 · TC-PAY-03 · TC-PDPA-02) เพราะทดสอบผ่าน API ล้วน ไม่มีหน้าจอให้อัด
