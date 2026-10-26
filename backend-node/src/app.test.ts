import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import jwt from "jsonwebtoken";

const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "hackmanager-api-"));
process.env.DB_FILE_NAME = path.join(runtimeDirectory, "test.db");
process.env.UPLOAD_DIR = path.join(runtimeDirectory, "uploads");
process.env.BIOMETRIC_DIR = path.join(runtimeDirectory, "biometrics");
const { migrateDatabase } = await import("../scripts/migrate");
migrateDatabase();
const { app } = await import("./app");
const { closeDatabase, db } = await import("./config/db");
const { env } = await import("./config/env");
const { hashPassword } = await import("./modules/auth/passwords");
const { hackathons, users } = await import("./db/schema");
const api = request(app);

let token = "";

after(async () => {
  closeDatabase();
  await rm(runtimeDirectory, { recursive: true, force: true });
});

test("auth and PDF compatibility endpoints enforce ownership", async () => {
  const signup = await api.post("/api/auth/signup/").send({ email: "student@example.com", username: "Student", password: "safe-password", role: "student" });
  assert.equal(signup.status, 201);

  const login = await api.post("/api/auth/login/").send({ email: "student@example.com", password: "safe-password", role: "student" });
  assert.equal(login.status, 200);
  token = login.body.access;

  const me = await api.get("/api/auth/me").set("authorization", `Bearer ${token}`);
  assert.deepEqual(me.body, { id: db.select().from(users).get()!.id, email: "student@example.com", username: "Student", role: "student" });

  const invalidUpload = await api.post("/api/auth/pdf-upload/").set("authorization", `Bearer ${token}`);
  assert.equal(invalidUpload.status, 400);

  const uploaded = await api.post("/api/auth/pdf-upload/").set("authorization", `Bearer ${token}`).attach("file", Buffer.from("%PDF-1.4\n"), { filename: "deck.pdf", contentType: "application/pdf" });
  assert.equal(uploaded.status, 201);
  const document = uploaded.body as { url: string };
  const download = await api.get(new URL(document.url).pathname).set("authorization", `Bearer ${token}`);
  assert.equal(download.status, 200);
  assert.equal((download.body as Buffer).toString(), "%PDF-1.4\n");
});

