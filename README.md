# HackManager

HackManager runs college hackathons from team registration through submissions, check-in, judging and results. React + TypeScript calls the Express API. Express uses Drizzle with SQLite, bcrypt and JWT. A private Python service handles face photos.

## Run locally

Use Node 22 and npm. Run the following from the repository root in two terminals.

```powershell
npm --prefix backend-node ci
npm --prefix backend-node run db:migrate
npm --prefix backend-node run dev
```

```powershell
npm --prefix Frontend ci
npm --prefix Frontend run dev
```

Open [the app](http://localhost:8080). Vite proxies requests to Express on port 8000. Students sign up in the app. Use [account provisioning and browser checks](docs/express-development.md) for organizer and judge accounts.

For face verification, run Python 3.11 in a virtual environment from `services/face-service`, install `requirements.txt`, and run `python -m uvicorn app:app --host 127.0.0.1 --port 8001`. Both services must use the same `FACE_SERVICE_KEY`. The other event workflows work without vision.

| Directory | Purpose |
| --- | --- |
| `Frontend/` | React app and Playwright browser journeys |
| `backend-node/` | Active API, Drizzle migrations and account/import tools |
| `services/face-service/` | Python image processing |
| `data/` | Local SQLite, private uploads and face profiles |
| `backend/` | Retired Django snapshot and original media for migration recovery |

See [cutover and recovery](docs/migration-status.md), [deployment](DEPLOYMENT.md) and [API contracts](docs/api-contracts.md).
