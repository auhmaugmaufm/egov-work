# BUG-HUNT · ขั้น 5 พิสูจน์ว่า test จับบั๊กได้ (BUG_MODE)

> รันวันที่ 2026-11-16 22:20–22:43 บนเครื่อง Mac (Docker Desktop) · เว็บ `TEST_MODE=1 BUG_MODE=<รหัส> docker compose up -d` ใน `./app` · ชุด Playwright เต็ม 51 TC ต่อรอบ (`npx playwright test`)
> สคริปต์: `app/scripts/bug-hunt.sh` · ผลดิบแต่ละรอบ: `app/bug-hunt/<รหัส>.json` และ `.log` · สรุป: `app/bug-hunt/summary.log`
> ทุกรอบ log ของเว็บยืนยันว่าบั๊กเปิดถูกตัว (`BUG_MODE active: Bxx`)

## สรุป

**จับได้ 12 / 12 ตัว** · TC ที่ต้องล้มล้มครบทุกตัว · ทุกข้อล้มเพราะ **ค่าจริงต่างจากค่าที่คาดหวัง** (ไม่มีข้อไหนล้มเพราะ timeout หรือหา element ไม่เจอ)
ไม่ต้องแก้เว็บหรือ test ในขั้นนี้ (test ที่แก้ไปแล้ว 3 จุดในขั้น 4 ดูได้ใน HANDOFF.md)

## ตารางตอบ (ตามพรอมต์ขั้น 5)

| บั๊ก | TC ที่ต้องล้ม | ล้มจริง | หมายเหตุ (ข้อความ assert ที่ล้ม) |
|---|---|---|---|
| B01 | TC-FEE-01 | ✅ | `SV-03 area=101` expected `฿1,010` received `฿1,000` |
| B02 | TC-UPLOAD-01 | ✅ | `UI 5242880 file-item` expected 1 received 0 (ไฟล์ 5 MB พอดีถูกปฏิเสธ) |
| B03 | TC-SLA-01 · TC-SLA-02 | ✅ | SLA-01 แถว c `dueAt` expected `2026-12-08T16:30` received `2026-12-07T16:30` · SLA-02 `sla-due` เช่นกัน · ล้มด้วย SLA-03, RBAC-04 (ยอมรับตาม BUGS.md) และ NOTI-02 (ดูข้อ 1 ด้านล่าง) |
| B04 | TC-SLA-02 | ✅ | `sla-due` expected `2026-12-08T16:30` received `2026-12-04T16:30` (ไม่หยุดนับตอนรอแก้ไข) |
| B05 | TC-PAY-01 | ✅ | รอบ 3 (09:10:00 อายุ 15:00) expected `410 QR_EXPIRED` received `200` |
| B06 | TC-RBAC-01 | ✅ | สมหญิงเปิด `…000005` expected 404 received 200 |
| B07 | TC-RBAC-02 | ✅ | `POST /api/cases/…000014/approve` โดย off.reg2 expected 403 received 200 |
| B08 | TC-QUEUE-02 | ✅ | ต้องมีผู้แพ้ที่เห็น `action-error` 1 คน expected 1 received 0 |
| B09 | TC-PDPA-02 | ✅ | `GET /api/officer/queue` ไม่มีเลข 13 หลัก expected false received true |
| B10 | TC-DASH-02 | ✅ | พ.ย. `kpi-ontime-pct` expected `85.7%` received `23.1%` · ล้มด้วย DASH-01 (`–` → `0.0%`) และ DASH-03 (ยอมรับตาม BUGS.md) |
| B11 | TC-PDPA-03 · TC-AUDIT-01 | ✅ | PDPA-03 `audit-count` (UNMASK) expected 1 received 0 · AUDIT-01 `audit-count` ขาด 1 แถว |
| B12 | TC-WORKFLOW-04 | ✅ | `…000023` ตีกลับครบ 2 ครั้งแล้ว `return-btn` expected 0 received 1 |

## ตารางบันทึกผล (รูปแบบ BUGS.md ข้อ 4)

