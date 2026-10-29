# แผนเดโม K-SES — 30 ต.ค. 2026

เขียนเมื่อ 29 ต.ค. 2026 · branch `docs/demo-plan` (แตกจาก `docs/architecture-plan` ที่ `5bef6c4`)

สถานะทุกข้อในเอกสารนี้มาจากคำสั่งที่รันจริงบนเครื่องนี้วันที่ 29 ต.ค. 2026 ข้อที่ยังไม่ได้ยืนยันระบุไว้ตรง ๆ

---

## 1. เป้าหมายของเดโม

### ต้องพิสูจน์ให้ผู้ฟังเห็น

| # | สิ่งที่ต้องพิสูจน์ | พิสูจน์อย่างไรบนหน้าจอ |
|---|---|---|
| 1 | ระบบรับ telemetry จริงผ่าน HTTP แล้ววิเคราะห์ได้ ไม่ใช่หน้าเว็บที่คำนวณเอง | dashboard แสดง `API: ONLINE` และตัวเลขเปลี่ยนตามที่ simulator ยิงเข้า API |
| 2 | ตัดสินใจได้และ **อธิบายเหตุผลได้** | `reasons[]` ที่ API ตอบกลับ เช่น `"กระแส 20.0 A ≥ 7 A และไม่มีคนอยู่"` |
| 3 | ทนข้อมูลเสีย ไม่ล่ม | POST ข้อมูลผิด → `400` พร้อม `errors[]` แล้ว `/api/health` ยังตอบ `200` |
| 4 | ตรวจจับได้มากกว่าเกณฑ์คงที่ | ตาราง Precision/Recall/F1 จาก `project/EVALUATION.md`: L1 → L1+L2 → L1+L2+L3 ได้ F1 69.7% → 76.8% → 81.7% |
| 5 | คุณภาพโค้ดตรวจสอบได้ | gate ผ่านครบ 5 ขั้น และ CI บน GitHub Actions |

### จะไม่พูดถึง

- **ไม่อ้างว่า deploy ขึ้นออนไลน์แล้ว** — ยังไม่มี URL สาธารณะ เดโมรันบนเครื่อง
- **ไม่เรียกระบบว่า machine learning** — ยังไม่มี L4 ให้เรียกว่า *rule-based + statistical anomaly detection*
- **ไม่อ้างว่าข้อมูลเป็นข้อมูลจริงของ สจล.** — เป็นข้อมูลสังเคราะห์ทั้งหมด
- **ไม่อ้างว่าฐานข้อมูลเก็บถาวร** — SQLite เป็นไฟล์ในเครื่อง/คอนเทนเนอร์ เหมาะกับการสาธิต
- ไม่พูดถึง ESP32 ว่าทำแล้ว (ยังเป็น optional ที่ยังไม่ได้ทำ)
- ไม่พูดถึง Telegram alert, SSE (`/api/events` ตอบ `404` ตามสัญญาปัจจุบัน) และ SonarCloud (ไฟล์ตั้งค่าพร้อม ยังไม่ได้เชื่อมบัญชี)

---

## 2. Runbook ก่อนเดโม

รันทั้งหมดจาก `D:\code-project\ProjectHamsterHub\Projecthamsterhub` รวมเวลาประมาณ **12–15 นาที** ถ้าไม่ติดปัญหา

### ข้อ 0 — ตรวจ Node.js (10 วินาที)

```bash
node --version
```

ต้องได้ **≥ 22.5** เพราะ API ใช้ `node:sqlite` (ยืนยันแล้ว: เครื่องนี้ `v22.23.4`)

### ข้อ 1 — ปิด process ค้างจากเมื่อวาน (1 นาที)

สำคัญ: วันนี้ `npm ci` พังด้วย `EPERM` เพราะมี `esbuild.exe` ค้างอยู่ล็อกไฟล์ไว้ และมี API server ค้างบน port 8787 สองตัว

```bash
Get-Process esbuild,node -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path
```

ถ้าเห็น `esbuild.exe` ที่ path ชี้มาที่ `Projecthamsterhub\project\node_modules` หรือ `node` ที่ยึด port 8787 ให้ปิดก่อน:

