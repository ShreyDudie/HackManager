import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { users } from "../db/schema";
import { env } from "../config/env";
import { AppError } from "./errors";

export type AuthUser = { id: string; email: string; role: "student" | "judge" | "admin" };

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = request.header("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue"));

  try {
    const claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof claims === "string" || typeof claims.sub !== "string") throw new Error("Invalid subject");
    const user = db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.id, claims.sub)).get();
    if (!user || !["student", "judge", "admin"].includes(user.role)) throw new Error("Account unavailable");
    response.locals.user = user;
    next();
  } catch {
    next(new AppError(401, "INVALID_TOKEN", "Your session has expired. Please sign in again."));
  }
}

export function requireRole(...roles: AuthUser["role"][]) {
  return (_request: Request, response: Response, next: NextFunction) => {
    const user = response.locals.user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) return next(new AppError(403, "FORBIDDEN", "You do not have access to this action"));
    next();
  };
}