| บั๊ก | TC ที่คาดว่าล้ม (จากตาราง 2) | TC ที่ล้มจริง | TC ล้มเกินที่คาด | TC ที่ควรล้มแต่ผ่าน | ผล |
|---|---|---|---|---|---|
| (ปกติ) ก่อนเริ่ม | – | – | – | – | 51/51 passed (ขั้น 4 รอบ 3 และ 4 ติดกัน) |
| B01 | TC-FEE-01 | TC-FEE-01 | – | – | 50 passed · 1 failed ✅ |
| B02 | TC-UPLOAD-01 | TC-UPLOAD-01 | – | – | 50 passed · 1 failed ✅ |
| B03 | TC-SLA-01 · TC-SLA-02 (อาจล้มด้วย TC-SLA-03 · TC-RBAC-04) | TC-SLA-01 · TC-SLA-02 · TC-SLA-03 · TC-RBAC-04 · TC-NOTI-02 | TC-NOTI-02 (ผลข้างเคียงสาเหตุเดียวกับ SLA-03 ดูข้อ 1) | – | 46 passed · 5 failed ✅ |
| B04 | TC-SLA-02 | TC-SLA-02 | – | – | 50 passed · 1 failed ✅ |
| B05 | TC-PAY-01 | TC-PAY-01 | – | – | 50 passed · 1 failed ✅ |
| B06 | TC-RBAC-01 | TC-RBAC-01 | – | – | 50 passed · 1 failed ✅ |
| B07 | TC-RBAC-02 | TC-RBAC-02 | – | – | 50 passed · 1 failed ✅ |
| B08 | TC-QUEUE-02 (ส่วน 3 ต่อกัน ล้มแน่นอน) | TC-QUEUE-02 | – | – | 50 passed · 1 failed ✅ |
| B09 | TC-PDPA-02 | TC-PDPA-02 | – | – | 50 passed · 1 failed ✅ |
| B10 | TC-DASH-02 (อาจล้มด้วย TC-DASH-01 · TC-DASH-03) | TC-DASH-01 · TC-DASH-02 · TC-DASH-03 | – | – | 48 passed · 3 failed ✅ |
| B11 | TC-PDPA-03 · TC-AUDIT-01 | TC-PDPA-03 · TC-AUDIT-01 | – | – | 49 passed · 2 failed ✅ |
| B12 | TC-WORKFLOW-04 | TC-WORKFLOW-04 | – | – | 50 passed · 1 failed ✅ |
| B03,B07 (รวม) | union ของ B03 + B07 | B03 ทั้ง 5 + TC-RBAC-02 | – | – | 45 passed · 6 failed ✅ = union พอดี |
| B01,B05,B09 (รวม) | TC-FEE-01 · TC-PAY-01 · TC-PDPA-02 | TC-FEE-01 · TC-PAY-01 · TC-PDPA-02 | – | – | 48 passed · 3 failed ✅ = union พอดี |
| (ปกติ) ปิดบั๊กอีกครั้ง | – | – | – | – | 51/51 passed ✅ |

## Triage ข้อที่ไม่ตรงตาราง

1. **B03 → TC-NOTI-02 ล้มด้วย (นอกตาราง "อาจล้มด้วย")**
   - ข้อความ: `ส่วน B off.reg2 รายการบนจอ` ขาด `EG-2569-000016:near` (ณ ส. 5 ธ.ค. 10:00)
   - สาเหตุ: การแจ้งเตือน 3 ระดับใช้ฟังก์ชันนับ "วันทำการคงเหลือ" ตัวเดียวกับ SLA · B03 ไม่ข้ามวันหยุด 7 ธ.ค. → วันคงเหลือเกินไป 1 วัน → `…000016` เป็น `ปกติ` แทน `ใกล้ครบกำหนด` → ไม่มีแจ้งเตือน
   - กลไกเดียวกับที่ BUGS.md ยอมรับใน TC-SLA-03 ส่วน B (ศ.4 ธ.ค. 09:00 ได้ `ปกติ` แทน `ใกล้ครบกำหนด`) และตรงกับ DECISIONS 18 (B03 กระทบ remainingBusinessDays) · บั๊กไม่รั่วเกินจุด (กติกาข้อ 1) และ test ไม่ได้พึ่งกันเอง (NOTI-02 ผ่านทุกรอบอื่น)
   - สรุป: **ผลข้างเคียงที่ยอมรับได้** ไม่ต้องแก้ · เสนอให้ผู้สอนเพิ่ม TC-NOTI-02 ในคอลัมน์ "อาจล้มด้วย" ของ B03

2. ไม่มีบั๊กตัวไหนที่ TC ควรล้มแต่ผ่าน (ไม่มี test ผ่านหลอก) → ไม่ต้องแก้เว็บหรือ test

## ความสามารถในการทำซ้ำ (BUGS.md ข้อ 3)

| ขั้น | ผล |
|---|---|
| 1–2 ปกติ 2 รอบติดกัน | ✅ 51/51 ทั้งสองรอบ (ขั้น 4 รอบ 3 และ 4) |
| 3 B01–B12 ทีละตัว | ✅ 12/12 จับได้ |
| 4 ข้อความ assert บอกค่าต่าง | ✅ ทุกข้อเป็น expected/received ไม่มี timeout |
| 5 รวมบั๊ก | ✅ B03,B07 และ B01,B05,B09 = union พอดี |
| 6 ปิดบั๊กอีกครั้ง | ✅ 51/51 |
