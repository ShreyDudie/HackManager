import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../config/db";
import { fileUploads, registrations, submissions } from "../../db/schema";
import { requireAuth, requireRole, type AuthUser } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";
import { requireOwnedEvent } from "../hackathons/access";

const repositorySchema = z.object({
  url: z.string().url().refine((value) => /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(value), "Enter a public GitHub repository URL"),
  name: z.string().trim().max(150).default("Repository"),
});
const presentationSchema = z.object({
  roundId: z.string().trim().max(100).default(""),
  name: z.string().trim().min(1).max(150),
  link: z.string().url().refine((value) => new URL(value).protocol === "https:", "Use an HTTPS presentation link").optional(),
  fileId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.link) !== Boolean(value.fileId), { message: "Provide either a presentation link or uploaded PDF", path: ["fileId"] });

function ownRegistration(hackathonId: string, ownerId: string) {
  return db.select().from(registrations).where(and(eq(registrations.hackathonId, hackathonId), eq(registrations.leaderId, ownerId))).get();
}

function saveSubmission(input: { hackathonId: string; registrationId: string; ownerId: string; kind: string; roundId: string; name: string; url?: string; fileUploadId?: string }) {
  const existing = db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.hackathonId, input.hackathonId), eq(submissions.ownerId, input.ownerId), eq(submissions.kind, input.kind), eq(submissions.roundId, input.roundId))).get();
  if (existing) {
    db.update(submissions).set({ name: input.name, url: input.url ?? null, fileUploadId: input.fileUploadId ?? null, updatedAt: new Date().toISOString() }).where(eq(submissions.id, existing.id)).run();
    return db.select().from(submissions).where(eq(submissions.id, existing.id)).get()!;
  }
  const submission = { id: randomUUID(), ...input, url: input.url ?? null, fileUploadId: input.fileUploadId ?? null };
  db.insert(submissions).values(submission).run();
  return submission;
}

export const submissionRouter = Router();

submissionRouter.get("/:id/submissions", requireAuth, requireRole("admin"), (request, response, next) => {
  try {
    const event = requireOwnedEvent(String(request.params.id), (response.locals.user as AuthUser).id);
    response.json(db.select().from(submissions).where(eq(submissions.hackathonId, event.id)).all());
  } catch (error) { next(error); }
});

submissionRouter.get("/:id/submissions/me", requireAuth, requireRole("student"), (request, response, next) => {
  try {
    const actor = response.locals.user as AuthUser;
    response.json(db.select().from(submissions).where(and(eq(submissions.hackathonId, String(request.params.id)), eq(submissions.ownerId, actor.id))).all());
  } catch (error) { next(error); }
});

submissionRouter.post("/:id/submissions/github", requireAuth, requireRole("student"), (request, response, next) => {
  try {
    const parsed = repositorySchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Enter a valid GitHub repository URL", parsed.error.flatten().fieldErrors);
    const actor = response.locals.user as AuthUser;
    const registration = ownRegistration(String(request.params.id), actor.id);
    if (!registration) throw new AppError(403, "REGISTRATION_REQUIRED", "Register a team before submitting");
    response.status(201).json(saveSubmission({ hackathonId: registration.hackathonId, registrationId: registration.id, ownerId: actor.id, kind: "github", roundId: "", name: parsed.data.name, url: parsed.data.url }));
  } catch (error) { next(error); }
});

submissionRouter.post("/:id/submissions/presentation", requireAuth, requireRole("student"), (request, response, next) => {
  try {
    const parsed = presentationSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Provide a valid presentation", parsed.error.flatten().fieldErrors);
    const actor = response.locals.user as AuthUser;
    const registration = ownRegistration(String(request.params.id), actor.id);
    if (!registration) throw new AppError(403, "REGISTRATION_REQUIRED", "Register a team before submitting");
    if (parsed.data.fileId) {
      const file = db.select().from(fileUploads).where(eq(fileUploads.id, parsed.data.fileId)).get();
      if (!file || file.ownerId !== actor.id) throw new AppError(404, "FILE_NOT_FOUND", "Uploaded PDF not found");
    }
    response.status(201).json(saveSubmission({ hackathonId: registration.hackathonId, registrationId: registration.id, ownerId: actor.id, kind: "presentation", roundId: parsed.data.roundId, name: parsed.data.name, url: parsed.data.link, fileUploadId: parsed.data.fileId }));
  } catch (error) { next(error); }
});
