# Deployment

CineMind runs as two services:

- **Backend** (Flask API) → Railway
- **Frontend** (Next.js) → Vercel

Deploy the backend first so you have its public URL to give the frontend.

---

## 1. Backend on Railway

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app), **New Project → Deploy from GitHub repo**, and select this repository.
3. Railway auto-detects Python and uses the `Procfile`:
   ```
   web: gunicorn "app:create_app()" --bind 0.0.0.0:$PORT --workers 2 --timeout 120
   ```
   (`$PORT` is injected by Railway; do not hardcode it.)
4. Under **Variables**, add:
   | Key | Value |
   |-----|-------|
   | `TMDB_API_KEY` | your TMDB v3 API key |
   | `CORS_ORIGINS` | your Vercel URL, e.g. `https://cinemind.vercel.app` |
5. Deploy. Once live, copy the public URL (e.g. `https://cinemind-production.up.railway.app`).
6. Verify: open `https://<your-railway-url>/health` — it should return
   `{"status": "ok", "model_loaded": true, "collab_model_loaded": true}`.

> **Note:** The Railway free tier sleeps after inactivity. The first request
> after a sleep wakes the dyno and trains the SVD model, so it may take ~10s.
> Subsequent requests are fast.

---

## 2. Frontend on Vercel

1. Go to [vercel.com](https://vercel.com), **Add New → Project**, and import the same GitHub repo.
2. Set the **Root Directory** to `frontend`. Vercel detects Next.js automatically.
3. Under **Environment Variables**, add:
   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | your Railway backend URL (no trailing slash) |
4. Deploy. Your app will be live at `https://<project>.vercel.app`.

---

## 3. Wire the two together

- Make sure `CORS_ORIGINS` on Railway matches your final Vercel domain exactly
  (scheme + host, no trailing slash). Redeploy the backend after changing it.
- Re-deploy the frontend if you change `NEXT_PUBLIC_API_URL`.

---

## Local development

```bash
# Backend (port 5000)
source .venv/bin/activate
python run.py

# Frontend (port 3000)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.
