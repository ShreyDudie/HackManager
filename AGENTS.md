# AGENTS.md — HackManager AI Agent Guide

## Runtime update (18 November 2026)

The sole active API is in `backend-node/` (Express, TypeScript, Drizzle SQLite, bcrypt and JWT). `services/face-service/` runs Python vision. Use the root README for startup and deployment. The frontend exclusively mounts ExpressRoutes and uses no legacy sync or backend mode flag. `backend/` is an offline recovery snapshot. Preserve original records, media, old password compatibility and the private raw archive. See `docs/migration-status.md` for the import procedure. Treat the older Django layout, commands and endpoints below as historical reference only.

This file provides instructions and context for AI coding agents (such as Antigravity, Claude Code, GitHub Copilot, etc.) working on the **HackManager** codebase.

---

## 🗂 Repository Layout

```
HackManager/
├── backend/               ← Django REST API (Python 3.11)
│   ├── accounts/          ← Core Django app (auth, face, media, sync)
│   │   ├── face_views.py  ← MediaPipe / OpenCV face register & verify
│   │   ├── media_views.py ← PDF upload handler
│   │   ├── models.py      ← Custom User model + SharedState
│   │   ├── serializers.py ← Signup / Login serializers
│   │   ├── urls.py        ← Account-level URL patterns
│   │   └── views.py       ← Login, Signup, State-sync views
│   ├── backend/           ← Django project config
│   │   ├── settings.py    ← All settings: JWT, CORS, WhiteNoise, DB
│   │   ├── urls.py        ← Root URL conf (includes accounts + face)
│   │   ├── wsgi.py        ← WSGI entry point for Gunicorn
│   │   └── asgi.py        ← ASGI (not used currently)
│   ├── face_landmarker.task ← MediaPipe model asset (3.5 MB, binary)
│   ├── Dockerfile         ← Docker container for production
│   ├── requirements.txt   ← Python dependencies
│   ├── runtime.txt        ← Python version pin (python-3.11.9)
│   └── manage.py          ← Django CLI entry point
├── Frontend/              ← React 18 + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── App.tsx        ← Root router and global state sync
│   │   ├── pages/         ← Full page components per route
│   │   │   ├── student/   ← Student-only sub-pages
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── JudgeDashboard.tsx
│   │   │   ├── HackathonDetail.tsx
│   │   │   ├── AdminQRMonitor.tsx
│   │   │   ├── PPTUpload.tsx
│   │   │   ├── Helpline.tsx
│   │   │   └── ...
│   │   ├── components/    ← Shared / reusable UI components
│   │   │   ├── ui/        ← shadcn/ui auto-generated primitives
│   │   │   ├── Navbar.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx ← JWT auth state, login/signup/logout
│   │   ├── services/
│   │   │   └── api.ts     ← Typed API callers (auth, hackathon, AI)
│   │   └── hooks/         ← Custom React hooks
│   ├── .env.example       ← Environment variable template
│   ├── package.json       ← Node deps and npm scripts
│   ├── vite.config.ts     ← Vite config (port 8080, path alias @/)
│   └── tailwind.config.ts ← Tailwind configuration
├── README.md              ← Full project setup and run guide
├── DEPLOYMENT.md          ← Production deployment (Render, Vercel, Docker)
└── AGENTS.md              ← This file
```

---

## 🚀 How to Run (Development)

### Backend (Terminal 1)
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```
**API base URL**: `http://127.0.0.1:8000`

### Frontend (Terminal 2)
```bash
cd Frontend
npm install
cp .env.example .env      # or: Copy-Item .env.example .env
# Edit .env: set VITE_API_URL=http://localhost:8000
npm run dev
```
**App URL**: `http://localhost:8080`

---

## ⚙️ Key Configuration & Conventions

### Backend
- **Python version**: Must be `3.10` or `3.11`. `mediapipe 0.10.20` does not support Python 3.12+ or NumPy 2.x.
- **NumPy**: Always pinned to `numpy==1.26.4` — do **not** upgrade to 2.x without changing the MediaPipe version.
- **Custom User model**: `accounts.User` uses `email` as `USERNAME_FIELD`. Always authenticate with email, not username.
- **JWT tokens**: Stored client-side in `localStorage` as `auth_token` (access) and used as `Authorization: Bearer <token>`.
- **CORS**: `CORS_ALLOW_ALL_ORIGINS=True` in dev. Set to `False` and configure `CORS_ALLOWED_ORIGINS` in production.
- **Static files**: Served by WhiteNoise via `CompressedStaticFilesStorage`.
- **Media files**: Uploaded files land in `backend/media/`. In DEBUG mode they are served by Django; in production, use a CDN or Render's disk.
- **Face embeddings**: Stored as JSON files in `backend/face_embeddings/<email>.json`. Registered face images are in `backend/registered_faces/<email>.jpg`.
- **Face landmarker**: `backend/face_landmarker.task` is required at runtime. The code in `face_views.py` auto-downloads it from Google storage on first use if absent.
- **SharedState model**: Used to sync cross-browser localStorage keys prefixed with `sq_`, plus `global_hackathons` and `user_registrations`. Sync is polled every 3s from the frontend.
- **Settings env vars** (see `backend/backend/settings.py`):
  - `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOW_ALL_ORIGINS`, `CORS_ALLOWED_ORIGINS`

