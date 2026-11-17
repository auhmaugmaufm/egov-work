# HANDOFF · egov-eservice (Week 2 LAB) — บันทึกไว้รันต่อครั้งถัดไป

> อัปเดตล่าสุด: 2026-11-16 23:00 · ถ้าเปิด session ใหม่ ให้ Claude อ่านไฟล์นี้ก่อน

## ⭐ สรุปสั้น (อ่านตรงนี้ก่อน)

**การบ้าน LAB 1–5 เสร็จครบแล้ว ✅** · ไม่ต้องรันอะไรเพิ่ม · ผู้ใช้ปิด Docker และเครื่องมือทั้งหมดแล้ว (23:00)

| LAB | ได้อะไร | ไฟล์ (ใน `week2/egov-eservice/`) |
|---|---|---|
| 1 เข้าใจโจทย์ | ตอบ 3 ข้อ: ฿1,010 · อ.8 ธ.ค.69 16:30 (ข้ามเสาร์-อาทิตย์ + วันหยุด จ.7 ธ.ค.) · testid ชื่อกลางให้ชุดตรวจของ TA ใช้ได้ทุกกลุ่ม | (ตอบปากเปล่า) |
| 2 วางแผน | DAG · Gantt · แผน | `blocks.json` `dag.png` `gantt-plan.png` `PLAN.md` |
| 3 สร้างเว็บ | เว็บรันด้วย Docker · รายงานแผนเทียบของจริง (เสร็จ 9/10 บล็อก · Z1 หมดเวลาแต่เว็บครบ) | `app/` `REPORT.md` `gantt-actual.png` `compare.png` |
| 4 ทดสอบ | **51/51 ผ่าน** (2 รอบติดกัน) · GIF 40 ไฟล์ · ข้อที่เคยล้ม 3 ข้อ = test ผิดทั้งหมด (แก้ test ไม่ได้แก้เฉลย) | `test-report/` (SUMMARY.md · index.html · gif/) |
| 5 ล่าบั๊ก | **จับได้ 12/12** · รวมบั๊ก = union พอดี · ปิดบั๊กกลับ 51/51 · B03 ทำ TC-NOTI-02 ล้มด้วย (ผลข้างเคียงยอมรับได้) | `BUG-HUNT.md` · ผลดิบ `app/bug-hunt/` |

**สิ่งที่ยังค้าง (ไม่ใช่การบ้านบังคับ)**
- ส่งคำถาม QUESTIONS.md ส่วน ง. ให้ TA (Q-01 Q-02 Q-04 Q-18 Q-35) ถ้ายังอยากได้คำตอบ
- `test-report/` ใหญ่ 102MB (วิดีโอ/trace ใน `data/`) → เช็กว่า push git ได้ไหม ถ้าไม่ได้ ให้ Claude ช่วยตัด
- ไม่ต้อง review โค้ด (การบ้านไม่ได้สั่ง · ผู้ใช้ตัดสินใจแล้ว)

**ข้อจำกัด/ปัญหาที่เจอ (ใส่ใน REPORT แล้ว)**: S1-SPEC รันนอก DAG (54 นาที) · รอบ 1 B01 หมดเวลา · รอบ 2 Z1 หมดเวลา 1 ชม. ไม่มี INTEGRATION.md · build ช้าเพราะ Mac จำลอง amd64 · ไม่ใช้ skill review (บังคับ Codex) · yolo2–4 เป็นแพ็กเกจเดียวกัน

## ⭐ วิธีรันทุกอย่างใหม่ (ถ้าต้องการ)

ทุกคำสั่งรันบนเครื่อง Mac ต้องเปิด **Docker Desktop** ก่อน · `cd /Users/supitchak/CWN-teaching2026/egov-work/week2/egov-eservice/app`

