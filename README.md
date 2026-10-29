# K-SES — ระบบติดตามการใช้พลังงาน

แดชบอร์ดจำลองการติดตามการใช้ไฟในห้องเรียน พร้อม API สำหรับรับ telemetry และวิเคราะห์ Energy Waste

## ข้อกำหนด

- Node.js ≥ 22.5 เนื่องจากเซิร์ฟเวอร์ใช้ `node:sqlite` ซึ่งมากับ Node.js รุ่นนี้ โมดูลยังเป็น Experimental และแสดง `ExperimentalWarning` ตอนรันเทสต์
- Git

## เริ่มใช้งาน

ติดตั้ง dependencies จากโฟลเดอร์ `project/`:

```bash
cd project
npm ci
```

เปิด API จริงที่พอร์ตเริ่มต้น `8787`:

```bash
npm run server
```

ส่ง telemetry จำลองเข้า API (เปิด terminal อีกหน้าต่างและใช้โฟลเดอร์ `project/`):

```bash
npm run simulate
```

เปิดแดชบอร์ด:

```bash
npm run dev
```

หาก `VITE_API_URL` ว่างหรือไม่ได้กำหนด แดชบอร์ดจะใช้ local mode โดยจำลองข้อมูลในเบราว์เซอร์ ไม่จำเป็นต้องเปิด backend

## ตัวแปรตั้งค่า

| ตัวแปร | ค่าเริ่มต้น | ใช้สำหรับ |
|---|---|---|
| `PORT` | `8787` | พอร์ต API; แพลตฟอร์มโฮสต์อาจกำหนดค่านี้ให้ |
| `DB_FILE` | `server/data/k-ses.db` | ตำแหน่งไฟล์ฐานข้อมูล SQLite เมื่อสั่งรันจาก `project/` |
| `CORS_ORIGINS` | ว่าง | รายการ origin คั่นด้วยจุลภาค; ค่าว่างยอมรับทุก originเพื่อการพัฒนาเท่านั้น ต้องกำหนด allow-list ก่อน deploy |
| `BASELINE_K` | `6` | ค่าความไวของ L3 baseline |
| `MAX_BODY_BYTES` | `10000` | ขนาด body สูงสุด (10 KB) |
| `READINGS_MAX_LIMIT` | `500` | จำนวน readings สูงสุดต่อคำขอ |
| `VITE_API_URL` | ว่าง | URL API ที่ฝังตอน build; ว่างคือ local mode |

กำหนดตัวแปรใน environment ก่อนรันคำสั่งที่เกี่ยวข้อง ค่า `VITE_API_URL` เป็น build-time variable

## เอกสาร

- [สัญญา API](project/API_CONTRACT.md)
- [วิธี deploy](DEPLOY.md)
- [ผลประเมิน L1/L2/L3](project/EVALUATION.md)

ระบบใช้ข้อมูลจำลอง ตัวเลขค่าไฟและคาร์บอนเป็นข้อสมมติ และ `npm run evaluate` วัดผลด้วยข้อมูลสังเคราะห์ ไม่ใช่ข้อมูลวัดจริงจาก KMITL หากยังไม่มี L4 ให้เรียกระบบว่า rule-based + statistical anomaly detection ไม่ใช่ machine learning