```bash
Get-NetTCPConnection -LocalPort 8787 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### ข้อ 2 — ตรวจ branch และ working tree (30 วินาที)

```bash
git branch --show-current; git status --short; git log --oneline -3
```

`git status --short` ต้องไม่มีบรรทัดใด ๆ

### ข้อ 3 — รัน gate ให้ครบ (5–7 นาที)

```bash
cd project && npm ci && npm run typecheck && npm run lint && npm test && npm run build
```

ที่ถูกต้อง: `added 372 packages` · typecheck/lint ไม่พิมพ์ error · `Test Files 5 passed (5)` `Tests 73 passed (73)` · `✓ built in ~10s`

> คำเตือน `esbuild@0.28.2 (postinstall ... blocked)` เป็นเรื่องปกติของ npm 12 และ Vite build ยังผ่าน ไม่ต้องแก้

### ข้อ 4 — เปิด API ด้วยฐานข้อมูลใหม่ (30 วินาที)

**ต้องใช้ไฟล์ฐานข้อมูลใหม่ทุกครั้ง** ไม่งั้นห้องและ readings จากการซ้อมเมื่อวานจะค้างอยู่บนหน้าจอ

```bash
cd project; $env:PORT='8799'; $env:CORS_ORIGINS='http://localhost:5173'; $env:DB_FILE='server/data/demo-30oct.db'; npm run server
```

รอบรรทัด `{"level":"info","event":"listening","port":8799,...}` เปิดทิ้งไว้ในหน้าต่างนี้

### ข้อ 5 — ตรวจ API ก่อนขึ้นเวที (1 นาที)

เปิดหน้าต่างใหม่แล้วรันทีละข้อ ข้อ 3 **ต้องได้ 400** และข้อ 5 **ต้องไม่พิมพ์อะไรเลย**

```bash
curl -s http://localhost:8799/api/health
curl -s -X POST http://localhost:8799/api/telemetry -H "Content-Type: application/json" -d "{\"building\":\"ECC Building\",\"roomNumber\":\"402\",\"current\":20,\"voltage\":220,\"motion\":false}"
curl -s -o nul -w "%{http_code}\n" -X POST http://localhost:8799/api/telemetry -H "Content-Type: application/json" -d "{\"building\":\"ECC\",\"roomNumber\":\"\",\"current\":-1,\"motion\":\"yes\"}"
curl -s -D - -o nul -H "Origin: http://localhost:5173" http://localhost:8799/api/health | findstr /i access-control-allow-origin
curl -s -D - -o nul -H "Origin: https://evil.example" http://localhost:8799/api/health | findstr /i access-control-allow-origin
```

### ข้อ 6 — เปิด dashboard ต่อกับ API (1 นาที)

```bash
cd project; $env:VITE_API_URL='http://localhost:8799'; npm run dev
```

เปิด `http://localhost:5173` ต้องเห็นแถบบนขวาเป็น **`API: ONLINE`** ถ้าเป็น `OFFLINE` แปลว่า API ไม่ตอบ กลับไปข้อ 4

### ข้อ 7 — เปิด simulator (30 วินาที)

```bash
cd project; $env:API_URL='http://localhost:8799'; npm run simulate -- after
```

ต้องเห็นบรรทัด `200 ... -> Energy Waste` ไหลออกมาทุก 2 วินาที เปิดทิ้งไว้

### ข้อ 8 — เตรียมแท็บสำรอง (2 นาที)

1. เปิด `project/EVALUATION.md` ค้างไว้ในแท็บหนึ่ง (ตาราง Precision/Recall/F1)
2. เปิดหน้า GitHub Actions ของ repo ค้างไว้ (หลักฐาน CI ผ่าน)
3. ถ่าย screenshot dashboard ตอนทำงานปกติเก็บไว้ 2–3 รูป (ดูหัวข้อ 4)

---

## 3. ลำดับการเดโม 10 นาที