| อยากทำอะไร | คำสั่ง |
|---|---|
| เปิดเว็บ (ปกติ) | `TEST_MODE=1 docker compose up -d` → เข้า http://localhost:3000 · เช็ก `curl localhost:3000/api/health` |
| เปิดเว็บแบบมีบั๊ก | `TEST_MODE=1 BUG_MODE=B03 docker compose up -d` (หลายตัว `B03,B07`) |
| แก้โค้ดเว็บแล้ว build ใหม่ | `TEST_MODE=1 docker compose up -d --build` (ถ้า BuildKit ล้ม ให้นำหน้าด้วย `DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0`) |
| ปิดเว็บ | `docker compose down` |
| รันชุดตรวจ 51 ข้อ (ขั้น 4) | `npx playwright test` (≈1–2 นาที · ผลไป `app/test-report/`) · ครั้งแรกบนเครื่องใหม่: `npm install && npx playwright install chromium` |
| รันข้อเดียว | `npx playwright test -g "TC-FEE-01"` |
| ล่าบั๊กทั้ง 15 รอบ (ขั้น 5) | `./scripts/bug-hunt.sh > bug-hunt/summary.log 2>&1` (≈23 นาที) · เฉพาะบางตัว `MODES="B01 B05" ./scripts/bug-hunt.sh` |
| ดูรายงานแบบเว็บ + วิดีโอ + trace | `npx playwright show-report ../test-report` (กด Ctrl+C เพื่อปิด) |
| ดู GIF | `open ../test-report/gif` แล้วกด Spacebar ที่ไฟล์ |

ทีมเอเจนต์ใน container `multi-account` (ใช้ตอนขั้น 3 เท่านั้น ไม่ต้องใช้แล้ว): ดูหัวข้อ 2 และ 4 ด้านล่าง · run_id รอบ 2 = `egov-eservice-20261116-203808`

---

## 1. เป้าหมายและข้อตกลงกับผู้ใช้
- ทำการบ้าน LAB Week 2 (egov e-Service) ตาม `egov-brief/PROMPTS.md` ขั้น 0–5 · ห้ามแก้ไฟล์ใน `egov-brief/`
- ผู้ใช้ token น้อย → ออกแบบ **"ตัวเก่งเขียนสเปก · ตัวถูกทำตาม"**: S1 (opus/xhigh) เขียน `SPEC/` ครั้งเดียว · บล็อกช่างใช้ sonnet/medium (d2) และ haiku/low (d1)
- ใช้เฉพาะบัญชี Claude (yolo*) ไม่ใช้ Codex → **ไม่ใช้ skill review** (dagplan บังคับผู้ตรวจเป็น cyolo) ใช้ Playwright ตรวจแทน
- Claude ห้ามล็อกอินแทนผู้ใช้ · ใช้โทเคนก่อนต้องแจ้ง
- แผนฉบับเต็ม: `/Users/supitchak/.claude/plans/plan-week-purrfect-parnas.md`

## 2. ตำแหน่งไฟล์
| อะไร | บนเครื่อง (host) | ใน container `multi-account` |
|---|---|---|
| โจทย์ | `/Users/supitchak/CWN-teaching2026/egov-work/egov-brief/` | `/workspace/egov-brief/` |
| แผน/ผลส่ง | `/Users/supitchak/CWN-teaching2026/egov-work/week2/egov-eservice/` | `/workspace/plans/egov-eservice/` |
| สเปก (ทบทวนแล้ว) | `.../week2/egov-eservice/SPEC/` (ต้นฉบับที่ผ่านรีวิว) | `/workspace/plans/egov-eservice/app/SPEC/` |
| โค้ดเว็บ | (ยังไม่คัดลอก) | `/workspace/plans/egov-eservice/app/` |
| blocks รอบ 1 | `blocks.run1.json` | – |
| blocks รอบ 2 (10 บล็อก B02–B10 + Z1 · timeout · วิธีตรวจด้วย container แยกพอร์ต 31xx) | `blocks.json` | ส่งเข้าแล้ว |

สคริปต์: `D=/root/ai-accounts/.Claude/shared/skills/dag-planner/scripts/dagplan.py` · `TEAM=/root/ai-accounts/.Claude/shared/skills/agent-team/scripts/team.py` (รันผ่าน `docker exec multi-account python3 ...`)

