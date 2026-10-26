import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { eq } from "drizzle-orm";
import multer from "multer";
import { db } from "../../config/db";
import { env } from "../../config/env";
import { faceProfiles, users } from "../../db/schema";
import { requireAuth, type AuthUser } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";
import { compareEmbedding, createEmbedding } from "../../integrations/faceService";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith("image/")) });
const faceRouter = Router();

faceRouter.post("/register", requireAuth, upload.single("file"), async (_request, response, next) => {
  try {
    const image = _request.file;
    if (!image) throw new AppError(400, "IMAGE_REQUIRED", "Upload a face image");
    const user = response.locals.user as AuthUser;
    const result = await createEmbedding(image);
    if (!Array.isArray(result.embedding) || result.embedding.length === 0) throw new AppError(503, "FACE_PROCESSING_FAILED", "Face service returned an invalid embedding");
    await mkdir(env.BIOMETRIC_DIR, { recursive: true });
    const imagePath = path.join(env.BIOMETRIC_DIR, `${user.id}-${randomUUID()}.jpg`);
    await writeFile(imagePath, image.buffer);
    db.insert(faceProfiles).values({ id: randomUUID(), userId: user.id, embedding: JSON.stringify(result.embedding), imagePath }).onConflictDoUpdate({ target: faceProfiles.userId, set: { embedding: JSON.stringify(result.embedding), imagePath, updatedAt: new Date().toISOString() } }).run();
    response.json({ success: true, message: "Face registered successfully" });
  } catch (error) { next(error); }
});

faceRouter.post("/verify", requireAuth, upload.single("file"), async (request, response, next) => {
  try {
    const image = request.file;
    if (!image) throw new AppError(400, "IMAGE_REQUIRED", "Upload a face image");
    const actor = response.locals.user as AuthUser;
    const requestedEmail = typeof request.query.email === "string" ? request.query.email.trim().toLowerCase() : actor.email;
    if (requestedEmail !== actor.email && actor.role !== "admin") throw new AppError(403, "FORBIDDEN", "You can only verify your own face");
    const target = db.select().from(users).where(eq(users.email, requestedEmail)).get();
    const profile = target ? db.select().from(faceProfiles).where(eq(faceProfiles.userId, target.id)).get() : undefined;
    if (!target || !profile) return response.json({ success: true, verified: false, message: "No registered face found for this user", similarity: 0 });
    const reference = JSON.parse(profile.embedding) as number[];
    const result = await compareEmbedding(image, [reference]);
    const verified = result.matchIndex === 0 && result.similarity >= 0.7;
    response.json({ success: true, verified, similarity: Number(result.similarity.toFixed(4)), pid: verified ? target.email : null });
  } catch (error) { next(error); }
});

export { faceRouter };
