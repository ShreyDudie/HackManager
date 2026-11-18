# Express development and browser checks

React uses Express for all active routes. See [cutover status](migration-status.md) for imported data and remaining feature gaps.

## Run locally

From the repository root:

```powershell
npm --prefix backend-node ci
npm --prefix backend-node run db:migrate
npm --prefix backend-node run dev
```

In another terminal:

```powershell
npm --prefix Frontend ci
# On a fresh checkout, copy .env.example to .env; keep any existing secrets.
if (-not (Test-Path Frontend/.env)) { Copy-Item Frontend/.env.example Frontend/.env }
npm --prefix Frontend run dev
```

Open `http://localhost:8080`. Express uses port 8000. An empty `VITE_API_URL` uses Vite's `/api` and `/media` proxy; an explicit `http://127.0.0.1:8000` also works with the default CORS origins. Restart Vite after changing environment values.

`backend-node/.env.example` documents database, JWT, CORS, uploads and vision-service settings. Copy it to `.env` if overrides are needed; runtime now loads this file. Production needs a real JWT secret and a private face-service key. Configure the deployed API origin via `VITE_API_URL`, or route `/api` and `/media` to Express at the hosting layer; Vite's development proxy does not apply to production builds.

Students can sign up. Provision admin/judge accounts from the backend terminal after migrations. The command validates inputs and never replaces an existing account:

```powershell
$env:ACCOUNT_EMAIL = 'organizer@your-college.edu'
$env:ACCOUNT_NAME = 'Campus Organizer'
$env:ACCOUNT_ROLE = 'admin'
$secret = Read-Host 'Password (12 characters minimum, 72 UTF-8 bytes maximum)' -AsSecureString
$env:ACCOUNT_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
npm --prefix backend-node run account:create
Remove-Item Env:ACCOUNT_PASSWORD
```


## Repeat the Playwright CLI check

Stop any frontend on port 8080 first. The test API creates a fresh database and uploads directory in the OS temporary directory; it does not read or write the application database. It listens only on loopback port 8010 and has a test organizer account. Do not expose this server publicly.

Terminal 1:

```powershell
npm --prefix backend-node run test:browser-server
```

Terminal 2:

```powershell
$env:VITE_API_URL = 'http://127.0.0.1:8010'
npm --prefix Frontend run dev
```

Terminal 3, from the repository root, with `playwright-cli` installed:

```powershell
playwright-cli -s=hackmanager open http://localhost:8080
playwright-cli -s=hackmanager run-code --filename Frontend/tests/browser/event-flow.js
playwright-cli -s=hackmanager run-code --filename Frontend/tests/browser/error-states.js
playwright-cli -s=hackmanager close
```

Screenshots are written to ignored `test-results/`. The event check uses separate browser contexts, real HTTP calls, and real SQLite persistence. The error check deliberately injects HTTP 503 responses and verifies retry recovery; those expected failures appear in the browser console. These checks cover core event flows, protected routes, duplicate passes, errors, and responsive overflow; they do not test the private Python vision service, camera hardware, AI, or features not migrated yet. Stop both test servers and remove the terminal's `VITE_API_URL` override before starting the normal app.

Other checks:

```powershell
npm --prefix backend-node run check
npm --prefix backend-node test
npm --prefix Frontend test
npm --prefix Frontend run build
```

Database queries follow the [official Drizzle select](https://orm.drizzle.team/docs/select) and [insert](https://orm.drizzle.team/docs/insert) documentation.
