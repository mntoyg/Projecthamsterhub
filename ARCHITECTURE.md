# K-SES — บันทึกการออกแบบของที่นั่ง Backend และ AI (พี่)

เอกสารนี้บันทึกการออกแบบของที่นั่งเราเท่านั้น ภาพรวมระบบ การแบ่งงาน และ milestones อยู่ใน [`project/ARCHITECTURE.md`](project/ARCHITECTURE.md) ซึ่งหัวหน้าโปรเจกต์ดูแล ส่วนจุดเชื่อมต่อระหว่างสองฝั่งอยู่ใน [`project/API_CONTRACT.md`](project/API_CONTRACT.md) หากเอกสารนี้ขัดกับสองไฟล์ดังกล่าว ให้ยึดเอกสารของทีมและสัญญาเป็นหลัก ต้องตกลงและแก้เอกสารเหล่านั้นก่อน แล้วจึงปรับเอกสารนี้

## 0. ความรับผิดชอบ

อ้างอิง `project/ARCHITECTURE.md` §1.1:

| ส่วนงาน | ผู้รับผิดชอบ |
| --- | --- |
| Frontend Dashboard (React) | nackjub |
| IoT Simulator (script + ปุ่มในหน้าเว็บ) | nackjub |
| **Backend API + Database** | **พี่** |
| **AI: วิเคราะห์ Energy Waste** | **พี่** |
| API Contract | ตกลงร่วมกัน |
| CI / SonarCloud / Deploy | ตกลงร่วมกัน |

Milestones ของเรา อ้างอิง §8 ของเอกสารทีม:

- **M1 — Express backend + validation + SQLite + API ตามสัญญา**: เสร็จเมื่อ integration tests ผ่านใน CI
- **M3 — L3 baseline รายชั่วโมงของสัปดาห์ + ชุดประเมินผล Precision / Recall / F1** เปรียบเทียบ L1 กับ L1+L2 และ L1+L2+L3

M0 และ M0.5 เป็นงานที่ nackjub ส่งมอบแล้ว ส่วน M2 (เชื่อม dashboard กับ API ของเรา) และ M4/M5 ไม่ใช่ขอบเขตงานของเรา

**UI อยู่นอกขอบเขตและให้อ่านอย่างเดียว**: `project/src/components/**`, `project/src/App.tsx`, `project/src/main.tsx`, `project/index.html`, `project/src/index.css`, `project/tailwind.config.js`, `project/postcss.config.js` เราทำตามสัญญา API และไม่แก้ dashboard

## 1. สิ่งที่มีอยู่แล้ว (ตรวจวัดเมื่อ 2026-10-29)

Dashboard แบบ single-page ใช้ React 18.3 + TypeScript 5.5 + Vite 7 + Tailwind 3.4 มีซอร์สประมาณ 1,400 บรรทัด ทำงานได้ **โดยไม่มี backend**: ค่าเริ่มต้นของ `VITE_LOCAL_MODE` เปิดอยู่ state เก็บใน `localStorage` และ `AutoSim.tsx` ขับ simulator ในเบราว์เซอร์

สามส่วนจาก v3 ที่เกี่ยวข้องกับเราโดยตรง:

- **`project/src/lib/config.ts`** ส่งออก `API_URL` จาก `VITE_API_URL` ถ้าค่าว่างจะเป็น local mode
- **`project/src/App.tsx`** เรียก `GET /api/rooms` และ `GET /api/readings` ทุก 2 วินาทีเมื่อกำหนด `API_URL` หาก API ไม่ตอบ จะใช้ข้อมูลล่าสุดและแสดง `OFFLINE` การหยุดทำงานของ backend ทำให้การสาธิตด้อยลง แต่ไม่ทำให้ dashboard ใช้งานไม่ได้
- **`project/server/mock-api.ts`** เป็น mock API ของ nackjub ที่ทำตามสัญญา และมี `project/server/api.test.ts` ทดสอบอยู่ **ไฟล์ทดสอบนี้เป็นข้อกำหนดที่รันได้ของ M1** บริการจริงของเราต้องผ่านโดยไม่แก้เทสต์

