import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  DB_FILE_NAME: z.string().min(1).default("../data/hackmanager.db"),
  JWT_SECRET: z.string().min(32).default("development-secret-change-before-production"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:8080,http://127.0.0.1:8080"),
  FACE_SERVICE_URL: z.string().url().default("http://127.0.0.1:8001"),
  FACE_SERVICE_KEY: z.string().min(16).default("development-face-service-key"),
  UPLOAD_DIR: z.string().min(1).default("../data/uploads"),
  BIOMETRIC_DIR: z.string().min(1).default("../data/biometrics"),
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === "production" && env.JWT_SECRET.startsWith("development-")) {
  throw new Error("JWT_SECRET must be configured in production");
}