| นาที | ทำอะไร | พูดอะไร |
|---|---|---|
| 0:00–0:45 | หน้า dashboard นิ่ง ๆ ชี้ที่การ์ดบน | "ปัญหาคือห้องเรียนเปิดไฟ/แอร์ทิ้งไว้ ระบบนี้ตรวจจับจากค่ากระแสกับสัญญาณการมีคนอยู่ แล้วแจ้งเตือนแบบ real-time" |
| 0:45–2:00 | ชี้ที่แถบ `API: ONLINE` แล้วสลับไปหน้าต่าง simulator | "ตัวเลขบนหน้าจอไม่ได้คำนวณในเบราว์เซอร์ แต่มาจาก REST API ที่รันแยก — นี่คือ simulator ยิง `POST /api/telemetry` ทุก 2 วินาที แล้ว API ตอบ `Energy Waste` กลับมา" |
| 2:00–3:30 | ในแผง **IoT DEVICE SIMULATOR** ตั้ง `ECC Building / 402`, กระแส **20 A**, กด Motion Sensor ให้เป็น **ไม่มีคน** แล้วกด **ส่งสัญญาณ** | "ไม่มีคนอยู่แต่ใช้ไฟ 20 แอมป์ — ระบบตัดสินว่า Energy Waste และ **บอกเหตุผลได้**: กระแส 20.0 A ≥ 7 A และไม่มีคนอยู่ ไม่ใช่กล่องดำ" |
| 3:30–4:30 | กด Motion Sensor ให้เป็น **มีคน** แล้วส่งซ้ำด้วยกระแสเดิม | "ค่ากระแสเท่าเดิมแต่มีคนอยู่ ระบบตอบ Normal — เกณฑ์คือ *ไม่มีคน* และ *กระแสเกิน 7 A* พร้อมกัน" |
| 4:30–5:30 | สลับไปหน้าต่าง terminal รัน curl ข้อมูลผิด (ข้อ 5.3 ใน runbook) แล้วรัน `/api/health` ซ้ำ | "ส่งข้อมูลพัง — ติดลบ ห้องว่าง motion เป็นสตริง ระบบตอบ `400` พร้อมบอกว่าผิดตรงไหนทุกข้อ แล้วเซิร์ฟเวอร์ยังตอบ `200` อยู่ ไม่ล่ม" |
| 5:30–7:30 | เปิด `project/EVALUATION.md` ชี้ที่ตารางผล | "เราวัดผลบนชุดข้อมูลสังเคราะห์ 16,128 readings 6 ห้อง 4 สัปดาห์ ที่รู้เฉลยล่วงหน้า กฎอย่างเดียวได้ F1 69.7% เติม z-score เป็น 76.8% เติม baseline รายชั่วโมงเป็น 81.7% — ที่เพิ่มคือกลุ่มที่ใช้ไฟเกินปกติของห้องตัวเองแต่ยังต่ำกว่า 7 แอมป์ จับได้ 45.5% จากเดิม 0%" |
| 7:30–8:30 | เปิดหน้า GitHub Actions | "typecheck, lint, test 57 ข้อ และ build ผ่านใน CI ทุก commit" |
| 8:30–10:00 | กลับหน้า dashboard | ปิดด้วยข้อจำกัด (หัวข้อ 5) + ขั้นต่อไป: deploy, ESP32 จริง, L4 |

### ถ้าเหลือ 5 นาที — ตัดอะไรออก

เก็บไว้: **2:00–3:30** (ยิง 20 A ไม่มีคน + เหตุผล), **4:30–5:30** (ข้อมูลพัง ระบบไม่ล่ม), **5:30–6:30** (ตารางผลแบบย่อ ชี้แค่ตัวเลข F1 สามค่า)

ตัดออก: ช่วงเกริ่นนำ (ย่อเหลือ 20 วินาที), ช่วง 3:30–4:30 (ทดสอบกรณีมีคน), ช่วง GitHub Actions, ช่วงปิดท้ายแบบยาว

---

## 4. แผนสำรอง

| ถ้าเกิด | ทำอะไร | เตรียมไว้ล่วงหน้า |
|---|---|---|
| **API ล่ม / ไม่ตอบ** | ปิด `VITE_API_URL` แล้วเปิด dashboard ใหม่ → เข้าสู่ **local mode** ที่ engine รันในเบราว์เซอร์ เดโมเดินต่อได้เต็มรูปแบบ ยกเว้นต้องพูดตรง ๆ ว่าตอนนี้คำนวณในเครื่อง | รัน `cd project; Remove-Item Env:VITE_API_URL; npm run dev` ซ้อมไว้ 1 ครั้งคืนนี้ |
| **API ล่มกลางคัน ไม่ทันปิด** | dashboard จะแสดง `OFFLINE` เองและคำนวณในเครื่องต่อ ไม่ต้องทำอะไร พูดว่า "นี่คือ fault tolerance ที่ออกแบบไว้" | ไม่ต้องเตรียม — เป็นพฤติกรรมที่มีอยู่แล้ว |
| **เน็ตหลุด** | เดโมทั้งหมดรันบน `localhost` ไม่ต้องใช้เน็ต **ยกเว้น**แท็บ GitHub Actions | บันทึก screenshot หน้า GitHub Actions ที่ผ่านเขียว เก็บเป็นไฟล์ไว้ |
| **`npm ci` พัง `EPERM`** | อย่าเพิ่งลบ `node_modules` — ให้ **rename** ออกไปนอก repo แล้วติดตั้งใหม่ (วิธีนี้ใช้ได้จริงวันนี้) | `cd project; Move-Item node_modules ..\..\_broken_nm; npm ci` |
| **`npm ci` พังแบบอื่น** | ข้ามทั้งหมด ใช้ `node_modules` ที่ติดตั้งไว้แล้วคืนนี้ ห้ามรัน `npm ci` ในวันเดโม | ติดตั้งให้เสร็จคืนนี้แล้วอย่าแตะอีก |
| **port 8787/8799 ถูกยึด** | เปลี่ยน `PORT` เป็นเลขอื่น เช่น `8801` แล้วแก้ `VITE_API_URL` ให้ตรง (dashboard อ่านค่านี้ตอน build/dev start ต้อง restart `npm run dev`) | จด 2 port สำรองไว้: `8801`, `8802` |
| **เครื่องพรีเซนต์ไม่ใช่เครื่องนี้** | ไม่มีทางรันได้ทัน — ต้องใช้เครื่องนี้ หรือ deploy ล่วงหน้า | ยืนยันเรื่องเครื่องให้ชัดคืนนี้ |

