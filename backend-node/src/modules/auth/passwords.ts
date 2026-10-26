import bcrypt from "bcrypt";
import { pbkdf2, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const scryptAsync = promisify(scrypt);
const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string) {
  if (Buffer.byteLength(password, "utf8") > 72) throw new Error("Password exceeds bcrypt's 72-byte limit");
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, ...parts] = storedHash.split("$");

  if (storedHash.startsWith("$2")) return Buffer.byteLength(password, "utf8") <= 72 && bcrypt.compare(password, storedHash);

  if (algorithm === "pbkdf2_sha256" && parts.length === 3) {
    const [iterationText, salt, encodedHash] = parts;
    const iterations = Number(iterationText);
    if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 2_000_000) return false;
    const expected = Buffer.from(encodedHash, "base64");
    if (!salt || expected.length !== 32) return false;
    const derived = await pbkdf2Async(password, salt, iterations, expected.length, "sha256") as Buffer;
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }

  if (algorithm === "scrypt" && parts.length === 2) {
    const [salt, encodedHash] = parts;
    const expected = Buffer.from(encodedHash, "base64");
    if (!salt || expected.length !== 64) return false;
    const derived = await scryptAsync(password, salt, expected.length) as Buffer;
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }

  return false;
}

export const needsRehash = (storedHash: string) => !storedHash.startsWith("$2");
