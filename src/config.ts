import { readFileSync } from "node:fs";

export function loadProfile(): string {
  return readFileSync(
    new URL("../config/profile.md", import.meta.url),
    "utf-8",
  ).trim();
}
