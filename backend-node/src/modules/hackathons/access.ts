import { and, eq } from "drizzle-orm";
import { db } from "../../config/db";
import { hackathons } from "../../db/schema";
import { AppError } from "../../middleware/errors";

export function requireOwnedEvent(eventId: string, ownerId: string) {
  const event = db.select().from(hackathons).where(and(eq(hackathons.id, eventId), eq(hackathons.ownerId, ownerId))).get();
  if (!event) throw new AppError(404, "HACKATHON_NOT_FOUND", "Hackathon not found or not owned by you");
  return event;
}
