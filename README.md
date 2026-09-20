# Arts of Finance — Lead & Admission Management System

## Run locally
1. Backend
   ```bash
   cd /app/backend
   pip install -r requirements.txt
   cp .env.example .env    # edit RAZORPAY_KEY_ID/SECRET later
   uvicorn server:app --host 0.0.0.0 --port 8001
   ```
2. Frontend
   ```bash
   cd /app/frontend
   yarn install
   yarn start
   ```
   The frontend proxies through `/api` to the backend on port 8001.

## Access from other office devices on the same Wi-Fi
1. On the host PC find its LAN IP: `ip addr` (Linux) or `ipconfig` (Windows).
2. Ensure the firewall allows inbound port 3000 (frontend) and 8001 (backend).
3. On the receptionist/counsellor device open:
   `http://<PC-IP>:3000`
   Example: `http://192.168.1.42:3000`

## Seeded accounts
- Admin — `admin@artsoffinance.in` / `Admin@12345`
- Counsellor — `priya@artsoffinance.in` / `Counsellor@123`
- Counsellor — `rahul@artsoffinance.in` / `Counsellor@123`
- Reception — `reception@artsoffinance.in` / `Reception@123`

## Razorpay
Fill `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `/app/backend/.env` and restart the backend.
Until then a **Mock provider** is used that auto-marks any created payment as paid after 25s so you can preview the receipt flow.

## Backups
Every day at 02:00 UTC + one-click "Backup now" (Admin → Settings) dumps every Mongo collection to JSON under `/app/backend/backups/`. The last 30 backups are kept.
