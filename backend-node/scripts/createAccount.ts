import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, closeDatabase } from "../src/config/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/modules/auth/passwords";

const input = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  username: z.string().trim().min(1).max(150),
  role: z.enum(["admin", "judge"]),
  password: z.string().min(12).refine((value) => Buffer.byteLength(value) <= 72),
}).parse({ email: process.env.ACCOUNT_EMAIL, username: process.env.ACCOUNT_NAME, role: process.env.ACCOUNT_ROLE, password: process.env.ACCOUNT_PASSWORD });
try {
  db.insert(users).values({ id: randomUUID(), email: input.email, username: input.username, role: input.role, passwordHash: await hashPassword(input.password) }).run();
  console.log("Account created. Existing accounts are never overwritten.");
} finally { closeDatabase(); }
