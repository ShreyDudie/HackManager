import "dotenv/config";
import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "../src/config/env";
import { users, legacyStates, hackathons, registrations, teamMembers, submissions, fileUploads, evaluations, checkinTokens, checkinLogs } from "../src/db/schema";

const sourcePath = realpathSync(process.env.LEGACY_DATABASE_PATH || "../backend/db.sqlite3");
const targetPath = path.resolve(env.DB_FILE_NAME);
if (existsSync(targetPath) && realpathSync(targetPath).toLowerCase() === sourcePath.toLowerCase()) throw new Error("Source and destination must be separate databases");
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
type Account = { id: number; email: string; username: string; role: string; phone_number: string | null; password: string };
type State = { key: string; value: string; updated_at: string };
const snapshot = source.transaction(() => ({
  accounts: source.prepare("SELECT id,email,username,role,phone_number,password FROM accounts_user ORDER BY id").all() as Account[],
  states: source.prepare("SELECT key,value,updated_at FROM accounts_sharedstate ORDER BY key").all() as State[],
}))();
source.close();

const raw = new Map(snapshot.states.map(s => [s.key, s.value]));
function rows<T>(key: string, schema: z.ZodType<T>, fallback?: string): T[] {
  const json = raw.get(key) ?? (fallback && raw.get(fallback));
  const parsed = z.array(schema).safeParse(JSON.parse(json ?? "[]"));
  if (!parsed.success) throw new Error("Unrecognized legacy data in " + key);
  return parsed.data;
}

const str = z.string(), id = str.min(1);
const events = rows("sq_hackathons", z.object({ id, name: id, description: str, startDate: str, endDate: str, registrationDeadline: str,
  minTeamSize: z.coerce.number().int().positive(), maxTeamSize: z.coerce.number().int().positive(), status: str, theme: str, rules: str }), "global_hackathons");
const teams = rows("sq_registrations", z.object({ id, hackathonId: id, userEmail: id, userName: id, teamName: id, timestamp: id,
  status: str, memberNames: z.array(str).optional(), members: z.array(z.object({ name: id, email: str.optional(), phone: str.optional(), college: str.optional() })).optional(),
  qrTokenUsed: z.boolean().optional(), scannedAt: str.optional() }), "user_registrations");
const github = rows("sq_github_submissions", z.object({ hackathonId: id, userEmail: id, submittedAt: id, url: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i) }));
const decks = rows("sq_ppt_submissions", z.object({ hackathonId: id, userEmail: id, submittedAt: id, name: str, roundId: str, link: str.nullish(),
  pdfBase64: str.nullish(), pdfUrl: str.nullish(), pdfFileName: str.nullish() }));
