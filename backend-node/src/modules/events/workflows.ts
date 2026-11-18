import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../config/db";
import { announcements, evaluations, hackathons, registrations, submissions, tickets, ticketMessages, users } from "../../db/schema";
import { requireAuth, requireRole, type AuthUser } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";
import { requireOwnedEvent } from "../hackathons/access";
import { accountEmail } from "../auth/accountEmail";

export const workflows = Router();
const message = z.string().trim().min(1).max(4000);
function input<T>(schema: z.ZodType<T>, value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError(400, "INVALID_INPUT", parsed.error.issues[0].message);
  return parsed.data;
}
function eventExists(id: string) {
  if (!db.select({ id: hackathons.id }).from(hackathons).where(eq(hackathons.id, id)).get())
    throw new AppError(404, "EVENT_NOT_FOUND", "Event not found");
}

workflows.get("/hackathons/:id/announcements", (req, res) => {
  eventExists(req.params.id);
  res.json(db.select().from(announcements).where(eq(announcements.eventId, req.params.id)).orderBy(desc(announcements.createdAt)).all());
});
workflows.post("/hackathons/:id/announcements", requireAuth, requireRole("admin"), (req, res) => {
  const eventId = String(req.params.id);
  requireOwnedEvent(eventId, res.locals.user.id);
  const notice = input(z.object({ message }), req.body);
  res.status(201).json(db.insert(announcements).values({ id: randomUUID(), eventId, ...notice }).returning().get());
});

workflows.post("/hackathons/:id/assignments", requireAuth, requireRole("admin"), (req, res) => {
  const eventId = String(req.params.id);
  requireOwnedEvent(eventId, res.locals.user.id);
  const { teamId, email } = input(z.object({ teamId: z.string(), email: accountEmail }), req.body);
  const team = db.select().from(registrations).where(and(eq(registrations.id, teamId), eq(registrations.hackathonId, eventId))).get();
  const judge = db.select({ id: users.id }).from(users).where(and(eq(users.email, email.toLowerCase()), eq(users.role, "judge"))).get();
  if (!team || !judge) throw new AppError(404, "NOT_FOUND", "Choose a registered team and an existing judge account");
  const row = db.insert(evaluations).values({ id: randomUUID(), teamId, judgeId: judge.id }).onConflictDoNothing().returning().get();
  if (!row) throw new AppError(409, "ALREADY_ASSIGNED", "Judge already assigned to this team");
  res.status(201).json(row);
});
workflows.get("/judge-assignments", requireAuth, requireRole("judge"), (_req, res) => {
  const rows = db.select({ id: evaluations.id, teamId: registrations.id, team: registrations.teamName, event: hackathons.name, score: evaluations.score, feedback: evaluations.feedback })
    .from(evaluations).innerJoin(registrations, eq(evaluations.teamId, registrations.id)).innerJoin(hackathons, eq(hackathons.id, registrations.hackathonId))
    .where(eq(evaluations.judgeId, res.locals.user.id)).all();
  res.json(rows.map(row => ({ ...row, submissions: db.select().from(submissions).where(eq(submissions.registrationId, row.teamId)).all() })));
});
workflows.put("/judge-assignments/:id/score", requireAuth, requireRole("judge"), (req, res) => {
  const score = input(z.object({ score: z.number().int().min(0).max(100), feedback: z.string().trim().max(4000) }), req.body);
  const row = db.update(evaluations).set(score).where(and(eq(evaluations.id, String(req.params.id)), eq(evaluations.judgeId, res.locals.user.id))).returning().get();
  if (!row) throw new AppError(404, "NOT_FOUND", "Assignment not found");
  res.json(row);
});
workflows.get("/hackathons/:id/leaderboard", (req, res) => {
  eventExists(req.params.id);
  const score = sql<number | null>`case when count(${evaluations.score}) = count(${evaluations.id}) then round(avg(${evaluations.score}), 2) end`;
  res.json(db.select({ teamId: registrations.id, team: registrations.teamName, score })
    .from(registrations).leftJoin(evaluations, eq(evaluations.teamId, registrations.id)).where(eq(registrations.hackathonId, req.params.id))
    .groupBy(registrations.id).orderBy(desc(score), asc(registrations.teamName), asc(registrations.id)).all());
});

function ticketScope(eventId: string, actor: AuthUser) {
  if (actor.role === "admin") requireOwnedEvent(eventId, actor.id);
  return and(eq(tickets.eventId, eventId), actor.role === "student" ? eq(tickets.studentId, actor.id) : undefined);
}
workflows.get("/hackathons/:id/tickets", requireAuth, requireRole("admin", "student"), (req, res) => {
  const scope = ticketScope(String(req.params.id), res.locals.user);
  const rows = db.select().from(tickets).where(scope).all();
  res.json(rows.map(row => ({ ...row, messages: db.select({ id: ticketMessages.id, message: ticketMessages.message, name: users.username })
    .from(ticketMessages).innerJoin(users, eq(users.id, ticketMessages.author)).where(eq(ticketMessages.ticketId, row.id)).orderBy(ticketMessages.id).all() })));
});
workflows.post("/hackathons/:id/tickets", requireAuth, requireRole("student"), (req, res) => {
  const eventId = String(req.params.id), studentId = res.locals.user.id;
  eventExists(eventId);
  const body = input(z.object({ subject: z.string().trim().min(1).max(160), message }), req.body);
  const id = randomUUID();
  db.transaction(tx => {
    tx.insert(tickets).values({ id, eventId, studentId, subject: body.subject }).run();
    tx.insert(ticketMessages).values({ ticketId: id, author: studentId, message: body.message }).run();
  });
  res.status(201).json({ id });
});
workflows.post("/hackathons/:id/tickets/:ticket/messages", requireAuth, requireRole("student", "admin"), (req, res) => {
  const row = db.select().from(tickets).where(and(ticketScope(String(req.params.id), res.locals.user), eq(tickets.id, String(req.params.ticket)))).get();
  if (!row) throw new AppError(404, "NOT_FOUND", "Ticket not found");
  const body = input(z.object({ message }), req.body);
  res.status(201).json(db.insert(ticketMessages).values({ ticketId: row.id, author: res.locals.user.id, ...body }).returning({ id: ticketMessages.id }).get());
});
workflows.patch("/hackathons/:id/tickets/:ticket", requireAuth, requireRole("admin"), (req, res) => {
  const scope = ticketScope(String(req.params.id), res.locals.user);
  const body = input(z.object({ status: z.enum(["Open", "In Progress", "Resolved"]) }), req.body);
  const row = db.update(tickets).set(body).where(and(scope, eq(tickets.id, String(req.params.ticket)))).returning().get();
  if (!row) throw new AppError(404, "NOT_FOUND", "Ticket not found");
  res.json(row);
});
