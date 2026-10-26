import { env } from "../config/env";
import { AppError } from "../middleware/errors";

type FaceResult = { embedding: number[]; quality?: { faceWidth: number; faceHeight: number } };
type Comparison = { similarity: number; matchIndex: number | null; quality?: { faceWidth: number; faceHeight: number } };

async function post(endpoint: string, image: Express.Multer.File, references?: number[][]) {
  const form = new FormData();
  const bytes = Uint8Array.from(image.buffer);
  form.set("file", new Blob([bytes], { type: image.mimetype }), image.originalname);
  if (references) form.set("references", JSON.stringify(references));
  let response: Response;
  try {
    response = await fetch(`${env.FACE_SERVICE_URL}${endpoint}`, { method: "POST", headers: { "x-face-service-key": env.FACE_SERVICE_KEY }, body: form, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new AppError(503, "FACE_SERVICE_UNAVAILABLE", "Face verification is temporarily unavailable");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new AppError(response.status === 422 ? 400 : 503, "FACE_PROCESSING_FAILED", body.detail || "Unable to process that image");
  return body;
}

export async function createEmbedding(image: Express.Multer.File) {
  return post("/internal/face/embedding", image) as Promise<FaceResult>;
}

export async function compareEmbedding(image: Express.Multer.File, references: number[][]) {
  return post("/internal/face/compare", image, references) as Promise<Comparison>;
}