### screenshot / วิดีโอสำรอง — ควรเตรียม

**ควรเตรียม** ใช้เวลา ~10 นาที คืนนี้ ถ่าย 4 รูป:

1. dashboard ตอน `API: ONLINE` ทำงานปกติ
2. ผล `POST /api/telemetry` 20 A ไม่มีคน ที่เห็น `reasons[]` ภาษาไทย
3. ผล `400` พร้อม `errors[]` และ `/api/health` ที่ยังตอบ `200`
4. หน้า GitHub Actions เขียว

เพิ่มเติม: อัดคลิปหน้าจอ 2 นาทีของลำดับ 2:00–5:30 ไว้ด้วย ถ้ามีเวลา (เป็น "มีก็ดี" ไม่ใช่ "ต้องมี")

---

## 5. คำถามที่ผู้ฟังน่าจะถาม + คำตอบที่ตรงความจริง

**ถาม: ใช้ AI หรือ machine learning อะไร**
ตอบ: ยังไม่ใช่ machine learning ตอนนี้เป็น **rule-based + statistical anomaly detection** 3 ระดับ — L1 กฎคงที่ (ไม่มีคน + กระแส ≥ 7 A), L2 z-score เทียบประวัติ 20 ค่าล่าสุดของห้องนั้น, L3 baseline EWMA แยกตามห้องและชั่วโมงของสัปดาห์ การทำโมเดล ML (L4) เป็นขั้นถัดไปที่ยังไม่ได้ทำ

**ถาม: ข้อมูลที่โชว์เป็นข้อมูลจริงของ สจล. ไหม**
ตอบ: **ไม่ใช่ เป็นข้อมูลสังเคราะห์ทั้งหมด** สร้างจาก simulator และสคริปต์ `scripts/evaluate.ts` ยังไม่ได้ติดเซนเซอร์จริงในอาคาร

**ถาม: ประหยัดเงินได้เท่าไร / ลดคาร์บอนได้เท่าไร**
ตอบ: ตัวเลขบนหน้าจอเป็น **การประมาณจากข้อสมมติ** ไม่ใช่ค่าที่วัดได้ ใช้ P = V × I แล้วคูณด้วยค่าไฟ 4.2 บาท/หน่วย, 0.5 kgCO₂/kWh และสมมติว่าห้องว่าง 14 ชม./วัน × 22 วัน/เดือน ถ้าได้ตัวเลขจริงของ สจล. มา จะแทนค่าแล้วตัวเลขจะเปลี่ยน

**ถาม: ทำไมเกณฑ์เป็น 7 แอมป์**
ตอบ: เป็นค่าตั้งต้นที่ตั้งเป็น configuration ไม่ได้ฝังในโค้ด ต้องปรับตามขนาดห้องและอุปกรณ์จริง จุดนี้คือเหตุผลที่เราเติม L2 และ L3 เข้าไป เพราะเกณฑ์คงที่ตัวเดียวจับ `subtle_waste` ไม่ได้เลย (Recall 0%)

**ถาม: แม่นแค่ไหน**
ตอบ: บนชุดข้อมูลสังเคราะห์ 16,128 readings เต็มระบบได้ Precision 90.5% / Recall 74.5% / F1 81.7% — และย้ำว่านี่คือผลบนชุดข้อมูลที่เราสร้างเอง ไม่ใช่ผลภาคสนาม

