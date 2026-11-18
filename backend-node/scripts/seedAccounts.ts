/**
 * Dev-only seed script.
 * Upserts the three local HCI accounts with a known password.
 * Safe to run multiple times — uses onConflictDoUpdate so it never creates duplicates.
 *
 * Usage:  npm --prefix backend-node run seed
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, closeDatabase } from "../src/config/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/modules/auth/passwords";

const PASSWORD = "password123";

const accounts = [
  { email: "admin@hci",   username: "Admin HCI",   role: "admin"   as const },
  { email: "judge@hci",   username: "Judge HCI",   role: "judge"   as const },
  { email: "student@hci", username: "Student HCI", role: "student" as const },
];

console.log("Seeding dev accounts…");
const hash = await hashPassword(PASSWORD);

for (const account of accounts) {
  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, account.email)).get();
  if (existing) {
    db.update(users)
      .set({ passwordHash: hash, username: account.username, updatedAt: new Date().toISOString() })
      .where(eq(users.email, account.email))
      .run();
    console.log(`  ✓ updated   ${account.email}  (${account.role})`);
  } else {
    db.insert(users)
      .values({ id: randomUUID(), email: account.email, username: account.username, role: account.role, passwordHash: hash })
      .run();
    console.log(`  ✓ inserted  ${account.email}  (${account.role})`);
  }
}

console.log("\nDone. All three accounts use password: password123");
closeDatabase();

