import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errorMessage(error: unknown, fallback = "Unknown error"): string {
  return error instanceof Error && error.message ? error.message : typeof error === "string" && error ? error : fallback;
}