`project/src/engine/energy.ts` เป็นโมดูลบริสุทธิ์ ไม่มี I/O: กฎ L1 (`current >= 7 A && !motion`) และ z-score ของ L2 (`MIN_HISTORY = 5`, `Z_LIMIT = 2.5`, เงื่อนไขป้องกัน `std < 0.05`) รวมถึงสูตรคำนวณการประหยัด (4.2 THB/kWh, 0.5 kgCO₂/kWh, 14 h × 22 days) เซิร์ฟเวอร์ import ไฟล์เดียวกัน ไม่เขียนกฎซ้ำ เพื่อให้ทั้งสองฝั่งมีนิยาม "Energy Waste" แบบเดียวกัน

สิ่งที่ไม่มีและเราไม่ได้วางแผนทำ: ระบบยืนยันตัวตน ฐานข้อมูล cloud ระบบหลายเซิร์ฟเวอร์ และการควบคุมฮาร์ดแวร์จริง Supabase ยังเชื่อมอยู่ใน `project/src/lib/supabase.ts` และ `project/supabase/migrations/` แต่ไม่ใช่ทิศทางของทีม ซึ่งใช้ REST API กับ SQLite ให้ถือ Supabase เป็น legacy

## 2. การออกแบบของเรา

### 2.1 ข้อตัดสินใจ

| # | ข้อตัดสินใจ | เหตุผล |
| --- | --- | --- |
| D-1 | **Node.js + Express + SQLite** (`node:sqlite`), TypeScript, รันด้วย `tsx` | กำหนดตามสถาปัตยกรรมทีม §2 และ §5 ทำให้เซิร์ฟเวอร์ import `engine/energy.ts` ของ frontend ได้โดยตรง ไม่ต้องมีกฎซ้ำสองชุด เซิร์ฟเวอร์ต้องใช้ Node.js ≥ 22.5; `node:sqlite` ยังเป็น Experimental และแสดง `ExperimentalWarning` ตอนรันเทสต์ |
| D-2 | **ใช้ polling ไม่ใช้ SSE ใน v1** เรียก `GET /api/rooms` และ `GET /api/readings` ทุก 2 วินาที ตามที่ dashboard ทำอยู่ | ฝั่ง client พร้อมใช้งานแล้ว SSE (`GET /api/events`) เป็น endpoint เพิ่มหลัง M1 ผ่าน และยังเป็น open decision ข้อ 2 ในเอกสารทีม |
| D-3 | **ไม่มี LLM** คำว่า AI ในระบบหมายถึง L1 rule → L2 z-score → L3 EWMA baseline → L4 Isolation Forest ที่เป็นทางเลือก | เป็นไปตาม §4 ของเอกสารทีม และหลักการเรียกชื่ออย่างซื่อตรง: หากยังไม่มี L4 ให้เรียกว่า *rule-based + statistical anomaly detection* ห้ามเรียกว่า machine learning |
| D-4 | **`project/server/api.test.ts` เป็น acceptance test** บริการจริงต้องแทนที่ `mock-api.ts` และผ่านเทสต์ชุดเดียวกัน | ใช้ตัดสิน M1 ด้วยผลเทสต์ที่ตรวจสอบได้ |
| D-5 | ข้อเสนอก่อนหน้าในไฟล์นี้ (Python + FastAPI, OpenAI insight layer, schema Supabase แบบ normalized) ถูกยกเลิกและไม่ได้ทำ | ทีมเลือก Node + Express + SQLite แล้ว การเพิ่ม stack อีกชุดหรือ LLM ที่ไม่มี milestone รองรับเพิ่มต้นทุนโดยไม่จำเป็น |

### 2.2 ขอบเขตโมดูล

เซิร์ฟเวอร์ใช้ `node:sqlite` ซึ่งมากับ Node.js และต้องใช้ Node.js รุ่น 22.5 ขึ้นไป โมดูลยังอยู่ในสถานะ Experimental และแสดง `ExperimentalWarning` ตอนรันเทสต์

