import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { closeDatabase, db } from "../src/config/db";

export function migrateDatabase() {
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrateDatabase();
  closeDatabase();
}
