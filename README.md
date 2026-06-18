https://smart-attend-api.onrender.com

https://smart-attend-three.vercel.app/
# smart-attend


# SmartAttend AI

SmartAttend AI is a mobile-first smart attendance system built with Flask, React, SQLite, JWT auth, notifications, analytics, and face verification hooks using DeepFace with ArcFace + RetinaFace.

## Stack

- Backend: Flask, Flask-JWT-Extended, Flask-SQLAlchemy, Flask-CORS
- Frontend: React, Vite, Tailwind CSS, Recharts
- Database: SQLite
- Face verification: DeepFace with ArcFace + RetinaFace, with a local fallback embedding path for lighter environments
- Export: openpyxl for Excel, reportlab for PDF
- Deployment: Render for backend, Vercel for frontend

## Seeded Credentials

- `admin / Admin@123`
- `advisor / Advisor@123`
- `student / Student@123`
- `dhanush / Dhanush@123`
- `Chiranjeevi / Chiru@123`

## Seeded Sample Data

- Classes: `CSE-A`, `AI-DS-B`
- Advisor allocation:
  - `advisor` -> `CSE-A`
  - `Chiranjeevi` -> `AI-DS-B`
- Students:
  - `student` -> roll no `CSE6001`, class `CSE-A`
  - `dhanush` -> roll no `CSE6002`, class `CSE-A`
- Seeded attendance and advisor notifications are inserted automatically on first run.

## Project Structure

- `backend/`: Flask API, models, seed data, exports, face pipeline
- `frontend/`: React + Vite app with role-based dashboards and mobile UI
- `render.yaml`: Render backend blueprint
- `vercel.json`: Vercel frontend config

## Local Run

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Backend runs on `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend runs on `http://localhost:5173`.

Set `VITE_API_URL=http://localhost:5000` in `frontend/.env`.

## Render Deployment

1. Push the repository to GitHub.
2. Create a new Render Blueprint deployment and point it to this repo.
3. Render will read [`render.yaml`](/D:/codex/smart_attend/render.yaml).
4. Set `APP_BASE_URL` in the backend service to your Render backend URL, for example `https://smartattend-ai-backend.onrender.com`.
5. Keep `PORT` dynamic; the app already reads Render's port automatically.
6. If you want full DeepFace support in Render, make sure the image has the native dependencies required by DeepFace/TensorFlow.

## Vercel Deployment

1. Import the `frontend` directory as a Vercel project.
2. Build settings are already covered by [`vercel.json`](/D:/codex/smart_attend/vercel.json).
3. Add `VITE_API_URL` in Vercel and point it to your Render backend URL.
4. Redeploy after setting the environment variable.

## Notable Behavior

- Database seeding runs automatically only when the database is empty.
- Face re-enrollment fully replaces old embeddings.
- Duplicate face prevention checks across students before saving new face data.
- Verification returns debug values: distance, threshold, frames used, and stored face preview.
- Profile image URLs are generated from the current host or `APP_BASE_URL` so deployment stays host-safe.
- Report exports are authenticated and downloaded as PDF or Excel from the frontend.

## API Overview

- Auth: `/auth/login`, `/auth/register`, `/auth/profile`
- Attendance: `/attendance/verify-face`, `/attendance/mark`, `/attendance/history`, `/attendance/stats`, `/attendance/alerts`, `/attendance/alerts/unread-count`, `/attendance/alerts/mark-read`
- Admin: `/admin/stats`, `/admin/classes`, `/admin/students`, `/admin/students/<id>`, `/admin/students/<id>/face`, `/admin/advisors`, `/admin/attendance/history`, `/admin/attendance/export`, `/admin/analytics`
- Advisor: `/advisor/dashboard/stats`, `/advisor/students`, `/advisor/announcements`, `/advisor/reports/history`, `/advisor/reports/export`, `/advisor/analytics`

## Notes on Face Verification

- Production mode is designed for ArcFace + RetinaFace through DeepFace.
- In environments where DeepFace cannot initialize, the backend falls back to a lightweight embedding routine so flows remain testable.
- For best results, enroll multiple frames per student and submit multiple frames during verification.
