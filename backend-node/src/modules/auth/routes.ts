import { Router } from "express";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../config/db";
import { env } from "../../config/env";
import { users } from "../../db/schema";
import { requireAuth, type AuthUser } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";
import { hashPassword, needsRehash, verifyPassword } from "./passwords";

const role = z.enum(["student", "judge", "admin"]);
const signupSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  username: z.string().trim().min(1).max(150),
  password: z.string().min(6).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes"),
  role,
  phone_number: z.string().regex(/^\d{10}$/).optional(),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1), role });

function publicUser(user: { id: string; email: string; username: string; role: AuthUser["role"] }) {
  return { id: user.id, email: user.email, username: user.username, role: user.role };
}

function databaseUser(user: { id: string; email: string; username: string; role: string }) {
  return publicUser({ ...user, role: role.parse(user.role) });
}

function createAccessToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { subject: user.id, expiresIn: "7d" });
}

export const authRouter = Router();

authRouter.post("/signup/", async (request, response, next) => {
  try {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Check the highlighted fields", parsed.error.flatten().fieldErrors);
    if (parsed.data.role !== "student") throw new AppError(403, "ROLE_PROVISION_REQUIRED", "Judge and admin accounts must be provisioned by an administrator");

    const existing = parsed.data.phone_number
      ? db.select({ id: users.id }).from(users).where(or(eq(users.email, parsed.data.email), eq(users.phoneNumber, parsed.data.phone_number))).get()
      : db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).get();
    if (existing) throw new AppError(409, "ACCOUNT_EXISTS", "An account already uses that email or phone number");
    const user = { id: randomUUID(), email: parsed.data.email, username: parsed.data.username, role: parsed.data.role, phoneNumber: parsed.data.phone_number ?? null, passwordHash: await hashPassword(parsed.data.password) };
    db.insert(users).values(user).run();
    response.status(201).json({ message: "User created successfully", user: databaseUser(user) });
  } catch (error) { next(error); }
});

authRouter.post("/login/", async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Email, password, and role are required", parsed.error.flatten().fieldErrors);
    const user = db.select().from(users).where(eq(users.email, parsed.data.email.trim().toLowerCase())).get();
    if (!user || user.role !== parsed.data.role || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email, password, or role");
    }
    if (needsRehash(user.passwordHash) && Buffer.byteLength(parsed.data.password, "utf8") <= 72) db.update(users).set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: new Date().toISOString() }).where(eq(users.id, user.id)).run();
    const access = createAccessToken(databaseUser(user));
    response.json({ access, ...databaseUser(user) });
  } catch (error) { next(error); }
});

authRouter.get("/me", requireAuth, async (_request, response, next) => {
  try {
    const identity = response.locals.user as AuthUser;
    const user = db.select().from(users).where(eq(users.id, identity.id)).get();
    if (!user) throw new AppError(401, "INVALID_TOKEN", "Your account is no longer available");
    response.json(databaseUser(user));
  } catch (error) { next(error); }
});
