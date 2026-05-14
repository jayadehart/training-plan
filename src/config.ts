import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadProfile(): string {
  const path = resolve(__dirname, "../config/profile.md");
  return readFileSync(path, "utf-8").trim();
}