const assignments = rows("sq_judge_assignments", z.object({ teamId: id, hackathonId: id, judgeEmail: id, judgeScore: z.number().int().min(0).max(100).nullable() }));
const scans = rows("sq_qr_scan_logs", z.object({ id, hackathonId: id, userEmail: str, tokenType: str, tokenHash: str, result: str, scannedAt: str }));
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const marker = "cutover:django:v1";
if (raw.has(marker)) throw new Error("Reserved migration key in source");
const mediaRoot = path.resolve(path.dirname(sourcePath), "media");
const files = decks.map(deck => {
  if (deck.link && new URL(deck.link).protocol !== "https:") throw new Error("Unsupported presentation URL");
  let bytes: Buffer;
  if (deck.pdfUrl) {
    const pathname = decodeURIComponent(new URL(deck.pdfUrl, "http://legacy.invalid").pathname);
    if (!pathname.startsWith("/media/")) throw new Error("Unrecognized legacy PDF path");
    const file = realpathSync(path.resolve(mediaRoot, pathname.slice(7)));
    const relative = path.relative(realpathSync(mediaRoot), file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("PDF outside legacy media directory");
    bytes = readFileSync(file);
  } else if (deck.pdfBase64) {
    bytes = Buffer.from(deck.pdfBase64.replace(/^data:application\/pdf;base64,/, ""), "base64");
  } else {
    if (!deck.link) throw new Error("Presentation has no usable file or link");
    return null;
  }
  if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Unsupported legacy PDF");
  return { bytes, hash: sha(bytes), name: path.basename(deck.pdfFileName || "presentation.pdf") };
});
const digest = sha(JSON.stringify([snapshot, files.map(f => f?.hash)]));
const summary = { accounts: snapshot.accounts.length, archivedStates: raw.size, events: events.length, teams: teams.length,
  submissions: github.length + decks.length, pdfs: files.filter(Boolean).length, assignments: assignments.length, scanLogs: scans.length };
if (process.argv.includes("--dry-run")) {
  console.log({ ...summary, action: "source inspected, no writes" });
} else {
  const { db, closeDatabase } = await import("../src/config/db");
  const newFiles: string[] = [];
  try {
    const outcome = db.transaction(tx => {
      const old = tx.select().from(legacyStates).where(eq(legacyStates.key, marker)).get();
      if (old) {
        if (old.value !== digest) throw new Error("Source changed after cutover. Reconcile changes before importing.");
        for (const file of files) if (file && sha(readFileSync(path.join(env.UPLOAD_DIR, "legacy-" + file.hash + ".pdf"))) !== file.hash)
          throw new Error("Imported PDF checksum mismatch");
        return "already imported";
      }
      // This principal cannot log in or receive a JWT. Legacy ownership and scanner identity were never recorded.
      const archivalActor = "legacy:unassigned";
      tx.insert(users).values({ id: archivalActor, email: "unassigned@legacy.invalid", username: "Unassigned legacy record", role: "archive", passwordHash: "!" }).run();
      const accounts = new Map<string, Account>();
      const uid = (acct: Account) => "django:" + acct.id;
      function account(email: string, role: string) {
        const acct = accounts.get(email.trim().toLowerCase());
        if (!acct || acct.role !== role) throw new Error("Unresolved legacy " + role + " account");
        return uid(acct);
      }
      for (const a of snapshot.accounts) {
        if (!["admin","judge","student"].includes(a.role)) throw new Error("Unknown legacy account role");
        const email = a.email.trim().toLowerCase();
        accounts.set(email, a);
        tx.insert(users).values({ id: uid(a), legacyId: a.id, email, username: a.username || email, role: a.role, phoneNumber: a.phone_number || null, passwordHash: a.password }).run();
      }
      for (const state of snapshot.states) tx.insert(legacyStates).values({ key: state.key, value: state.value, updatedAt: state.updated_at }).run();
      const eventId = (value: string) => {
        if (!events.some(e => e.id === value)) throw new Error("Missing legacy event reference");
        return "django:event:" + value;
      };
      for (const event of events) tx.insert(hackathons).values({ ...event, id: eventId(event.id), ownerId: archivalActor }).run();
      const teamId = (value: string) => "django:team:" + value;
      function findTeam(event: string, email: string) {
        const found = teams.find(t => t.hackathonId === event && t.userEmail.toLowerCase() === email.toLowerCase());
        if (!found) throw new Error("Missing legacy team reference");
        return teamId(found.id);
      }
      for (const team of teams) {
        const leaderId = account(team.userEmail, "student"), registrationId = teamId(team.id);
        tx.insert(registrations).values({ id: registrationId, hackathonId: eventId(team.hackathonId), leaderId, status: team.status, teamName: team.teamName, createdAt: team.timestamp }).run();
        const members = team.members?.length ? team.members : (team.memberNames || []).map(name => ({ name, email: "", phone: "", college: "" }));
        if (!members.some(m => m.email?.toLowerCase() === team.userEmail.toLowerCase() || (!m.email && m.name === team.userName))) members.unshift({ name: team.userName, email: team.userEmail, phone: "", college: "" });
        for (const m of members) {
          const email = m.email?.trim().toLowerCase() || (m.name === team.userName ? team.userEmail.toLowerCase() : "");
          // Old members without an email stay unlinked. Use a unique non-deliverable placeholder for the database constraint.
          tx.insert(teamMembers).values({ id: randomUUID(), registrationId, userId: email === team.userEmail.toLowerCase() ? leaderId : null, name: m.name, email: email || randomUUID() + "@legacy.invalid", phone: m.phone || "", college: m.college || "" }).run();
        }
        if (team.qrTokenUsed) {
          const time = team.scannedAt || team.timestamp;
          tx.insert(checkinTokens).values({ id: randomUUID(), registrationId, purpose: "entry", day: 0, tokenHash: sha(randomUUID()), redeemedAt: time, expiresAt: time }).run();
        }
      }
      for (const item of github) tx.insert(submissions).values({ id: randomUUID(), registrationId: findTeam(item.hackathonId,item.userEmail), hackathonId: eventId(item.hackathonId), ownerId: account(item.userEmail,"student"), kind: "github", name: "Repository", url: item.url, createdAt: item.submittedAt }).run();
      for (const [i,d] of decks.entries()) {
        const file = files[i], ownerId = account(d.userEmail, "student");
        let fileId: string | null = null;
        if (file) {
          const storedName = "legacy-" + file.hash + ".pdf";
          const target = path.resolve(env.UPLOAD_DIR, storedName);
          mkdirSync(env.UPLOAD_DIR, { recursive: true });
          if (!existsSync(target)) { writeFileSync(target, file.bytes, { flag: "wx" }); newFiles.push(target); }
          if (sha(readFileSync(target)) !== file.hash) throw new Error("PDF checksum mismatch");
          const prior = tx.select().from(fileUploads).where(eq(fileUploads.storedName, storedName)).get();
          if (prior && prior.ownerId !== ownerId) throw new Error("Shared PDF requires explicit ownership review");
          fileId = prior?.id || randomUUID();
          if (!prior) tx.insert(fileUploads).values({ id: fileId, ownerId, originalName: file.name, storedName, mimeType: "application/pdf", size: file.bytes.length }).run();
        }
        tx.insert(submissions).values({ id: randomUUID(), ownerId, registrationId: findTeam(d.hackathonId,d.userEmail), hackathonId: eventId(d.hackathonId), kind: "presentation", roundId: d.roundId, name: d.name, url: d.link || null, fileUploadId: fileId, createdAt: d.submittedAt }).run();
      }
      for (const a of assignments) {
        if (!teams.some(t => t.id === a.teamId && t.hackathonId === a.hackathonId)) throw new Error("Unresolved legacy judge assignment");
        tx.insert(evaluations).values({ id: randomUUID(), teamId: teamId(a.teamId), judgeId: account(a.judgeEmail,"judge"), score: a.judgeScore }).run();
      }
      for (const s of scans) tx.insert(checkinLogs).values({ id: "django:scan:" + s.id, hackathonId: eventId(s.hackathonId), registrationId: findTeam(s.hackathonId,s.userEmail), scannedBy: archivalActor, result: s.result, tokenHash: s.tokenHash, purpose: s.tokenType === "registration" ? "entry" : s.tokenType, message: "Imported legacy scan", scannedAt: s.scannedAt }).run();
      tx.insert(legacyStates).values({ key: marker, value: digest, updatedAt: new Date().toISOString() }).run();
      return "imported";
    }, { behavior: "immediate" });
    console.log({ ...summary, outcome });
  } catch (error) {
    for (const file of newFiles) unlinkSync(file);
    throw error;
  } finally { closeDatabase(); }
}