```
project/server/
  index.ts          Express app, CORS allow-list, body cap 10 KB และ mount routes
  routes/
    telemetry.ts    POST /api/telemetry
    rooms.ts        GET  /api/rooms
    readings.ts     GET  /api/readings
    health.ts       GET  /api/health
  validate.ts       กฎตรวจ field ตามสัญญา แยกฟังก์ชันตาม field และคืน errors[]
  store.ts          ที่เดียวที่มี SQL และใช้ prepared statements เท่านั้น
  analyze.ts        เรียก src/engine/energy.ts เพิ่ม L3 และคืน status + reasons + anomaly
  db.ts             สร้าง schema, migrations และ connection
  errors.ts         ลำดับชั้น AppError; routes แปลง error และไม่ปล่อย error อื่นหลุดออกไป
```

| โมดูล | สิ่งที่ห้ามทำ |
| --- | --- |
| `routes/*` | มีกฎธุรกิจหรือเข้าถึง SQL |
| `validate.ts` | เขียนฐานข้อมูลหรือบันทึกค่าของผู้ใช้แบบตรงตัว |
| `store.ts` | ปล่อย exception จาก `node:sqlite` หลุดออกจากขอบเขตโมดูล |
| `analyze.ts` | ทำ I/O นอกเหนือจากผ่าน `store.ts` หรือคืนข้อความที่แปลตามภาษา; ให้คืน reason **codes** พร้อมข้อความภาษาไทยที่สัญญาระบุไว้แล้ว |

ค่าขีดจำกัดและข้อสมมติเป็น configuration พร้อมค่าเริ่มต้น ไม่กระจายเป็นค่าคงที่ในโค้ด: `WASTE_THRESHOLD_A=7`, `MIN_HISTORY=5`, `Z_LIMIT=2.5`, `HISTORY_WINDOW=20`, `MAX_BODY_BYTES=10240`, `READINGS_MAX_LIMIT=500`, `PORT=8787`, `CORS_ORIGINS=` (ระบุรายการ origin อย่างชัดเจน)

### 2.3 API

ยึด `project/API_CONTRACT.md` ทุกประการ ตารางนี้สรุปเพื่อให้ผู้รีวิวเทียบเอกสารได้:

| Method | Path | ผลลัพธ์ |
| --- | --- | --- |
| POST | `/api/telemetry` | `{room, status, anomaly, reasons[], monthly{kwh,baht,co2}}` หรือ `400 {errors[]}` |
| GET | `/api/rooms` | `{rooms: Room[]}` |
| GET | `/api/readings?limit=&roomId=` | `{readings: Reading[]}` — `power` หน่วย kW, `timestamp` เป็น epoch ms, เรียงจากเก่าไปใหม่, `limit` 1–500 |
| GET | `/api/health` | `{ok: true}` |
| GET | `/api/events` | SSE ซึ่งเป็นทางเลือกและทำหลัง M1 |

กฎ validation ตามสัญญา: ต้องมี `building` ยาวไม่เกิน 40 ตัวอักษร; `roomNumber` ยาว 1–12 ตัว ใช้ตัวอักษร ตัวเลข ช่องว่าง `-` และ `_`; `current` อยู่ระหว่าง 0–100; `voltage` อยู่ระหว่าง 0–500 และค่าเริ่มต้น 220; `motion` เป็น boolean; `status` มีได้เฉพาะ `"Normal"` หรือ `"Energy Waste"`

### 2.4 แบบจำลองข้อมูล (SQLite)

เป็นไปตาม ER diagram ในเอกสารทีม §5

```sql
rooms(id TEXT PRIMARY KEY, building TEXT NOT NULL, room_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Normal', zone TEXT NOT NULL DEFAULT 'Simulated',
      updated_at INTEGER NOT NULL)

readings(id INTEGER PRIMARY KEY AUTOINCREMENT,
         room_id TEXT NOT NULL REFERENCES rooms(id),
         current REAL NOT NULL, voltage REAL NOT NULL, motion INTEGER NOT NULL,
         status TEXT NOT NULL, ts INTEGER NOT NULL)
-- เพิ่มข้อมูลต่อท้ายเท่านั้น: ไม่มี UPDATE หรือ DELETE path ใน store.ts
-- INDEX (room_id, ts DESC), INDEX (ts DESC)

events(id INTEGER PRIMARY KEY AUTOINCREMENT,
       room_id TEXT REFERENCES rooms(id),
       level TEXT NOT NULL, message TEXT NOT NULL, ts INTEGER NOT NULL)
-- telemetry ที่ถูกปฏิเสธทุกครั้งต้องบันทึก events พร้อมเหตุผล ตาม §6 ของเอกสารทีม
```

