# API Contract (v1)

สัญญากลางระหว่าง Frontend/Simulator (nackjub) และ Backend/AI (พี่) — ถ้าจะเปลี่ยน ให้แก้ไฟล์นี้ก่อนแล้วตกลงกัน
Base URL: `http://localhost:8787` (mock) · JSON ทั้งหมด · เปิด CORS ให้โดเมนหน้าเว็บ · Production ต้องเป็น HTTPS

## POST /api/telemetry
รับค่าจากเซนเซอร์ คืนผลวิเคราะห์

Request
```json
{ "building": "ECC Building", "roomNumber": "402", "current": 20, "voltage": 220, "motion": false }
```
| field | type | กติกา |
|---|---|---|
| building | string | จำเป็น, ≤ 40 ตัวอักษร |
| roomNumber | string | 1–12 ตัว: ตัวอักษร ตัวเลข ช่องว่าง `-` `_` |
| current | number | 0–100 (A) |
| voltage | number | 0–500 (V) ไม่ส่งมา = 220 |
| motion | boolean | true = มีคนอยู่ |

200 OK
```json
{
  "room": { "id": "ecc-building-402", "building": "ECC Building", "roomNumber": "402",
            "current": 20, "motion": false, "status": "Energy Waste",
            "zone": "Simulated", "lastUpdated": 1793235298812 },
  "status": "Energy Waste",
  "anomaly": false,
  "reasons": ["กระแส 20.0 A ≥ 7 A และไม่มีคนอยู่"],
  "monthly": { "kwh": 1355.2, "baht": 5691.8, "co2": 677.6 }
}
```
`status` เป็น `"Normal"` หรือ `"Energy Waste"` เท่านั้น

400 Bad Request (ข้อมูลไม่ถูกต้อง / JSON เสีย / body เกิน 10 KB)
```json
{ "errors": ["current must be a number between 0 and 100 (A)"] }
```

## GET /api/rooms
`{ "rooms": [ Room, ... ] }` — สถานะล่าสุดของทุกห้อง (Room รูปแบบเดียวกับ `room` ด้านบน)

## GET /api/readings?limit=30&roomId=ecc-building-402
`{ "readings": [ { "id", "roomId", "building", "roomNumber", "current", "power", "status", "timestamp" } ] }`
`power` หน่วย kW, `timestamp` เป็น epoch ms, เรียงเก่า → ใหม่, limit 1–500

## GET /api/health
`{ "ok": true }`

## หมายเหตุ
- Dashboard เรียก `/api/rooms` และ `/api/readings` ทุก 2 วินาที (polling) ถ้าต้องการ real-time เพิ่ม `GET /api/events` (SSE) ภายหลัง
- ถ้า API ไม่ตอบ Dashboard แสดง OFFLINE และคำนวณในเครื่องต่อเพื่อให้เดโมไม่ล่ม