## 3. สถานะ (ณ เวลาที่อัปเดต)
| ขั้น | สถานะ |
|---|---|
| ขั้น P setup (container · 4 สกิล · doctor พร้อมใช้) | ✅ |
| ขั้น 0 brief เข้า container | ✅ |
| LAB1 คำตอบ: ฿1,010 · อ.8 ธ.ค.2569 16:30 · testid กลางให้ TEST-PLAN ใช้ได้ทุกกลุ่ม | ✅ |
| ขั้น 1–2 แผน (dag.png gantt-plan.png PLAN.md) | ✅ |
| S1-SPEC (yolo1 opus/xhigh 54 นาที) + รีวิว (แก้ Q-02 ให้ B03 กระทบ remainingBusinessDays ตาม DECISIONS 18) | ✅ |
| รอบ 1 run `egov-eservice-20261116-201853` | T1 ✅ (tests/e2e/part-a.spec.ts 22 TC) · T2 ▶ กำลังรัน · **B01 ✘ timeout 600s** (ไฟล์เขียนเกือบครบ แต่ build ช้าเพราะ amd64 emulation) · ที่เหลือ ⛔ blocked |
| รอบ 1 จบ | T1 ✅ T2 ✅ (part-a 22 TC · part-b 29 TC) · B01 หมดเวลาแต่ **health/reset ผ่าน → ถือว่าเสร็จ** (Z1 จะตรวจตาราง B01 ซ้ำ) |
| image `egov-app:dev` | ✅ build ด้วย `DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0` (BuildKit ล้ม: rosetta error) |
| **รอบ 2 run `egov-eservice-20261116-203808`** | ▶ เริ่ม 20:38 · แผน ≈ 80 นาที · log `/workspace/plans/egov-eservice/run.log` |

## 4. ขั้นถัดไป (เก่า · ทำครบแล้ว ดูสรุปด้านบน)
1. เฝ้ารอบ 2: `docker exec multi-account python3 $TEAM status --run egov-eservice-20261116-203808` · บล็อกที่ค้าง/ล้มเพราะโควตา → `docker exec multi-account python3 $TEAM run /workspace/plans/egov-eservice/graph.json --resume egov-eservice-20261116-203808` หลังโควตา reset
2. (ถ้าต้องรันใหม่ทั้งรอบ) ส่ง `blocks.json` → `dag` → `plan --max-agents 2 --accounts <โควตาจริง>` → `export` → `run --detach`
   ```bash
   docker cp blocks.json multi-account:/workspace/plans/egov-eservice/blocks.json
   docker exec multi-account python3 $D dag egov-eservice --blocks /workspace/plans/egov-eservice/blocks.json
   docker exec multi-account python3 $D plan egov-eservice --max-agents 2 --accounts yolo2:<เหลือ%>,yolo3:<เหลือ%>,yolo4:<เหลือ%>
   docker exec multi-account python3 $D export egov-eservice && docker exec multi-account python3 $D run egov-eservice --detach
   ```
3. เฝ้า `run.log` · บล็อกล้ม → อ่าน log ใน `/workspace/.agent-team/<run_id>/logs` แก้สเปก/ timeout แล้วรันเฉพาะบล็อกที่เหลือ
4. จบ → `report` → คัดลอก `app/ gantt-actual.png compare.png REPORT.md` มาที่ host · หมายเหตุใน REPORT: S1 รันนอก DAG (54 นาที) และรอบ 1 B01 timeout
5. LAB4: พรอมต์ขั้น 4 → `test-report/` (results.json · index.html · GIF P1) · LAB5: พรอมต์ขั้น 5 → `BUG-HUNT.md`
6. ส่ง QUESTIONS.md ส่วน ง. ให้ TA (Q-01 checksum · Q-02 · Q-04 PDF ไทย · Q-18 · Q-35 hook login-as)