`id` เป็น slug ตามสัญญา (เช่น `ecc-building-402`) สร้างฝั่งเซิร์ฟเวอร์จาก `building` และ `roomNumber` ห้ามรับค่าจาก request body

### 2.5 AI / การวิเคราะห์

| ระดับ | วิธี | สถานะ | หมายเหตุ |
| --- | --- | --- | --- |
| L1 | กฎ: `!motion && current >= 7 A` | มีใน `engine/energy.ts` | เซิร์ฟเวอร์ import มาใช้ |
| L2 | z-score เทียบ 20 readings ล่าสุดของห้อง ต้องมีอย่างน้อย 5 ค่า, `z > 2.5`, ข้ามเมื่อ `std < 0.05` | มีแล้ว | เซิร์ฟเวอร์ import มาใช้ |
| L3 | EWMA baseline แยกตามห้องและชั่วโมงของสัปดาห์ จาก `readings` | **เสร็จแล้ว**, `server/baseline.ts` | แยกช่วงที่มีการใช้งานปกติกับค่าผิดปกติ เป็นระดับเดียวที่ตรวจการสิ้นเปลืองต่ำกว่า 7 A ได้ |
| L4 | Isolation Forest หรือพยากรณ์โหลด | เป็นทางเลือก ทำเมื่อ L1–L3 เสร็จและมีข้อมูลเพียงพอ | หากยังไม่ทำ ห้ามเรียกว่า machine learning |

L3 เก็บค่าเฉลี่ยและความแปรปรวน EWMA แยกตาม bucket `(room, hour-of-week)` รวม 168 bucket ต่อห้อง ใน `baselines` จะนำเข้าเฉพาะ readings ที่ประเมินเป็น `Normal` เพื่อไม่ให้ข้อมูลสิ้นเปลืองย้อนกลับไปสอนตัวตรวจจับว่าการสิ้นเปลืองเป็นเรื่องปกติ หาก L3 แจ้งเตือน จะรายงานเป็น `Energy Waste` เช่นเดียวกับ L1 เพราะผู้ปฏิบัติงานต้องจัดการกับสถานการณ์เดียวกัน

### การประเมินผล (M3)

`npm run evaluate` เล่นชุดข้อมูลสังเคราะห์ที่ติด label ตามลำดับเวลา โดยแต่ละตัวตรวจจับเห็นเฉพาะข้อมูลก่อนหน้า แล้วเขียนผลลง [`project/EVALUATION.md`](project/EVALUATION.md) ผลปัจจุบันใช้ข้อมูล 4 สัปดาห์, 6 ห้อง, 16,128 readings และ seed 42:

| ระดับ | Precision | Recall | F1 | Recall ของการสิ้นเปลืองที่ **ต่ำกว่า** 7 A |
| --- | ---: | ---: | ---: | ---: |
| L1 | 100.0% | 53.5% | 69.7% | 0.0% (0/492) |
| L1+L2 | 90.1% | 66.9% | 76.8% | 29.5% (145/492) |
| **L1+L2+L3** | **90.5%** | **74.5%** | **81.7%** | **45.5% (224/492)** |

L3 เพิ่ม Recall 7.6 จุดจาก L1+L2 โดย Precision ใกล้เคียงเดิม L1 ตรวจจับกลุ่มสุดท้ายไม่ได้ตามหลักการ เพราะสร้างข้อมูลกลุ่มนั้นให้อยู่ต่ำกว่า threshold คงที่

