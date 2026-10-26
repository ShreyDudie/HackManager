import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: unknown) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof MulterError) {
    response.status(400).json({ error: { code: error.code, message: error.code === "LIMIT_FILE_SIZE" ? "File exceeds the upload size limit" : "Invalid file upload" } });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message, fields: error.fields } });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } });
    return;
  }

  console.error(error);
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
};