**ถาม: เข้าใช้ได้จากที่ไหน เปิดเว็บได้เลยไหม**
ตอบ: **ยังไม่ได้ deploy ขึ้นออนไลน์** ตอนนี้รันบนเครื่อง มี Dockerfile และคู่มือ deploy พร้อมแล้ว (`DEPLOY.md`) ขั้นต่อไปคือเลือกผู้ให้บริการและปล่อยขึ้นจริง

**ถาม: ระบบสั่งปิดไฟเองได้ไหม**
ตอบ: ไม่ได้ และตั้งใจไม่ทำในเฟสนี้ — ระบบ **รายงานอย่างเดียว ไม่ควบคุมฮาร์ดแวร์** ไม่มี endpoint ใดที่สั่งงานอุปกรณ์

**ถาม: ข้อมูลเก็บไว้นานแค่ไหน**
ตอบ: เก็บใน SQLite เป็นไฟล์เดียว เหมาะกับการสาธิต ยังไม่ใช่ฐานข้อมูลที่ออกแบบมาเก็บระยะยาว ถ้า deploy บน free tier ที่ไม่มี disk ถาวร ข้อมูลจะหายทุกครั้งที่ restart

**ถาม: ใช้ ESP32 จริงหรือยัง**
ตอบ: ยังไม่ใช้ ตอนนี้จำลองทั้งหมด ESP32 อยู่ใน M4 ซึ่งเป็น optional และยังไม่ตัดสินใจ

**ถาม: ความปลอดภัยเป็นอย่างไร**
ตอบ: เฟสนี้ API ไม่มีระบบล็อกอินโดยตั้งใจ การควบคุมอยู่ที่ validation — ปฏิเสธข้อมูลผิดทุกกรณี, ใช้ prepared statement เท่านั้น, ตาราง readings เป็น append-only ไม่มีเส้นทางลบ, จำกัด body ที่ 10 KB และ CORS เป็น allow-list ที่ตรวจแล้วว่าปฏิเสธ origin แปลกปลอมจริง

---

## 6. งานที่ต้องทำให้เสร็จก่อนเดโม

### ต้องมี

| ลำดับ | งาน | เวลาที่ประเมิน | ทำทันคืนนี้ไหม |
|---|---|---|---|
| 1 | ~~**แก้บั๊กห้องซ้ำ**~~ — **เสร็จแล้ว** ที่ `fe354be` บน branch `fix/duplicate-seeded-rooms` `seed()` ใช้ `roomId(room.building, room.roomNumber)` แล้ว ยืนยันบนหน้าจอ: `ROOMS MONITORED 6`, `5 of 6 rooms`, zone ถูกต้องทุกห้อง | — | **เสร็จ** |
| 1.5 | **push branch ขึ้น fork เพื่อให้ CI รัน** — ยังไม่เคยมี CI รันบนโค้ดชุดนี้เลย ถ้าไม่ push จะอ้างบนเวทีว่า "CI ผ่าน" ไม่ได้ | 5 นาที + รอ CI ~3 นาที | **ทัน** |
| 2 | ซ้อมเดโมเต็มรอบตาม runbook ข้อ 0–8 จับเวลา | 20 นาที | **ทัน** |
| 3 | ถ่าย screenshot สำรอง 4 รูป ตามหัวข้อ 4 | 10 นาที | **ทัน** |
| 4 | ซ้อม fallback: ปิด `VITE_API_URL` แล้วเปิด dashboard ใหม่ ดูว่า local mode ใช้ได้ | 5 นาที | **ทัน** |
| 5 | ยืนยันว่าเดโมใช้เครื่องนี้ ไม่ใช่เครื่องอื่น | 1 นาที (ถาม) | **ทัน** |

### มีก็ดี

| งาน | เวลาที่ประเมิน | ทำทันคืนนี้ไหม |
|---|---|---|
| Deploy API ขึ้น Render + build dashboard ชี้ไปที่ URL จริง | 1.5–3 ชั่วโมง รวมแก้ปัญหา และต้องสมัครบัญชี | **ไม่แนะนำให้ทำคืนก่อนเดโม** — เสี่ยงเจอ cold start 1 นาทีกลางเวที และข้อมูลหายทุก restart บน free tier ถ้าจะทำ ให้ทำหลังเดโม |
| ~~แก้ประเด็นชื่อ acceptance test~~ — **เสร็จแล้ว** ที่ `c1c7a89` `api.test.ts` รัน contract suite ชุดเดียวกัน (`api-contract-suite.ts`) กับทั้ง real Express + SQLite API และ mock จึงเป็น acceptance test ของบริการจริงตามถ้อยคำใน `AGENTS.md` แล้ว | — | **เสร็จ** |
| อัดคลิปหน้าจอ 2 นาที | 20 นาที | ทัน ถ้าทำข้อ "ต้องมี" เสร็จก่อน |
| เชื่อม SonarCloud | 30–60 นาที | ทำหลังเดโม |
| ปิด Open Decisions: ผู้ให้บริการ deploy, ESP32 จริงหรือจำลอง | — | **ตัดสินใจคืนนี้ได้ 1 ข้อ**: สำหรับเดโมพรุ่งนี้ ใช้ตัวจำลองทั้งหมด ส่วนผู้ให้บริการ deploy ตัดสินใจหลังเดโม |

