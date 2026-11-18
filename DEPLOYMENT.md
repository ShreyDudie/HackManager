# Deploy HackManager

Build the API and private vision service with `docker compose up --build -d`. Set a random `JWT_SECRET` of at least 32 characters, a separate random `FACE_SERVICE_KEY` of at least 16 characters, and `CORS_ORIGIN` to your frontend's exact HTTPS origin. Keep the vision service on the internal network. Terminate HTTPS at the API proxy.

Compose mounts `./data` at `/data`. The API runs Drizzle migrations at startup. Persist and back up that directory, including `uploads/` and `biometrics/`. The default database is `/data/hackmanager-live.db`. On an existing deployment set `DB_FILE_NAME` to the mounted path of your existing Express database or its verified cutover copy **before starting the new release**.

Build the static frontend with `npm --prefix Frontend ci` and `npm --prefix Frontend run build`. Serve `Frontend/dist` with an SPA fallback to `index.html`. Set `VITE_API_URL` to the public Express origin at build time, or forward `/api` and `/media` to Express on the same origin. The frontend has one backend. No mode flag is needed.

Check the API's `/health`, sign in with a test account, and exercise PDF upload/download and face verification before directing users to the deployment. The repository's local cutover does not migrate a hosted database. Follow the [cutover procedure](docs/migration-status.md) on a copy of that deployment's data first.
