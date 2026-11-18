import { z } from "zod";
import { env } from "../../config/env";

const standardEmail = z.string().email();
const localAccounts = z.enum(["admin@hci", "judge@hci", "student@hci"]);

// Single-label IDs are only for provisioned local accounts.
export const accountEmail = z.string().trim().toLowerCase().pipe(
  env.NODE_ENV === "production" ? standardEmail : standardEmail.or(localAccounts),
);