### ทำไม่ทันคืนนี้ — พูดตรง ๆ

- **L4 / machine learning** ไม่ทันและไม่ควรเริ่ม ถ้าเริ่มคืนนี้จะได้ของที่อธิบายไม่ได้บนเวที ให้ใช้คำว่า *rule-based + statistical anomaly detection* ตามเดิม
- **ESP32 ตัวจริง** ไม่ทัน ไม่ต้องพูดถึงว่าทำแล้ว
- **Deploy แบบ production จริงที่มี persistent disk + HTTPS + CORS allow-list ที่ถูกต้อง** ไม่ทันในคืนเดียวแบบที่มั่นใจได้

---

## 7. ความเสี่ยง เรียงตามผลกระทบ

| # | ความเสี่ยง | ผลกระทบถ้าเกิด | วิธีลดความเสี่ยง |
|---|---|---|---|
| 1 | **เดโมจาก branch ที่ยังไม่ merge และยังไม่ push** — งานทั้งหมดกองอยู่บน `fix/duplicate-seeded-rooms` ซึ่งซ้อนบน `docs/demo-plan` ซ้อนบน `docs/architecture-plan` ไม่มีอะไรอยู่บน `main` และไม่มีอะไรขึ้น remote | ถ้าเครื่องพัง/ไฟล์หาย ไม่มีสำเนาที่ไหนเลย และอ้างไม่ได้ว่า CI ผ่านบนโค้ดชุดนี้ | push branch ขึ้น fork คืนนี้ (ไม่ใช่ `main`) แล้วรอ GitHub Actions ขึ้นเขียว |
| 1.5 | ~~ห้องซ้ำ 12 ห้อง~~ | — | **ปิดแล้ว** ที่ `fe354be` ยืนยันบนหน้าจอ 6 ห้อง zone ถูกต้อง |
| 2 | **`npm ci` พัง `EPERM` ในวันเดโม** | ไม่มี `node_modules` เปิด server/dashboard ไม่ได้เลย เดโมจบ | ติดตั้งให้เสร็จคืนนี้แล้ว **ห้ามรัน `npm ci` ซ้ำในวันเดโม** ถ้าจำเป็นให้ rename `node_modules` ออกไปแทนการลบ (runbook ข้อ 1 และหัวข้อ 4) |
| 3 | **ใช้เครื่องอื่นพรีเซนต์** | ติดตั้งใหม่ไม่ทัน และยังเสี่ยง Node < 22.5 | ยืนยันเรื่องเครื่องคืนนี้ ถ้าต้องใช้เครื่องอื่นจริง ต้องติดตั้งและซ้อมบนเครื่องนั้นคืนนี้ |
| 4 | **ข้อมูลเก่าค้างในฐานข้อมูล** — `server/data/k-ses.db` เก็บห้องและ readings จากการซ้อมสะสม | หน้าจอรกด้วยห้องและกราฟจากเมื่อวาน อธิบายยาก | ใช้ `DB_FILE` ไฟล์ใหม่ทุกครั้ง (runbook ข้อ 4) |
| 5 | **ยังไม่ได้ deploy** และมีคนถามหา URL | ต้องตอบว่ายังไม่มี | ตอบตามหัวข้อ 5 ชี้ว่ามี `Dockerfile` + `DEPLOY.md` พร้อม และผล docker build/run ที่ทดสอบแล้วอยู่ใน `DEPLOY.md` |
| 6 | **port ถูกยึดโดย process ค้าง** — วันนี้เจอ node ค้างบน 8787 สองตัว | server ใหม่ไม่ขึ้น หรือขึ้นแล้วแต่ client คุยกับตัวเก่าที่ config ต่างกัน | runbook ข้อ 1 ปิด process ก่อนเสมอ และใช้ port `8799` ที่ไม่ใช่ค่า default |
| 7 | **`CORS_ORIGINS` ว่าง = ยอมรับทุก origin** | ถ้ามีคนถามเรื่องความปลอดภัยแล้วเราโชว์สดโดยไม่ตั้งค่า จะโชว์ว่ารับทุก origin | ตั้ง `CORS_ORIGINS='http://localhost:5173'` ตอนเปิด server (runbook ข้อ 4) แล้วการทดสอบ origin แปลกปลอมจะไม่คืน header ตามที่ควร |
| 8 | **`npm run evaluate` เขียนทับ `project/EVALUATION.md`** ด้วยรายงานฉบับภาษาอังกฤษ | ถ้าเผลอรันตอนซ้อม ไฟล์ภาษาไทยที่จะเปิดโชว์หายไป | **อย่ารัน `npm run evaluate` ในวันเดโม** ถ้ารันไปแล้วกู้คืนด้วย `git checkout -- project/EVALUATION.md` |
| 9 | **ผู้ฟังถามเจาะเรื่อง ML** | ถ้าตอบคลุมเครือหรือเคลมเกิน จะเสียเครดิต | ท่องคำตอบข้อแรกในหัวข้อ 5 ให้ขึ้นใจ |
| 10 | **`/api/events` ตอบ 404** ถ้ามีคนลองเรียกตามเอกสาร | เอกสารระบุว่าเป็น optional อยู่แล้ว | ไม่พูดถึง SSE ถ้าถูกถามให้ตอบว่า v1 ใช้ polling ทุก 2 วินาที และ SSE เป็นส่วนเสริมที่ต้องตกลงก่อนเพิ่ม |

