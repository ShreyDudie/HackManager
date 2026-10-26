import assert from "node:assert/strict";
import test from "node:test";
import { pbkdf2Sync } from "node:crypto";
import { hashPassword, verifyPassword } from "./passwords";

test("verifies Django PBKDF2-SHA256 hashes and rejects wrong passwords", async () => {
  const salt = "legacy-salt";
  const digest = pbkdf2Sync("correct horse", salt, 1000, 32, "sha256").toString("base64");
  const djangoHash = `pbkdf2_sha256$1000$${salt}$${digest}`;

  assert.equal(await verifyPassword("correct horse", djangoHash), true);
  assert.equal(await verifyPassword("wrong password", djangoHash), false);
});

test("writes and verifies bcrypt password hashes", async () => {
  const hash = await hashPassword("correct horse");
  assert.match(hash, /^\$2[aby]\$/);
  assert.equal(await verifyPassword("correct horse", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("rejects malformed legacy hashes and bcrypt byte truncation", async () => {
  assert.equal(await verifyPassword("anything", "pbkdf2_sha256$1000$salt$"), false);
  assert.equal(await verifyPassword("anything", "scrypt$salt$"), false);
  await assert.rejects(hashPassword("é".repeat(37)), /72-byte/);
  const hash = await hashPassword("a".repeat(72));
  assert.equal(await verifyPassword("a".repeat(72) + "suffix", hash), false);
});
