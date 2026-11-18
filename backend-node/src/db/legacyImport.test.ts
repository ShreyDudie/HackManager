import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

test("legacy import rolls back collisions and never restores an old password on replay", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hm-import-test-"));
  const target = path.join(dir, "target.db");
  const sourcePath = path.join(dir, "source.db");
  const run = (script: string) => spawnSync(process.execPath, ["--import", "tsx", "scripts/" + script], {
    env: { ...process.env, LEGACY_DATABASE_PATH: sourcePath, DB_FILE_NAME: target, UPLOAD_DIR: dir }, encoding: "utf8",
  });
  const source = new Database(sourcePath);
  const dest = new Database(target);
  try {
    source.exec("CREATE TABLE accounts_user(id,email,username,role,phone_number,password); CREATE TABLE accounts_sharedstate(key,value,updated_at)");
    source.prepare("INSERT INTO accounts_user VALUES (1, ?, 'Student','student', null, 'old')").run("a@example.test");
    assert.equal(run("migrate.ts").status, 0);
    dest.exec("INSERT INTO users(id,email,username,role,password_hash) VALUES ('existing','a@example.test','Existing','student','keep')");
    assert.notEqual(run("importLegacyData.ts").status, 0);
    assert.deepEqual(dest.prepare("SELECT id,password_hash FROM users").all(), [{ id: "existing", password_hash: "keep" }]);
    dest.exec("UPDATE users SET email='b@example.test' WHERE id='existing'");
    assert.equal(run("importLegacyData.ts").status, 0);
    dest.exec("UPDATE users SET password_hash='upgraded' WHERE legacy_id=1");
    assert.equal(run("importLegacyData.ts").status, 0);
    assert.deepEqual(dest.prepare("SELECT password_hash FROM users WHERE legacy_id=1").get(), {password_hash: "upgraded"});
    source.exec("INSERT INTO accounts_sharedstate VALUES ('new', '[]', '2026-11-18')");
    assert.notEqual(run("importLegacyData.ts").status, 0);
  } finally {
    source.close();
    dest.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