test("admins create hackathons and students register a team once", async () => {
  const adminId = "admin-contract-test";
  db.insert(users).values({ id: adminId, email: "admin@example.com", username: "Admin", role: "admin", passwordHash: await hashPassword("safe-password") }).run();
  const adminToken = jwt.sign({ id: adminId, email: "admin@example.com", role: "admin" }, env.JWT_SECRET, { subject: adminId, expiresIn: "7d" });
  const created = await api.post("/api/hackathons").set("authorization", `Bearer ${adminToken}`).send({
    name: "Campus Build", description: "A weekend prototype event", startDate: "2099-11-08", endDate: "2099-11-09", registrationDeadline: "2099-11-07", minTeamSize: 2, maxTeamSize: 3, status: "Open",
  });
  assert.equal(created.status, 201);
  assert.equal(db.select().from(hackathons).all().length, 1);

  const registration = await api.post(`/api/hackathons/${created.body.id}/registrations`).set("authorization", `Bearer ${token}`).send({ teamName: "Cobalt Crew", members: [{ name: "Teammate", email: "teammate@example.com", college: "VJTI" }] });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.members.length, 2);

  const duplicate = await api.post(`/api/hackathons/${created.body.id}/registrations`).set("authorization", `Bearer ${token}`).send({ teamName: "Second Team", members: [{ name: "Teammate", email: "teammate@example.com" }] });
  assert.equal(duplicate.status, 409);

  const mine = await api.get(`/api/hackathons/${created.body.id}/registrations/me`).set("authorization", `Bearer ${token}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.teamName, "Cobalt Crew");

  const repository = await api.post(`/api/hackathons/${created.body.id}/submissions/github`).set("authorization", `Bearer ${token}`).send({ name: "Cobalt repository", url: "https://github.com/cobalt/crew" });
  assert.equal(repository.status, 201);

  const presentation = await api.post(`/api/hackathons/${created.body.id}/submissions/presentation`).set("authorization", `Bearer ${token}`).send({ roundId: "final", name: "Pitch deck", link: "https://slides.example.com/cobalt" });
  assert.equal(presentation.status, 201);

  const submitted = await api.get(`/api/hackathons/${created.body.id}/submissions/me`).set("authorization", `Bearer ${token}`);
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.length, 2);

  const organizerSubmissions = await api.get(`/api/hackathons/${created.body.id}/submissions`).set("authorization", `Bearer ${adminToken}`);
  assert.equal(organizerSubmissions.body.length, 2);
  const studentReadingOthers = await api.get(`/api/hackathons/${created.body.id}/submissions`).set("authorization", `Bearer ${token}`);
  assert.equal(studentReadingOthers.status, 403);
  const unsafeLink = await api.post(`/api/hackathons/${created.body.id}/submissions/presentation`).set("authorization", `Bearer ${token}`).send({ name: "Unsafe", link: "javascript:alert(1)" });
  assert.equal(unsafeLink.status, 400);

  const entryToken = await api.post(`/api/hackathons/${created.body.id}/check-ins/token`).set("authorization", `Bearer ${token}`).send({ purpose: "entry", day: 0 });
  assert.equal(entryToken.status, 201);
  const replacement = await api.post(`/api/hackathons/${created.body.id}/check-ins/token`).set("authorization", `Bearer ${token}`).send({ purpose: "entry", day: 0 });
  assert.equal(replacement.status, 201);
  const stalePass = await api.post("/api/check-ins/redeem").set("authorization", `Bearer ${adminToken}`).send({ token: entryToken.body.token });
  assert.equal(stalePass.body.result, "invalid");
  const entryRedemption = await api.post("/api/check-ins/redeem").set("authorization", `Bearer ${adminToken}`).send({ token: replacement.body.token });
  assert.deepEqual(entryRedemption.body.result, "valid");
  const duplicateRedemption = await api.post("/api/check-ins/redeem").set("authorization", `Bearer ${adminToken}`).send({ token: replacement.body.token });
  assert.equal(duplicateRedemption.body.result, "duplicate");

  const breakfastToken = await api.post(`/api/hackathons/${created.body.id}/check-ins/token`).set("authorization", `Bearer ${token}`).send({ purpose: "breakfast", day: 1 });
  assert.equal(breakfastToken.status, 201);
  const breakfastRedemption = await api.post("/api/check-ins/redeem").set("authorization", `Bearer ${adminToken}`).send({ token: breakfastToken.body.token });
  assert.equal(breakfastRedemption.body.result, "valid");

  const unrelatedId = "other-admin";
  db.insert(users).values({ id: unrelatedId, email: "other-admin@example.com", username: "Other", role: "admin", passwordHash: "unused" }).run();
  const unrelatedToken = jwt.sign({}, env.JWT_SECRET, { subject: unrelatedId, expiresIn: "1h" });
  for (const resource of ["registrations", "submissions", "check-ins"]) {
    const result = await api.get(`/api/hackathons/${created.body.id}/${resource}`).set("authorization", `Bearer ${unrelatedToken}`);
    assert.equal(result.status, 404);
  }
  const uploaded = await api.post("/api/auth/pdf-upload/").set("authorization", `Bearer ${token}`).attach("file", Buffer.from("%PDF-1.4\n"), { filename: "team.pdf", contentType: "application/pdf" });
  const linked = await api.post(`/api/hackathons/${created.body.id}/submissions/presentation`).set("authorization", `Bearer ${token}`).send({ name: "Private pitch", fileId: uploaded.body.id });
  assert.equal(linked.status, 201);
  const ownerDownload = await api.get(`/media/${uploaded.body.id}`).set("authorization", `Bearer ${adminToken}`);
  assert.equal(ownerDownload.status, 200);
  const unrelatedDownload = await api.get(`/media/${uploaded.body.id}`).set("authorization", `Bearer ${unrelatedToken}`);
  assert.equal(unrelatedDownload.status, 404);

  const closed = await api.post("/api/hackathons").set("authorization", `Bearer ${adminToken}`).send({ name: "Past event", description: "Registration ended", startDate: "2020-11-08", endDate: "2020-11-09", registrationDeadline: "2020-11-07", minTeamSize: 1, maxTeamSize: 3, status: "Open" });
  const late = await api.post(`/api/hackathons/${closed.body.id}/registrations`).set("authorization", `Bearer ${token}`).send({ teamName: "Late team" });
  assert.equal(late.status, 409);
  const spoofed = jwt.sign({ id: "nonexistent", role: "admin" }, env.JWT_SECRET, { subject: "nonexistent", expiresIn: "1h" });
  assert.equal((await api.get("/api/auth/me").set("authorization", `Bearer ${spoofed}`)).status, 401);
  assert.equal((await api.get("/api/auth/me").set("authorization", token)).status, 401);
});