## 5. โควตา / ความเสี่ยง
- เกณฑ์ agent-team: บัญชี ≥80% หยุดรับงาน · งานค้างต่อด้วย `--resume <run_id>` หรือรันรอบใหม่เฉพาะบล็อกที่เหลือ
- 20:37: **yolo2 = yolo3 = yolo4 เป็น subscription เดียวกัน** (34% เท่ากัน reset 00:50 เท่ากัน) · yolo1 95% (reset 23:59) · yolo5 ไม่ได้ล็อกอิน · week ~20%
- ความจุจริงตอนนี้ ≈ 46% ของ session เดียว (ถึงเกณฑ์ 80%) → มีโอกาสหยุดกลางรอบ 2 · ต่อหลัง 00:00 (yolo1) / 00:50 (yolo2–4)
- build ใน container ช้า (amd64 emulation บน Mac) → timeout บล็อกต้องยาว · ถ้ายังช้า: ทดสอบเว็บบน host ด้วย Docker Desktop (`TEST_MODE=1 docker compose up -d --build` → http://localhost:3000)
- ปัญหาที่เจอ: `better-sqlite3` ไม่มี binding สำหรับ node 22 ของ container → ตรวจผ่าน docker compose (node 20) เท่านั้น

## 6. บันทึกเหตุการณ์
- 19:09–20:03 S1-SPEC สำเร็จ (14 ไฟล์ 7,807 บรรทัด · QUESTIONS 39 ข้อ)
- 20:18 เริ่มรอบ 1 · 20:25 T1 ✔ (7 นาที) · 20:28 B01 ✘ timeout → blocked 9 บล็อก
- 20:31 สร้าง blocks.json รอบ 2 (timeout S1500/M2400/L3600 · B01 3000 · ตัด T1 T2)
- 20:33 image build สำเร็จด้วย legacy builder · smoke test health 200 reset 200
- 20:35 T2 ✔ (7.5 นาที) · รอบ 1 จบ
- 20:38 เริ่มรอบ 2 (10 บล็อก)
- 20:40–20:44 รอบ 2: B02 ✔ (unit 14/14) · B03 ✔ (seed test 18/18) · B04 B05 B06 B07 B08 B09 B10 ✔ (บล็อกละ 2–3.5 นาที) · 20:44 **Z1 ▶ yolo2** · โควตา session รวม 57%
- ถ้า Z1 ล้ม/หมดเวลา: โค้ดเว็บครบแล้ว → ทำ LAB4/5 ต่อจากพรอมต์ขั้น 4–5 ได้เลย (ไม่ต้องรันบล็อกช่างซ้ำ)
- 20:55 Z1 รัน Playwright รอบ 2 (Z1 ใช้ `timeout 590` เองเพราะเพดาน Bash tool 10 นาที → รันไม่ครบชุดต่อครั้ง)
- **ผู้ใช้สั่ง: ทำตามการบ้านเป๊ะ** → ขั้น 3: รอ Z1 จบ (ไม่แทรก) → `report` → คัดลอก app/ gantt-actual.png compare.png REPORT.md มา host · ขั้น 4–5: Claude Code บน host ทำตามพรอมต์ PROMPTS.md ขั้น 4 และ 5 (เว็บรันด้วย Docker Desktop บน host ที่ ./week2/egov-eservice/app)
- host: node 22 ✅ · พอร์ต 3000 ว่าง ✅ · ffmpeg 9.0.2 ✅ · playwright ติดตั้งผ่าน npm ใน app/
- 21:44 **Z1 ✘ timeout 3600s** (รัน Playwright 4 รอบ · แก้ views.js workflow/pages.js · ไม่มี INTEGRATION.md)
- 21:46 **ขั้น 3 ปิดแล้ว**: `report` (เสร็จ 9/10 · k yolo = 0.216) · คัดลอก `app/` (ไม่รวม node_modules/test-results/app.db) `gantt-actual.png` `compare.png` `REPORT.md` (+หมายเหตุกลุ่ม) มาที่ host แล้ว · docker compose ใน container ปิดแล้ว
- **ถัดไป = ขั้น 4 บน host** (ดู scope-th handoff ข้อ Next 2): `cd app && npm install && npx playwright install chromium && TEST_MODE=1 docker compose up -d --build` แล้วรันชุดเต็มแบบเบื้องหลัง · ถามผู้ใช้ก่อนใช้โทเคนแก้บั๊ก
- 2026-11-16 (session ใหม่) **ขั้น 4 เริ่ม**: npm install ✅ · chromium ✅ · `TEST_MODE=1 docker compose up -d --build` บน host ✅ (health ok) · ตรวจแล้ว test ครบ 51 TC (ชื่อขึ้นต้นรหัส TC) · รัน Playwright รอบ 1 → log `app/run4-1.log`
- ขั้น 4 รอบ 1: **49/51 ผ่าน** · ล้ม 2 ข้อ → จำแนกแล้ว (ยังไม่แก้ รอผู้ใช้อนุมัติ):
  - TC-DASH-03 = **test ผิด**: เว็บส่ง PDF ถูก (curl: 200 application/pdf มีบรรทัด kpi ครบ ตาม BR-26) แต่ test ใช้ waitForResponse กับลิงก์ดาวน์โหลด ซึ่ง Chromium ไม่ส่งเหตุการณ์ response → ค้าง 3 นาที · แก้: ตรวจ content-type ด้วย page.request แทน
  - TC-NFR-02 = **test ผิด (เครื่อง Mac)**: Control+A บน Mac ไม่เลือกทั้งหมด → qty กลายเป็น 11 → เว็บปิดปุ่ม to-upload-btn ถูกต้องตาม BR-04 (1–5) · พิสูจน์แล้ว: ControlOrMeta+A ได้ qty=1 ปุ่มใช้ได้ · แก้: เปลี่ยนเป็น ControlOrMeta+A
- แก้ test 2 จุดใน `app/tests/e2e/part-b.spec.ts` (ไม่แตะค่าคาดหวัง): NFR-02 `Control+A`→`ControlOrMeta+A` · DASH-03 เลิก waitForResponse (ดาวน์โหลดไม่ส่ง response/route/CDP event) → เก็บ dl.url() แล้ว GET ตรวจ Content-Type **หลัง** ขั้น Audit (Audit ยัง = 3) · รัน 2 ข้อผ่าน · รันชุดเต็มรอบ 2 → `app/run4-2.log`
- ถัดไป: ถ้า 51/51 → คัดลอก `app/test-report/results.json` + `html/` → `week2/egov-eservice/test-report/` (index.html) + ทำ GIF ของ TC P1 จาก video.webm ด้วย ffmpeg
- รอบ 2: 50/51 · TC-WORKFLOW-03 ล้ม (รอบ 1 ผ่าน = ไม่นิ่ง) = **test ผิด**: คลิก claim-btn → เว็บ POST แล้ว location.reload() แต่ test goto ทันที → ERR_ABORTED · แก้: รอ load ก่อน goto · ทดสอบซ้ำ 3/3 ผ่าน · รันชุดเต็มรอบ 3 → `app/run4-3.log`
- **ขั้น 4 ✅ 51/51** (รอบ 3 และ 4) · รอบ 4 เปิด recordVideo ใน newCtxPage (helpers-b.ts, part-a.spec.ts) เพื่อทำ GIF · ผลอยู่ `week2/egov-eservice/test-report/` (results.json · index.html · gif/ 40 ไฟล์ · SUMMARY.md ตารางคำตอบ) · ขนาด 102MB (trace/วิดีโอใน data/) ระวังตอน push git · สคริปต์ GIF: ffmpeg concat webm → fps4 640px
- **ถัดไป = ขั้น 5 (BUG_MODE B01–B12)**: ทำสคริปต์วน `BUG_MODE=Bxx TEST_MODE=1 docker compose up -d` → `npx playwright test --reporter=json` เก็บผลแต่ละรอบ → เทียบ BUGS.md → BUG-HUNT.md
- 2026-11-16 (session ใหม่) **ขั้น 5 เริ่ม**: สคริปต์ `app/scripts/bug-hunt.sh` รัน B01–B12 + B03,B07 + B01,B05,B09 + none (≈35 นาที) · ผลแยกไฟล์ `app/bug-hunt/<mode>.json/.log` · สรุป `app/bug-hunt/summary.log` · ถัดไป: อ่าน summary → แก้ test/เว็บถ้าบั๊กไม่ถูกจับ → เขียน `BUG-HUNT.md`
- 22:43 **ขั้น 5 ✅ จับได้ 12/12** · รวมบั๊ก = union พอดี · ปิดบั๊กกลับ 51/51 · B03 ทำ TC-NOTI-02 ล้มด้วย (ผลข้างเคียงกลไกเดียวกับ SLA-03 ยอมรับได้) · ไม่ต้องแก้เว็บ/test · เขียน `BUG-HUNT.md` แล้ว
- **การบ้านขั้น 0–5 ครบ** · เหลือ: ส่ง QUESTIONS.md ส่วน ง. ให้ TA · ระวัง test-report 102MB ตอน push git
