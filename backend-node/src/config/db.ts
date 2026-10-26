import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "./env";

const databasePath = path.resolve(process.cwd(), env.DB_FILE_NAME);
mkdirSync(path.dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");

export const db = drizzle({ client: sqlite });
export const closeDatabase = () => sqlite.close();
