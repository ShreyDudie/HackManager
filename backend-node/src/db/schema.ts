import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  legacyId: integer("legacy_id").unique(),
  email: text("email").notNull().unique(),
  username: text("username").notNull(),
  role: text("role").notNull(),
  phoneNumber: text("phone_number").unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const fileUploads = sqliteTable("file_uploads", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const faceProfiles = sqliteTable("face_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  embedding: text("embedding").notNull(),
  imagePath: text("image_path").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const legacyStates = sqliteTable("legacy_states", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const hackathons = sqliteTable("hackathons", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  registrationDeadline: text("registration_deadline").notNull(),
  minTeamSize: integer("min_team_size").notNull(),
  maxTeamSize: integer("max_team_size").notNull(),
  status: text("status").notNull().default("Coming Soon"),
  theme: text("theme").notNull().default(""),
  rules: text("rules").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const registrations = sqliteTable("registrations", {
  id: text("id").primaryKey(),
  hackathonId: text("hackathon_id").notNull().references(() => hackathons.id, { onDelete: "cascade" }),
  leaderId: text("leader_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  teamName: text("team_name").notNull(),
  status: text("status").notNull().default("In Process"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("registrations_event_leader_unique").on(table.hackathonId, table.leaderId)]);

export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  registrationId: text("registration_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  college: text("college").notNull().default(""),
  verificationStatus: integer("verification_status", { mode: "boolean" }).notNull().default(false),
}, (table) => [uniqueIndex("team_members_registration_email_unique").on(table.registrationId, table.email)]);

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  hackathonId: text("hackathon_id").notNull().references(() => hackathons.id, { onDelete: "cascade" }),
  registrationId: text("registration_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  roundId: text("round_id").notNull().default(""),
  name: text("name").notNull().default(""),
  url: text("url"),
  fileUploadId: text("file_upload_id").references(() => fileUploads.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("submissions_event_owner_kind_round_unique").on(table.hackathonId, table.ownerId, table.kind, table.roundId)]);

export const checkinTokens = sqliteTable("checkin_tokens", {
  id: text("id").primaryKey(),
  registrationId: text("registration_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  day: integer("day").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  redeemedAt: text("redeemed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("checkin_tokens_registration_purpose_day_unique").on(table.registrationId, table.purpose, table.day)]);

export const checkinLogs = sqliteTable("checkin_logs", {
  id: text("id").primaryKey(),
  hackathonId: text("hackathon_id").references(() => hackathons.id, { onDelete: "set null" }),
  registrationId: text("registration_id").references(() => registrations.id, { onDelete: "set null" }),
  tokenId: text("token_id").references(() => checkinTokens.id, { onDelete: "set null" }),
  scannedBy: text("scanned_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  purpose: text("purpose").notNull(),
  tokenHash: text("token_hash").notNull(),
  result: text("result").notNull(),
  message: text("message").notNull(),
  scannedAt: text("scanned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const evaluations = sqliteTable("evaluations", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
  judgeId: text("judge_id").notNull().references(() => users.id),
  score: integer("score"),
  feedback: text("feedback").notNull().default(""),
}, (t) => [uniqueIndex("evaluation_team_judge").on(t.teamId, t.judgeId)]);

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => hackathons.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => hackathons.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("Open"),
});

export const ticketMessages = sqliteTable("ticket_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  author: text("author").notNull().references(() => users.id),
  message: text("message").notNull(),
});
