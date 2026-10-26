import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../config/db";
import { checkinLogs, checkinTokens, registrations } from "../../db/schema";
import { requireAuth, requireRole, type AuthUser } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";
import { requireOwnedEvent } from "../hackathons/access";

const purpose = z.enum(["entry", "breakfast", "lunch", "dinner"]);
const issueSchema = z.object({ purpose, day: z.number().int().min(0).max(14).default(0) }).refine((value) => value.purpose === "entry" ? value.day === 0 : value.day > 0, { message: "Entry uses day 0; meal tokens require a day", path: ["day"] });
const redeemSchema = z.object({ token: z.string().min(20).max(200) });
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function ownRegistration(hackathonId: string, userId: string) {
  return db.select().from(registrations).where(and(eq(registrations.hackathonId, hackathonId), eq(registrations.leaderId, userId))).get();
}

export const checkinRouter = Router();
export const checkinRedemptionRouter = Router();

checkinRouter.post("/:id/check-ins/token", requireAuth, requireRole("student"), (request, response, next) => {
  try {
    const parsed = issueSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Choose a valid check-in purpose and day", parsed.error.flatten().fieldErrors);
    const actor = response.locals.user as AuthUser;
    const registration = ownRegistration(String(request.params.id), actor.id);
    if (!registration) throw new AppError(403, "REGISTRATION_REQUIRED", "Register a team before requesting a check-in pass");
    const existing = db.select().from(checkinTokens).where(and(eq(checkinTokens.registrationId, registration.id), eq(checkinTokens.purpose, parsed.data.purpose), eq(checkinTokens.day, parsed.data.day))).get();
    if (existing?.redeemedAt) throw new AppError(409, "TOKEN_ALREADY_USED", "This check-in pass has already been used");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const record = { id: randomUUID(), registrationId: registration.id, purpose: parsed.data.purpose, day: parsed.data.day, tokenHash: tokenHash(token), expiresAt };
    if (existing) db.update(checkinTokens).set({ tokenHash: record.tokenHash, expiresAt }).where(eq(checkinTokens.id, existing.id)).run();
    else db.insert(checkinTokens).values(record).run();
    response.status(201).json({ token, purpose: record.purpose, day: record.day, expiresAt });
  } catch (error) { next(error); }
});

checkinRedemptionRouter.post("/redeem", requireAuth, requireRole("admin"), (request, response, next) => {
  try {
    const parsed = redeemSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "A valid check-in token is required");
    const scanner = response.locals.user as AuthUser;
    const digest = tokenHash(parsed.data.token);
    const outcome = db.transaction((transaction) => {
      const result = (() => {
      const pass = transaction.select().from(checkinTokens).where(eq(checkinTokens.tokenHash, digest)).get();
      if (!pass) return { result: "invalid", message: "Unknown check-in token", purpose: "unknown", hackathonId: null, registrationId: null, tokenId: null };
      const registration = transaction.select().from(registrations).where(eq(registrations.id, pass.registrationId)).get();
      if (!registration) return { result: "invalid", message: "Registration is unavailable", purpose: pass.purpose, hackathonId: null, registrationId: null, tokenId: pass.id };
      requireOwnedEvent(registration.hackathonId, scanner.id);
      if (pass.redeemedAt) return { result: "duplicate", message: "This pass has already been redeemed", purpose: pass.purpose, hackathonId: registration.hackathonId, registrationId: registration.id, tokenId: pass.id };
      if (new Date(pass.expiresAt) < new Date()) return { result: "expired", message: "This pass has expired", purpose: pass.purpose, hackathonId: registration.hackathonId, registrationId: registration.id, tokenId: pass.id };
      if (pass.purpose !== "entry") {
        const entry = transaction.select({ id: checkinTokens.id }).from(checkinTokens).where(and(eq(checkinTokens.registrationId, registration.id), eq(checkinTokens.purpose, "entry"), isNotNull(checkinTokens.redeemedAt))).get();
        if (!entry) return { result: "invalid", message: "Entry must be redeemed before meals", purpose: pass.purpose, hackathonId: registration.hackathonId, registrationId: registration.id, tokenId: pass.id };
      }
      transaction.update(checkinTokens).set({ redeemedAt: new Date().toISOString() }).where(eq(checkinTokens.id, pass.id)).run();
      return { result: "valid", message: `${pass.purpose} verified`, purpose: pass.purpose, hackathonId: registration.hackathonId, registrationId: registration.id, tokenId: pass.id };
      })();
      transaction.insert(checkinLogs).values({ id: randomUUID(), hackathonId: result.hackathonId, registrationId: result.registrationId, tokenId: result.tokenId, scannedBy: scanner.id, purpose: result.purpose, tokenHash: digest, result: result.result, message: result.message }).run();
      return result;
    });
    response.json({ success: outcome.result === "valid", result: outcome.result, message: outcome.message });
  } catch (error) { next(error); }
});

checkinRouter.get("/:id/check-ins", requireAuth, requireRole("admin"), (request, response, next) => {
  try {
    requireOwnedEvent(String(request.params.id), (response.locals.user as AuthUser).id);
    response.json(db.select().from(checkinLogs).where(eq(checkinLogs.hackathonId, String(request.params.id))).all());
  } catch (error) { next(error); }
});