### Frontend
- **Path alias**: `@/` maps to `./src/` — use it for all imports (e.g., `import Foo from "@/components/Foo"`).
- **Environment variables**: Must be prefixed `VITE_`. Access via `import.meta.env.VITE_API_URL`.
- **Auth state**: Managed by `AuthContext` in `src/context/AuthContext.tsx`. Use `useAuth()` hook to access `user`, `login`, `signup`, `logout`.
- **Route protection**: Wrap routes with `<ProtectedRoute allowedRoles={["student"]}>` to restrict by role.
- **Roles**: Three roles — `"student"`, `"judge"`, `"admin"`. Role is returned from backend on login.
- **UI library**: Uses `shadcn/ui` components located in `src/components/ui/`. Do not manually edit these; re-run the shadcn CLI to add new ones.
- **AI features**: Groq API is called directly from the client using `VITE_GROQ_API_KEY`. No backend proxy — the key is client-exposed.
- **State sync**: `App.tsx` overrides `localStorage.setItem` and `localStorage.removeItem` globally to auto-POST changes to `/api/auth/sync/`.

---

## 🌐 API Endpoints Reference

| Method | URL | Description | Auth |
|--------|-----|-------------|------|
| POST | `/api/auth/signup/` | Register user | No |
| POST | `/api/auth/login/` | Authenticate user, return JWT | No |
| POST | `/api/auth/pdf-upload/` | Upload PDF (max 10MB) | No |
| GET | `/api/auth/sync/` | Fetch all synced room state | No |
| POST | `/api/auth/sync/` | Update synced room state | No |
| POST | `/api/face/register/` | Register biometric face | JWT |
| POST | `/api/face/verify/` | Verify face (1:1 or 1:many) | JWT |

---

## 🔑 Data Models

### `accounts.User` (Custom Django User)
| Field | Type | Notes |
|-------|------|-------|
| `email` | EmailField | Unique, used as login username |
| `username` | CharField | Display name, non-unique |
| `role` | CharField | `student` / `judge` / `admin` |
| `phone_number` | CharField | Optional, exactly 10 digits, unique |
| `password` | (inherited) | Hashed via Django's AbstractUser |

### `accounts.SharedState`
| Field | Type | Notes |
|-------|------|-------|
| `key` | CharField | Unique localStorage key (e.g. `sq_teams_HK001`) |
| `value` | TextField | JSON string |
| `updated_at` | DateTimeField | Auto-updated on save |

---

## ⚠️ Agent Warnings & Pitfalls

1. **Do NOT upgrade `numpy` above `1.x`** — MediaPipe 0.10.x will break with cryptic C-extension errors.
2. **Do NOT add `django.contrib.admin` URLs** — There is no admin URL in `backend/urls.py` by design; the superuser can be managed via `manage.py`.
3. **Face embeddings are on-disk JSON files**, not a database — they live in `backend/face_embeddings/`. If deleting or moving the backend directory, carry these along.
4. **`face_landmarker.task` is a binary model file** (3.5 MB) tracked in the repo. Do not gitignore it — it is required for the Tasks API fallback.
5. **CORS is wide-open in dev** (`CORS_ALLOW_ALL_ORIGINS=True`). Changing this requires explicitly listing the frontend origin in `CORS_ALLOWED_ORIGINS`.
6. **JWT tokens are stored in `localStorage`**, not HTTP-only cookies. Keep this in mind for security reviews.
7. **Frontend Groq API key is public** — it is embedded in the client bundle via `VITE_GROQ_API_KEY`. Do not use a production or high-limit key.
8. **MediaPipe has two fallback paths** in `face_views.py` — first tries `mp.solutions.face_mesh` (legacy), then the Tasks API. The legacy path works on Python 3.11 with MediaPipe 0.10.x.
9. **`vite.config.ts` sets port 8080** — if another service is running on 8080, the frontend will fail to start.
10. **Backend port is `8000`** — `VITE_API_URL` in `Frontend/.env` must match this exactly, including protocol.

---

## 🧪 Testing

### Backend
```bash
cd backend
# Run Django tests
python manage.py test
```

### Frontend
```bash
cd Frontend
# One-time run (CI mode)
npm run test

# Watch mode
npm run test:watch

# Lint
npm run lint
```

---

## 🐳 Docker (Backend Only)

```bash
# Build
docker build -t hackmanager-backend ./backend

# Run (sets PORT env for Gunicorn)
docker run -d -p 8000:8000 -e PORT=8000 hackmanager-backend
```

The Dockerfile installs system libraries required by OpenCV and MediaPipe on Linux (`libgl1`, `libglib2.0-0`, `libsm6`, `libxext6`, `libxrender-dev`).

---

## 📦 Adding Dependencies

### Backend
```bash
cd backend
# Install and add to requirements.txt
pip install <package>
pip freeze | grep <package> >> requirements.txt
```

### Frontend
```bash
cd Frontend
npm install <package>
# For shadcn/ui components:
npx shadcn-ui@latest add <component-name>
```
