import { expect, it } from "vitest";
import { getRegistrations } from "./hackathonStore";

it("reads name-only members and preserves email and check-in time on newer records", () => {
  const key = "sq_registrations";
  const scannedAt = "2026-10-29T12:00:00Z";
  localStorage.setItem(key, JSON.stringify([
    { memberNames: ["First"] },
    { members: ["Second", { name: "Third", email: "third@example.test" }], scannedAt },
  ]));
  try {
    const [legacy, current] = getRegistrations();
    expect(legacy.members[0]).toMatchObject({ name: "First", email: "" });
    expect(current.members[0].name).toBe("Second");
    expect(current.members[1].email).toBe("third@example.test");
    expect(current.scannedAt).toBe(scannedAt);
  } finally {
    localStorage.removeItem(key);
  }
});
