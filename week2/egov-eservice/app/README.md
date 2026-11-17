# e-Service กลาง เทศบาลนครตัวอย่าง (สมมติ)

```bash
TEST_MODE=1 docker compose up -d --build              # เว็บถูกต้อง
TEST_MODE=1 BUG_MODE=B03 docker compose up -d --build # เปิดบั๊ก (restart ด้วย env ใหม่)
TEST_MODE=1 DB_PATH=./data/app.db node src/app.js     # รันตรงไม่ใช้ docker
```

base URL: http://localhost:3000 · `GET /api/health`
