import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { requireOwnedEvent } from "./access";
import { z } from "zod";
import { db } from "../../config/db";
import { hackathons, registrations, teamMembers, users } from "../../db/schema";
import { requireAuth, requireRole, type AuthUser } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";

const eventStatus = z.enum(["Open", "Ongoing", "Completed", "Coming Soon"]);
const eventSchema = z.object({
  name: z.string().trim().min(3).max(150),
  description: z.string().trim().min(1).max(5000),
  startDate: z.string().date(),
  endDate: z.string().date(),
  registrationDeadline: z.string().date(),
  minTeamSize: z.number().int().min(1).max(50),
  maxTeamSize: z.number().int().min(1).max(50),
  status: eventStatus.default("Coming Soon"),
  theme: z.string().max(300).default(""),
  rules: z.string().max(10_000).default(""),
  location: z.string().max(300).default("Campus Main Auditorium"),
  headerImage: z.string().max(1_000_000).default(""),
  stages: z.union([z.string(), z.array(z.any())]).default([]),
  problemStatements: z.union([z.string(), z.array(z.any())]).default([]),
  schedules: z.union([z.string(), z.record(z.any())]).default({}),
}).refine((value) => value.minTeamSize <= value.maxTeamSize, { message: "Minimum team size cannot exceed maximum", path: ["minTeamSize"] })
  .refine((value) => value.startDate <= value.endDate, { message: "Start date must not be after end date", path: ["startDate"] })
  .refine((value) => value.registrationDeadline <= value.endDate, { message: "Registration deadline must not be after the event end date", path: ["registrationDeadline"] });

const memberSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().max(20).default(""),
  college: z.string().max(250).default(""),
});
const registrationSchema = z.object({ teamName: z.string().trim().min(2).max(150), members: z.array(memberSchema).max(49).default([]) });

function eventById(id: string) {
  return db.select().from(hackathons).where(eq(hackathons.id, id)).get();
}

export const hackathonRouter = Router();

hackathonRouter.get("/", (_request, response) => response.json(db.select().from(hackathons).all()));

hackathonRouter.get("/:id", (request, response, next) => {
  const event = eventById(String(request.params.id));
  if (!event) return next(new AppError(404, "HACKATHON_NOT_FOUND", "Hackathon not found"));
  response.json(event);
});

hackathonRouter.post("/", requireAuth, requireRole("admin"), (request, response, next) => {
  try {
    const parsed = eventSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Check the highlighted fields", parsed.error.flatten().fieldErrors);
    const owner = response.locals.user as AuthUser;
    const stages = typeof parsed.data.stages === "string" ? parsed.data.stages : JSON.stringify(parsed.data.stages);
    const problemStatements = typeof parsed.data.problemStatements === "string" ? parsed.data.problemStatements : JSON.stringify(parsed.data.problemStatements);
    const schedules = typeof parsed.data.schedules === "string" ? parsed.data.schedules : JSON.stringify(parsed.data.schedules);
    const event = {
      id: randomUUID(),
      ownerId: owner.id,
      ...parsed.data,
      stages,
      problemStatements,
      schedules,
    };
    db.insert(hackathons).values(event).run();
    response.status(201).json(event);
  } catch (error) { next(error); }
});

hackathonRouter.post("/:id/registrations", requireAuth, requireRole("student"), (request, response, next) => {
  try {
    const parsed = registrationSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Check the team details", parsed.error.flatten().fieldErrors);
    const event = eventById(String(request.params.id));
    if (!event) throw new AppError(404, "HACKATHON_NOT_FOUND", "Hackathon not found");
    if (event.status !== "Open") throw new AppError(409, "REGISTRATION_CLOSED", "Registration is not open for this hackathon");
    if (event.registrationDeadline < new Date().toISOString().slice(0, 10)) throw new AppError(409, "REGISTRATION_CLOSED", "The registration deadline has passed");
    const actor = response.locals.user as AuthUser;
    const emails = [actor.email, ...parsed.data.members.map((member) => member.email)];
    if (new Set(emails).size !== emails.length) throw new AppError(400, "DUPLICATE_MEMBER", "Each team member must use a unique email");
    if (emails.length < event.minTeamSize || emails.length > event.maxTeamSize) throw new AppError(400, "INVALID_TEAM_SIZE", `Team size must be between ${event.minTeamSize} and ${event.maxTeamSize}`);

    const existing = db.select({ id: registrations.id }).from(registrations).where(and(eq(registrations.hackathonId, event.id), eq(registrations.leaderId, actor.id))).get();
    if (existing) throw new AppError(409, "ALREADY_REGISTERED", "You already lead a team for this hackathon");
    const membership = db.select({ id: teamMembers.id }).from(teamMembers).innerJoin(registrations, eq(teamMembers.registrationId, registrations.id)).where(and(eq(registrations.hackathonId, event.id), inArray(teamMembers.email, emails))).get();
    if (membership) throw new AppError(409, "MEMBER_ALREADY_REGISTERED", "A team member is already registered for this hackathon");
    const account = db.select({ username: users.username }).from(users).where(eq(users.id, actor.id)).get();
    const registration = { id: randomUUID(), hackathonId: event.id, leaderId: actor.id, teamName: parsed.data.teamName };
    db.transaction((transaction) => {
      transaction.insert(registrations).values(registration).run();
      transaction.insert(teamMembers).values([
        { id: randomUUID(), registrationId: registration.id, userId: actor.id, name: account?.username || actor.email, email: actor.email },
        ...parsed.data.members.map((member) => ({ id: randomUUID(), registrationId: registration.id, userId: null, ...member })),
      ]).run();
    });
    response.status(201).json({ ...registration, members: db.select().from(teamMembers).where(eq(teamMembers.registrationId, registration.id)).all() });
  } catch (error) { next(error); }
});

hackathonRouter.get("/:id/registrations/me", requireAuth, requireRole("student"), (request, response, next) => {
  try {
    const actor = response.locals.user as AuthUser;
    const registration = db.select().from(registrations).where(and(eq(registrations.hackathonId, String(request.params.id)), eq(registrations.leaderId, actor.id))).get();
    if (!registration) throw new AppError(404, "REGISTRATION_NOT_FOUND", "You are not registered for this hackathon");
    response.json({ ...registration, members: db.select().from(teamMembers).where(eq(teamMembers.registrationId, registration.id)).all() });
  } catch (error) { next(error); }
});

hackathonRouter.get("/:id/registrations", requireAuth, requireRole("admin"), (request, response, next) => {
  try {
    const event = requireOwnedEvent(String(request.params.id), (response.locals.user as AuthUser).id);
    const rows = db.select().from(registrations).where(eq(registrations.hackathonId, event.id)).all();
    response.json(rows.map((registration) => ({ ...registration, members: db.select().from(teamMembers).where(eq(teamMembers.registrationId, registration.id)).all() })));
  } catch (error) { next(error); }
});
