import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Disposable local fixtures only; never seed demo credentials into the application database.
const directory = await mkdtemp(path.join(os.tmpdir(), "hackmanager-browser-"));
process.env.NODE_ENV = "test";
process.env.DB_FILE_NAME = path.join(directory, "test.db");
process.env.UPLOAD_DIR = path.join(directory, "uploads");
process.env.BIOMETRIC_DIR = path.join(directory, "biometrics");
process.env.JWT_SECRET = "browser-test-secret-not-for-production-use";
process.env.CORS_ORIGIN = "http://localhost:8080";
const { migrateDatabase } = await import("./migrate");
migrateDatabase();
const { db } = await import("../src/config/db");
const { users } = await import("../src/db/schema");
const { hashPassword } = await import("../src/modules/auth/passwords");
db.insert(users).values({ id: "browser-test-admin", email: "organizer@example.test", username: "Organizer", role: "admin", passwordHash: await hashPassword("browser-test-password") }).run();
const { app } = await import("../src/app");
app.listen(8010, "127.0.0.1", () => console.log("Disposable browser-test API: http://127.0.0.1:8010"));