---

## ภาคผนวก — หลักฐานที่รันจริงวันที่ 29 ต.ค. 2026

| สิ่งที่ตรวจ | คำสั่ง | ผล |
|---|---|---|
| Node.js | `node --version` | `v22.23.4` (ผ่านเกณฑ์ ≥ 22.5) |
| branch / working tree | `git branch --show-current`, `git status --short` | `docs/architecture-plan`, สะอาด |
| เทียบกับ main | `git rev-list --left-right --count origin/main...HEAD` | `0 2` — นำหน้า `origin/main` และ `upstream/main` อยู่ 2 commit ไม่ตามหลัง |
| ติดตั้ง | `npm ci` | ครั้งแรก `EPERM` ที่ `@esbuild/.win32-x64-*/esbuild.exe`; หลัง rename `node_modules` ออก → `added 372 packages` |
| typecheck | `npm run typecheck` | ผ่าน ไม่มี error |
| lint | `npm run lint` | ผ่าน ไม่มี error |
| test | `npm test` | `Test Files 5 passed (5)` · `Tests 57 passed (57)` — **รันซ้ำหลังแก้บั๊ก 29 ต.ค. 13:59 ได้ `Tests 73 passed (73)`** |
| build | `npm run build` | `✓ built in 10.96s` · `dist/assets/index-kvLB6Yn6.js 308.33 kB` |
| evaluation | `npm run evaluate` (seed 42) | ตัวเลขตรงกับ `EVALUATION.md` ทุกค่า: L1 100.0/53.5/69.7, L1+L2 90.1/66.9/76.8, L1+L2+L3 90.5/74.5/81.7 (กู้ไฟล์ภาษาไทยกลับด้วย `git checkout --` แล้ว) |
| API health | `curl /api/health` (port 8799, DB ใหม่) | `200 {"ok":true}` |
| API telemetry | `POST /api/telemetry` 20 A motion=false | `200` · `"status":"Energy Waste"` · `reasons:["กระแส 20.0 A ≥ 7 A และไม่มีคนอยู่"]` · `monthly:{kwh:1355.2,baht:5691.84,co2:677.6}` |
| API ข้อมูลผิด | `POST` body พัง | `400` · `errors[]` 3 ข้อ แล้ว `/api/health` ยัง `200` |
| CORS allow-list | `Origin: http://localhost:5173` / `Origin: https://evil.example` | คืน header ตรงค่า / **ไม่คืน header** ตามที่ควร |
| readings | `GET /api/readings?limit=3` | คืน reading ที่เพิ่งบันทึก พร้อม `power` และ `timestamp` |
| `/api/events` | `GET /api/events` | `404` ตามสัญญาปัจจุบัน |
| simulator | `npm run simulate -- after` | ยิงทุก 2 วินาที ได้ `200 ... -> Energy Waste` ต่อเนื่อง |
| dashboard ต่อ API | `VITE_API_URL=http://localhost:8799 npm run dev` | แสดง `API: ONLINE` และอัปเดตตาม simulator — ก่อนแก้บั๊กแสดง `ROOMS MONITORED 12`; **หลังแก้ที่ `fe354be` แสดง `6` และ `5 of 6 rooms` ถูกต้อง** |

