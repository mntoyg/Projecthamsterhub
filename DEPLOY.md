ข้อกำหนด Node.js: ต้องใช้ Node.js ≥ 22.5 เพราะ API ใช้ `node:sqlite` ซึ่งมากับ Node.js รุ่นนี้ โมดูลยังเป็น Experimental และแสดง `ExperimentalWarning` ตอนรันเทสต์

# การ Deploy K-SES

ระบบแบ่ง Deploy เป็นสองส่วน:

| ส่วน | รายละเอียด | โฮสต์ที่ใช้ได้ |
| --- | --- | --- |
| Dashboard | ไฟล์ static ที่ได้จาก `npm run build` | Vercel, Netlify, Cloudflare Pages หรือโฮสต์ static อื่น |
| API | บริการ Express + SQLite ใน `project/server` | โฮสต์ที่รองรับ Dockerfile เช่น Render, Railway, Fly.io หรือ VPS |

การเชื่อมต่อใช้ค่าตั้งค่าสองตัว และต้องทำตามลำดับเพราะแต่ละฝั่งต้องใช้ URL ของอีกฝั่ง:

1. Deploy **API** ก่อน ช่วงแรก `CORS_ORIGINS` ว่าง ซึ่งจะยอมรับทุก origin และแสดงคำเตือน ใช้ได้ชั่วคราวระหว่างตั้งค่า แต่ห้ามปล่อยค่านี้ไว้ตอนใช้งานจริง
2. Build **dashboard** โดยกำหนด `VITE_API_URL` ให้เป็น URL ของ API ค่านี้ถูกฝังใน bundle ตอน build หากเปลี่ยนภายหลังต้อง build ใหม่ ไม่ใช่แค่ restart
3. กำหนด `CORS_ORIGINS` ของ API ให้เป็น origin ของ dashboard แล้ว redeploy API

ถ้าเว็บใช้ HTTPS, API ก็ต้องใช้ HTTPS ด้วย เพราะเบราว์เซอร์จะบล็อกหน้า HTTPS ที่เรียก API ผ่าน HTTP และ dashboard จะแสดง `OFFLINE`

---

## API

Docker image ออกแบบให้ย้ายไปใช้กับโฮสต์ใดก็ได้ โดยไม่ผูกกับโฮสต์ใดไว้ใน repository

```bash
cd project
docker build -t k-ses-api .
docker run -p 8787:8787 -e CORS_ORIGINS=https://your-dashboard.example k-ses-api
```

### ตั้งค่าบน Render

ตรวจสอบกับเอกสารของ Render เมื่อ 2026-10-29

1. เลือก **New → Web Service** เชื่อมต่อ GitHub repository นี้ แล้วเลือก branch
2. **Language**: เลือก `Docker` แม้รายการภาษาจะมีภาษาของแอปอยู่ด้วย ตามที่เอกสาร Render ระบุ
3. **Root Directory**: `project` เพราะที่ repository root ไม่มี `package.json`
4. **Dockerfile Path**: `Dockerfile` เอกสาร Render สองหน้าระบุไม่ตรงกัน: หน้า monorepo บอกว่า path อ้างจาก Root Directory แต่ blueprint spec บอกว่าอ้างจาก repo root หาก build หา Dockerfile ไม่พบ ให้ล้าง Root Directory แล้วตั้ง Dockerfile Path เป็น `project/Dockerfile`
5. **Health Check Path**: `/api/health`
6. **Environment variables**: ตั้ง `CORS_ORIGINS` เป็น origin ของ dashboard เมื่อมี URL แล้ว ปล่อย `PORT` ไว้ตามเดิม เพราะ Render กำหนดค่าให้เอง (ค่าเริ่มต้น `10000`) และเซิร์ฟเวอร์อ่านค่านี้ ส่วน `DB_FILE` มีค่าเริ่มต้นที่ใช้งานได้ใน image

Railway และ Fly.io ใช้ Dockerfile เดียวกัน ขั้นตอนในหน้าเว็บของแต่ละผู้ให้บริการอาจต่างกัน

### ข้อจำกัด Render free tier ตามเอกสาร

- **ไม่มี persistent disk**: Web Service แบบ free ไม่สามารถแนบ disk ถาวรได้ ไฟล์ที่เขียนใน container รวมถึง SQLite จะหายเมื่อ redeploy, restart หรือ spin-down
- **หยุดทำงานหลังไม่มี traffic 15 นาที**: การเริ่มใหม่ใช้เวลาประมาณหนึ่งนาที ช่วงนั้นผู้เข้าชมจะเห็นหน้าโหลด และ dashboard แสดง `OFFLINE`
- **ชั่วโมงใช้งานฟรี 750 ชั่วโมงต่อ workspace ต่อเดือน**: เมื่อใช้เกิน บริการ free จะถูกพักจนถึงเดือนถัดไป
- Render อาจ restart บริการ free ได้ทุกเมื่อ
- บริการต้อง bind ที่ `0.0.0.0`; `server/index.ts` กำหนดไว้แล้ว

### ตัวแปรที่ image อ่าน

| ตัวแปร | ค่าเริ่มต้น | รายละเอียด |
| --- | --- | --- |
| `PORT` | `8787` | ใช้ค่าที่โฮสต์กำหนดให้ หากโฮสต์ส่งตัวแปรนี้มา |
| `DB_FILE` | `/data/k-ses.db` | `/data` เป็น volume ภายใน image |
| `CORS_ORIGINS` | *(ว่าง)* | allow-list คั่นด้วยจุลภาค ค่าว่างยอมรับทุก origin และแสดงคำเตือนเมื่อเริ่มทำงาน |
| `BASELINE_K` | `6` | ความไวของ L3 ดู `project/ARCHITECTURE.md` §8 |
| `MAX_BODY_BYTES` | `10000` | ขีดจำกัด body 10 KB ตามสัญญา |
| `READINGS_MAX_LIMIT` | `500` | จำนวน readings สูงสุด |

