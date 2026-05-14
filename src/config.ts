import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Profile {
  name: string;
  skillLevel: string;
  position: string;
  height: string;
  dominantHand: string;
  equipment: string[];
  sessionLengthMinutes: number;
  intensity: string;
  goals: string[];
  constraints: string[];
  notes: string;
}

export function loadProfile(): Profile {
  const path = resolve(__dirname, "../config/profile.yml");
  const text = readFileSync(path, "utf-8");
  return parse(text) as Profile;
}

export function renderProfile(p: Profile): string {
  const lines = [
    `Name: ${p.name || "(unset)"}`,
    `Skill level: ${p.skillLevel || "(unset)"}`,
    `Position: ${p.position || "(unset)"}`,
    `Height: ${p.height || "(unset)"}`,
    `Dominant hand: ${p.dominantHand || "(unset)"}`,
    `Equipment: ${p.equipment.join(", ") || "(none)"}`,
    `Session length: ${p.sessionLengthMinutes} minutes`,
    `Intensity: ${p.intensity || "(unset)"}`,
    `Goals: ${p.goals.filter(Boolean).join("; ") || "(none)"}`,
    `Constraints: ${p.constraints.filter(Boolean).join("; ") || "(none)"}`,
    p.notes ? `Notes: ${p.notes}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