### รอบตรวจซ้ำหลังแก้บั๊ก — 29 ต.ค. 2026 เวลา 13:59–14:05

| สิ่งที่ตรวจ | ผล |
|---|---|
| gate ครบ 5 ขั้นบน `fix/duplicate-seeded-rooms` | `npm ci` ไม่ติด `EPERM` อีก (เพราะปิด vite dev ก่อน) · typecheck/lint ผ่าน · `Tests 73 passed (73)` · `✓ built in 9.21s` |
| API + simulator ด้วย `DB_FILE=server/data/verify-fix.db` ใหม่ | `GET /api/rooms` ได้ **6 ห้อง** ทุกห้อง id เป็น slug (`ecc-building-402` …) และ zone เป็นค่าเดิม Engineering / Information Tech / Electrical / Mechanical ไม่ใช่ `Simulated` |
| dashboard | `API: ONLINE` · `ROOMS MONITORED 6` · `CRITICAL ROOMS ACTIVE 5 of 6 rooms` · กราฟ ENERGY HISTORY มีข้อมูลไหลเข้า |
| acceptance test | `api.test.ts` รัน `registerApiContractSuite` ชุดเดียวกันกับ real Express + SQLite API และ mock |

### ขั้นที่ยังไม่ได้ยืนยัน

- **ยังไม่ได้ deploy** ไม่มีการทดสอบบนโฮสต์สาธารณะใด ๆ ผลที่มีใน `DEPLOY.md` เป็นผล docker build/run ในเครื่องเท่านั้น
- **ไม่ได้รัน `docker build` ซ้ำในรอบนี้** ใช้ผลที่บันทึกไว้ใน `DEPLOY.md` เมื่อ 29 ต.ค. 2026
- **ไม่ได้ปิด process ค้างบน port 8787** — sandbox ปฏิเสธคำสั่ง `Stop-Process` จึงเลี่ยงด้วยการรันบน port `8799` แทน process ค้างทั้งสองตัวยังอยู่และต้องปิดก่อนเดโม
- **ไม่ได้ตรวจสถานะ GitHub Actions ของ commit ล่าสุด** ในรอบนี้ ข้อมูล CI ผ่าน มาจาก `project/ARCHITECTURE.md` หัวข้อ "สถานะการตรวจสอบล่าสุด"

### สถานะ milestone ตามที่ยืนยันได้จริง

| M | งาน | สถานะจริง | หลักฐาน | สิ่งที่ยังค้าง |
|---|---|---|---|---|
| M1 | Backend Express + validation + SQLite + API | **ทำงานได้จริง เหลือ deploy อย่างเดียว** | gate ผ่านครบ 5 ขั้น (73 tests) · API ตอบถูกทุก endpoint ตามสัญญา · validation ปฏิเสธถูก · CORS allow-list ทำงาน · acceptance test รันกับบริการจริงแล้ว · บั๊กห้องซ้ำปิดแล้ว | **ยังไม่ deploy** · ยังไม่ push ขึ้น remote จึงยังไม่มี CI รันบนโค้ดชุดนี้ |
| M2 | เชื่อม Dashboard กับ API + fallback (nackjub) | **เชื่อมได้จริง** | dashboard แสดง `API: ONLINE` และอัปเดตตาม simulator | ยังไม่ได้ทดสอบ fallback `OFFLINE` ด้วยมือในรอบนี้ · งานของ nackjub |
| M3 | L3 baseline + ชุดประเมินผล | **เสร็จและทำซ้ำได้** | `npm run evaluate` seed 42 ให้ตัวเลขตรงกับรายงานทุกค่า | ตัวเลขทั้งหมดมาจากข้อมูลสังเคราะห์ ต้องระบุทุกครั้งที่อ้างอิง |
| M4 | L4, Telegram alert, ESP32 | **ยังไม่ทำ** | — | เป็น optional ไม่ทำก่อนเดโม |

---

คำสั่งตรวจสอบเอกสารนี้:

```bash
cd D:\code-project\ProjectHamsterHub\Projecthamsterhub && git log --oneline -1 docs/demo-plan && git show --stat docs/demo-plan
```