---

## Dashboard

สร้างไฟล์ static โดยไม่ต้องมีเซิร์ฟเวอร์สำหรับ dashboard

```bash
cd project
VITE_API_URL=https://your-api.example npm run build   # output: project/dist
```

บน Vercel / Netlify / Cloudflare Pages ให้ตั้ง root directory เป็น `project`, build command เป็น `npm run build`, output directory เป็น `dist` และกำหนด `VITE_API_URL` ใน build environment

ถ้าไม่กำหนด `VITE_API_URL` dashboard จะทำงานใน local mode โดย simulator ทำงานในเบราว์เซอร์ ข้อมูลจะไม่แชร์ระหว่างผู้เข้าชมและไม่ต้องมี API โหมดนี้เหมาะกับการสาธิตบนหน้าจอเดียว

---

## ข้อจำกัดที่ควรทราบ

**ฐานข้อมูลเป็นข้อมูลชั่วคราว** SQLite อยู่บน disk ของ container หากใช้ free tier ที่ไม่มี volume ถาวร ทุก deploy และ restart จะลบข้อมูล ห้องสาธิต 6 ห้องจะถูกสร้างใหม่และประวัติทั้งหมดหายไป เหมาะกับการสาธิตเท่านั้น ห้ามอธิบายว่าเป็นฐานข้อมูลที่เก็บข้อมูลถาวร หากต้องการเก็บข้อมูล ให้แนบ persistent disk และตั้ง `DB_FILE` ให้ชี้ไปยัง disk นั้น

**Free tier หยุดพักเมื่อไม่มีการใช้งาน** Web Service แบบ free ของ Render จะ spin-down หลังไม่มี traffic 15 นาที คำขอถัดไปอาจรอ cold start ประมาณหนึ่งนาที ระหว่างนั้น dashboard แสดง `OFFLINE` ก่อนนำเสนอให้ส่งคำขอปลุกบริการล่วงหน้าสักครู่ เลือกแผนที่ไม่หยุดพัก หรือรัน API ในเครื่อง:

```bash
cd project && npm run server
```

---

## ตรวจสอบหลัง Deploy

แทน URL ตัวอย่างแล้วรันทุกข้อ ข้อ 3 และ 4 ต้องล้มเหลวตามที่ระบุ หากได้ 2xx แปลว่าการ Deploy ไม่ทำงานตามเอกสารนี้

```bash
API=https://your-api.example

# 1. ตรวจว่า API ทำงาน
curl -i "$API/api/health"                      # 200 {"ok":true}

# 2. ตรวจการวิเคราะห์ตั้งแต่ต้นจนจบ
curl -i -X POST "$API/api/telemetry" -H 'Content-Type: application/json' \
  -d '{"building":"ECC Building","roomNumber":"402","current":20,"voltage":220,"motion":false}'
                                               # 200, status "Energy Waste"

# 3. ปฏิเสธข้อมูลผิดและตรวจว่าเซิร์ฟเวอร์ยังทำงาน
curl -i -X POST "$API/api/telemetry" -H 'Content-Type: application/json' \
  -d '{"building":"ECC","roomNumber":"","current":-1,"motion":"yes"}'
                                               # 400 with errors[]
curl -i "$API/api/health"                      # still 200

# 4. ตรวจว่า CORS ใช้ allow-list ไม่ใช่ wildcard
curl -sD - -o /dev/null -H "Origin: https://evil.example" "$API/api/health" \
  | grep -i access-control-allow-origin        # must print NOTHING
curl -sD - -o /dev/null -H "Origin: https://your-dashboard.example" "$API/api/health" \
  | grep -i access-control-allow-origin        # must print the dashboard origin
```

ควรรันข้อ 4 ทั้งสองกรณี การไม่เคยทดสอบ origin ที่ไม่ได้รับอนุญาตหมายความว่ายังไม่ได้ทดสอบ CORS allow-list

---

## ผลตรวจสอบในเครื่อง ณ 2026-10-29

Build และรันจาก Dockerfile ใน repository โดยติดตั้งเฉพาะ production dependencies (`npm ci --omit=dev`) และไม่มี devDependencies ใน container:

```
docker build -t k-ses-api:test .                 -> built
docker run -p 8788:8787 -e CORS_ORIGINS=https://example-dashboard.test ...
container status                                 -> Up (healthy)
log: {"level":"info","event":"listening","url":"http://localhost:8787","db":"/data/k-ses.db"}

GET  /api/health                                 -> 200 {"ok":true}
POST /api/telemetry 20 A motion=false            -> 200 "Energy Waste", id ecc-building-402
GET  /api/rooms                                  -> 7 rooms
POST bad payload                                 -> 400
GET  /api/nope                                   -> 404
Origin: https://example-dashboard.test           -> Access-Control-Allow-Origin: https://example-dashboard.test
Origin: https://evil.test                        -> no header (correctly refused)
```

ผลนี้ยืนยันว่า image ทำงานและให้บริการได้ แต่ยังไม่ยืนยันว่าโฮสต์ใดจะรับ image นี้ การตรวจขั้นนั้นต้องทำผ่าน dashboard ของผู้ให้บริการโดยใช้บัญชีของเจ้าของ