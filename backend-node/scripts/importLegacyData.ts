import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { eq } from "drizzle-orm";
import { closeDatabase, db } from "../src/config/db";
import { legacyStates, users as userTable } from "../src/db/schema";

type LegacyUser = { id: number; email: string; username: string | null; role: "student" | "judge" | "admin"; phone_number: string | null; password: string };
type LegacyState = { key: string; value: string; updated_at: string };

const sourcePath = path.resolve(process.env.LEGACY_DATABASE_PATH || "../backend/db.sqlite3");
const dryRun = process.argv.includes("--dry-run");
const source = new Database(sourcePath, { readonly: true });
const legacyUsers = source.prepare("SELECT id, email, username, role, phone_number, password FROM accounts_user").all() as LegacyUser[];
const states = source.prepare("SELECT key, value, updated_at FROM accounts_sharedstate").all() as LegacyState[];

if (dryRun) {
  console.log(JSON.stringify({ sourcePath, users: legacyUsers.length, sharedStateRecords: states.length, action: "no changes" }));
} else {
  for (const user of legacyUsers) {
    const data = { legacyId: user.id, email: user.email.toLowerCase(), username: user.username?.trim() || user.email.split("@")[0], role: user.role, phoneNumber: user.phone_number || null, passwordHash: user.password };
    const existing = db.select({ id: userTable.id }).from(userTable).where(eq(userTable.legacyId, user.id)).get();
    if (existing) db.update(userTable).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(userTable.id, existing.id)).run();
    else db.insert(userTable).values({ id: randomUUID(), ...data }).run();
  }
  for (const state of states) {
    db.insert(legacyStates).values({ key: state.key, value: state.value, updatedAt: new Date(state.updated_at).toISOString() }).onConflictDoUpdate({ target: legacyStates.key, set: { value: state.value, updatedAt: new Date(state.updated_at).toISOString() } }).run();
  }
  console.log(JSON.stringify({ sourcePath, users: legacyUsers.length, sharedStateRecords: states.length, action: "imported" }));
}

source.close();
closeDatabase();
