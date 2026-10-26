import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import multer from "multer";
import { db } from "../../config/db";
import { env } from "../../config/env";
import { fileUploads, hackathons, submissions } from "../../db/schema";
import { requireAuth, type AuthUser } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
export const uploadRouter = Router();
export const mediaRouter = Router();

uploadRouter.post("/auth/pdf-upload/", requireAuth, upload.single("file"), async (request, response, next) => {
  try {
    const file = request.file;
    if (!file || file.mimetype !== "application/pdf" || !file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new AppError(400, "INVALID_PDF", "Only valid PDF files are allowed");
    const user = response.locals.user as AuthUser;
    const extension = path.extname(file.originalname).toLowerCase() || ".pdf";
    const storedName = `${randomUUID()}${extension}`;
    await mkdir(env.UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(env.UPLOAD_DIR, storedName), file.buffer);
    const document = { id: randomUUID(), ownerId: user.id, originalName: path.basename(file.originalname), storedName, mimeType: "application/pdf", size: file.size };
    db.insert(fileUploads).values(document).run();
    response.status(201).json({ id: document.id, url: `${request.protocol}://${request.get("host")}/media/${document.id}`, filename: document.originalName });
  } catch (error) { next(error); }
});

mediaRouter.get("/media/:id", requireAuth, async (request, response, next) => {
  try {
    const document = db.select().from(fileUploads).where(eq(fileUploads.id, String(request.params.id))).get();
    const user = response.locals.user as AuthUser;
    const organizerAccess = document && user.role === "admin" && db.select({ id: submissions.id }).from(submissions).innerJoin(hackathons, eq(submissions.hackathonId, hackathons.id)).where(and(eq(submissions.fileUploadId, document.id), eq(hackathons.ownerId, user.id))).get();
    if (!document || (document.ownerId !== user.id && !organizerAccess)) throw new AppError(404, "FILE_NOT_FOUND", "File not found");
    const file = await readFile(path.join(env.UPLOAD_DIR, document.storedName)).catch(() => null);
    if (!file) throw new AppError(404, "FILE_NOT_FOUND", "File is no longer available");
    response.type(document.mimeType).attachment(document.originalName).send(file);
  } catch (error) { next(error); }
});