**วิธีเลือก `k`**: เมื่อไล่ทดสอบ threshold พบว่า Recall คงที่ 74.5% ตั้งแต่ k=3 ถึง k=6 ขณะที่ Precision เพิ่มจาก 75.2% เป็น 90.5% ค่า k ที่ต่ำกว่าจึงเพิ่ม false positive โดยไม่เพิ่ม Recall เลือก k=6 เป็นค่าที่ดีที่สุดใน {5, 6} สำหรับ seed 42, 7, 99 และ 2026 ดังนั้นค่าเริ่มต้นของ `BASELINE_K` คือ 6 ค่านี้ปรับให้เหมาะกับตัวสร้างข้อมูลชุดนี้และมีข้อจำกัดตามนั้น

**หลักความซื่อตรงสองข้อที่บังคับใช้ในรายงาน**: ข้อมูลเป็น **ข้อมูลสังเคราะห์** สร้างโดย `scripts/evaluate.ts` ไม่ใช่ข้อมูลวัดจาก KMITL และรายงานระบุข้อเท็จจริงนี้ตั้งแต่ต้น อีกทั้งรายงานนับด้วยว่า L3 ตัดสินได้กี่ครั้งและข้ามเพราะประวัติน้อยกี่ครั้ง เพราะผล “ไม่ทำงาน” กับ “ทำงานแล้วไม่พบ” อาจดูเหมือนกันในตาราง การรัน harness รุ่นแรกพบ `judged: 0, skipped: 4032` เนื่องจากตัวสร้างข้อมูลปล่อยหนึ่ง reading ต่อชั่วโมง ทำให้ bucket รายชั่วโมงไม่มีทางถึง `minSamples` นี่เป็นข้อผิดพลาดของตัวสร้างข้อมูล ไม่ใช่ตัวตรวจจับ เพราะอุปกรณ์จริงส่งข้อมูลทุกไม่กี่วินาที

อัตราค่าไฟ ปัจจัยการปล่อยคาร์บอน และชั่วโมง idle เป็นข้อสมมติ และต้องระบุให้เห็นทุกครั้งที่แสดงตัวเลขเหล่านี้

### 2.6 การทนต่อข้อผิดพลาด

อ้างอิง §6 ของเอกสารทีม ซึ่งเป็นข้อกำหนดที่ต้องผ่านการประเมิน:

| ข้อมูล/เหตุการณ์ | พฤติกรรม |
| --- | --- |
| `current`/`voltage` ติดลบ, `NaN`, มากกว่า 100 A หรือ 500 V | ตอบ `400` พร้อม error ของ field บันทึกแถว `events` และเซิร์ฟเวอร์ต้องทำงานต่อ |
| `roomNumber` ว่างหรือมีอักขระต้องห้าม | ตอบ `400` พร้อมเหตุผล |
| body ไม่ใช่ JSON หรือใหญ่กว่า 10 KB | ตอบ `400` โดยไม่ทำให้เซิร์ฟเวอร์ล่ม |
| ประวัติห้องน้อยกว่า 5 readings | ข้าม L2 และรายงานผลจาก L1 เท่านั้น |
| เขียนฐานข้อมูลไม่สำเร็จ | ตอบ `500` พร้อม correlation id; รายละเอียดลง log ไม่ส่งให้ client |

**ห้ามเกิดความล้มเหลวแบบเงียบ**: สิ่งที่ถูกปฏิเสธ ข้าม หรือตัดทอนต้องรายงานกลับใน `errors[]` และบันทึกใน `events` พร้อมเหตุผล array ว่างหมายถึง “ไม่พบข้อมูล” เท่านั้น

### 2.7 ความปลอดภัย — OWASP สำหรับ stack นี้

`node:sqlite` มากับ Node.js และต้องใช้รุ่น 22.5 ขึ้นไป โมดูลยังเป็น Experimental และแสดง `ExperimentalWarning` ตอนรันเทสต์

