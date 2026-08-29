# TalentLens AI — Cloud Deployment Guide (100% FREE)

> **Stack**: Frontend → **Netlify** (free) | Backend → **Hugging Face Spaces** (free, Docker) | Database → **SQLite** (auto-seeded on start)

---

## Why Hugging Face Spaces?

| Platform | RAM | ML Support | Cost |
|----------|-----|-----------|------|
| Render free | 512 MB | ❌ (torch = OOM) | Free |
| Railway | 512 MB | ❌ | $5 credit/mo |
| **HF Spaces** | **16 GB** | ✅ torch, spacy, etc. | **FREE forever** |

HF Spaces is a platform by Hugging Face specifically for ML-powered apps.
Docker SDK gives you full control, 16GB RAM, and it's completely free.

---

## Architecture

```
User Browser
     │
     ▼
┌──────────────────────────┐
│  Netlify (Frontend)      │  ← React + Vite static build
│  yourapp.netlify.app     │
└──────────┬───────────────┘
           │ HTTPS API calls
           ▼
┌──────────────────────────┐
│  HF Spaces (Backend)     │  ← FastAPI in Docker, 16GB RAM
│  username-name.hf.space  │  ← SQLite auto-seeded on start
└──────────────────────────┘
```

---

## Step 1 — Create a Hugging Face Account

1. Go to [huggingface.co](https://huggingface.co) → **Sign Up** (free)
2. Verify your email

---

## Step 2 — Create a New Space for the Backend

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space)
2. Fill in:
   | Field | Value |
   |-------|-------|
   | **Owner** | Your HF username |
   | **Space name** | `talentlens-backend` |
   | **SDK** | **Docker** |
   | **Visibility** | Public |
3. Click **Create Space**

Your Space URL will be:
```
https://huggingface.co/spaces/YOUR_USERNAME/talentlens-backend
```

And your API URL (for frontend) will be:
```
https://YOUR_USERNAME-talentlens-backend.hf.space
```

---

## Step 3 — Push Backend Code to HF Space

HF Spaces uses Git. You'll push just the `backend/` folder.

```powershell
# Clone your new empty Space
git clone https://huggingface.co/spaces/YOUR_USERNAME/talentlens-backend hf-backend-deploy
cd hf-backend-deploy

# Copy backend files into it
Copy-Item -Recurse "d:\AI Projects\TalentLens-AI\backend\*" . -Force

# IMPORTANT: Rename the HF Dockerfile to be the default
# (HF Spaces reads README_HF.md as README.md and Dockerfile.hf as Dockerfile)
Move-Item README_HF.md README.md -Force
Move-Item Dockerfile.hf Dockerfile -Force

# Remove local dev files that shouldn't be pushed
Remove-Item -Recurse -Force .venv, __pycache__, talentlens.db, uploads -ErrorAction SilentlyContinue

# Commit and push — HF will auto-build the Docker image
git add .
git commit -m "feat: deploy TalentLens AI backend to HF Spaces"
git push
```

> ⏳ **Build takes 5–15 minutes** (downloading torch + spacy). Watch logs at:
> `https://huggingface.co/spaces/YOUR_USERNAME/talentlens-backend` → **Logs** tab.

---

## Step 4 — Set Environment Variables on HF Spaces

In your Space → **Settings** → **Repository secrets** → Add:

| Secret Name | Value |
|-------------|-------|
| `JWT_SECRET_KEY` | Run `python -c "import secrets; print(secrets.token_hex(32))"` locally and paste result |
| `CORS_ALLOWED_ORIGINS` | `https://YOUR-APP.netlify.app` (fill after Step 6) |

> Leave `DATABASE_URL` and `REDIS_URL` empty — SQLite is used automatically on HF Spaces.
> The app auto-seeds demo data on every cold start.

---

## Step 5 — Test the Backend

Once the Space shows **Running** (green):

1. Open: `https://YOUR_USERNAME-talentlens-backend.hf.space/health`
   - Should return: `{"status": "ok", "service": "TalentLens AI Backend"}`
2. Open: `https://YOUR_USERNAME-talentlens-backend.hf.space/docs`
   - Swagger UI should load with all endpoints

---

## Step 6 — Deploy Frontend to Netlify

### 6a. Update the API URL

Edit [`frontend/.env.production`](./frontend/.env.production):
```env
VITE_API_URL=https://YOUR_USERNAME-talentlens-backend.hf.space
```
Commit and push this change to your **GitHub repo**.

### 6b. Connect Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect **GitHub** → select `TalentLens-AI` repo
3. Build settings (auto-detected from `netlify.toml`):
   | Field | Value |
   |-------|-------|
   | **Base directory** | `frontend` |
   | **Build command** | `npm run build` |
   | **Publish directory** | `dist` |
4. Click **Deploy site**

---

## Step 7 — Update CORS on HF Spaces

Once Netlify gives you your URL (e.g., `https://talentlens-abc.netlify.app`):

1. Go to your HF Space → **Settings** → **Repository secrets**
2. Update `CORS_ALLOWED_ORIGINS` = `https://talentlens-abc.netlify.app`
3. Restart the Space (Settings → Factory reboot) to apply

---

## Demo Credentials (Auto-Seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@talentlens.ai` | `password123` |
| Recruiter | `recruiter@talentlens.ai` | `password123` |

> ⚠️ **Note**: HF Spaces free tier resets the container occasionally.
> When it restarts, demo data is **automatically re-seeded** — no action needed.

---

## Verification Checklist

```
[ ] https://YOUR_USERNAME-talentlens-backend.hf.space/health → {"status": "ok"}
[ ] https://YOUR_USERNAME-talentlens-backend.hf.space/docs   → Swagger UI loads
[ ] https://your-app.netlify.app                             → LandingPage loads
[ ] Login with recruiter@talentlens.ai / password123         → Dashboard works
[ ] Login with admin@talentlens.ai / password123             → Admin panel works
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Space shows "Building" for >20 min | Check Logs tab — usually a pip install error |
| Frontend shows CORS error | Update `CORS_ALLOWED_ORIGINS` in HF Spaces secrets |
| Login works but dashboard is empty | Space restarted — wait 30 sec for seed to complete |
| Space shows "Runtime error" | Check logs — likely an import error in Python code |
| Netlify shows blank page | Check Netlify deploy logs for build errors |
| HF Space sleeps after inactivity | Click the Space URL to wake it (free tier sleeps after ~48h) |