| OWASP | ข้อกำหนด |
| --- | --- |
| A01 | API ไม่มี authentication ตามการออกแบบ (เอกสารทีม §5: ระยะแรกไม่มี login) จึงใช้ input validation และการไม่มี endpoint ทำลายข้อมูลเป็นมาตรการควบคุม: ไม่มี route `DELETE` และ `store.ts` ไม่มี path สำหรับแก้หรือลบ `readings` |
| A02 | อ่าน secret จาก environment หรือ `project/.env` ซึ่งอยู่ใน git-ignore; `project/.env.example` มีเพียง placeholder ห้ามบันทึก secret ลง log หรือส่งกลับใน error |
| A03 | ใช้ prepared statements ผ่าน `node:sqlite` เท่านั้น ห้ามประกอบ SQL ด้วย template string ห้ามใช้ `child_process` พร้อม shell; หากจำเป็นต้องสร้าง subprocess ให้ส่ง argument เป็น array และห้ามใช้ `eval` |
| A04 | ระบบรายงานผล ไม่ควบคุมฮาร์ดแวร์ ไม่มี endpoint สั่งอุปกรณ์ |
| A05 | `CORS_ORIGINS` เป็น allow-list ที่ระบุ origin ชัดเจน ห้ามใช้ `*` เมื่อ deploy จำกัด body size และห้ามลดมาตรการความปลอดภัยเพื่อให้เทสต์ผ่าน |
| A06 | pin dependency floors ใน `package.json` ตรวจและรายงานผล `npm audit`; ห้ามละเลย ปัจจุบันเอกสารเดิมบันทึกไว้ 14 รายการ (high 9) ซึ่งต้องติดตาม ไม่ใช่ยอมรับเงียบ ๆ |
| A09 | ใช้ structured logs พร้อม correlation id และบันทึก rejection ทุกครั้งใน `events` |
| A10 | เซิร์ฟเวอร์ไม่ fetch URL จาก payload ใด ๆ |

บทเรียนสำคัญของ repository นี้: **ห้าม commit `.env` และห้าม commit `dist/`** repository ต้นน้ำเคยมี bundle ที่ build แล้วซึ่งบรรจุ Supabase URL และ anon key ที่ใช้งานจริง `.gitignore` ที่ root จึงบล็อกทั้งสองรายการ และไม่ได้คัดลอก `.env` จาก hand-off zip เข้ามาใน repository

## 3. Gate ตรวจสอบ

ยังถือว่างานไม่เสร็จจนกว่าจะรันคำสั่งต่อไปนี้จาก `project/` และรายงาน output จริง ผลที่บอกเล่าโดยไม่มี output ไม่ถือเป็นผลตรวจสอบ

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

ตั้งแต่ M1 เป็นต้นไป `npm test` ชุดเดียวกันต้องรวม integration tests ใน `project/server/api.test.ts` และทดสอบกับบริการจริง ไม่ใช่ mock โดย CI ทำงานนี้ใน `.github/workflows/ci.yml` ตามลำดับ typecheck → lint → test → build

การรันคู่คำสั่งในเครื่อง:

```bash
npm run mock-api     # หรือ real server เมื่อพร้อมใช้งาน โดยใช้พอร์ต 8787
npm run simulate     # ส่ง telemetry เข้า API
```

การชี้ dashboard ไปยัง backend ใช้ตัวแปร build-time: กำหนด `VITE_API_URL` ก่อน `npm run build` หากหน้าเว็บให้บริการผ่าน HTTPS ต้องใช้ API ผ่าน HTTPS ด้วย และ origin ของเว็บต้องอยู่ใน CORS allow-list

**หมายเหตุ runner บน Windows**: ห้ามครอบเครื่องมือ Node ด้วย `uv` เพราะ `uv run` ล้มด้วย `Failed to query Python interpreter: Access is denied. (os error 5)` เนื่องจาก uv ตรวจพบ stub ของ Microsoft Store ที่ไม่มีข้อมูลจริงใต้ `%LOCALAPPDATA%\WindowsApps\` ซึ่งเป็นปัญหาสภาพแวดล้อม ทุกครั้งที่รายงานให้ระบุ runner ที่ใช้

### การรายงานผล

ทุกข้ออ้างต้องมีคำสั่งและ output ที่วัดได้ทั้งก่อนและหลัง แสดง test failure ตามจริง และระบุขั้นตอนที่ข้ามไว้อย่างชัดเจน ให้ assert ที่ identity ไม่ใช่จำนวน เช่น เทสต์ต้องตรวจว่า reason ใดเกิดขึ้น ห้ามตรวจเพียง `reasons.length === 2`