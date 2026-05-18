import { z } from "zod";

const drillSchema = z.object({
  name: z.string().describe("Short name for the drill block"),
  duration: z.number().positive().describe("Duration in minutes"),
  sets: z.string().describe('Sets/reps format, e.g. "3x10" or "AMRAP 5min"'),
  cues: z.string().describe("1–3 sentences of specific coaching cues"),
  references: z
    .array(z.string())
    .min(1)
    .describe(
      'Which sources this drill draws from, e.g. ["paper", "video", "prior:2026-05-08"]',
    ),
});

export const composedWorkoutSchema = z.object({
  focus: z.string().describe("Today's focus, restated concisely"),
  narrative: z
    .string()
    .describe(
      "2–4 sentences weaving paper + video + history. Must name a prior workout date this builds on if history is non-empty.",
    ),
  drills: z
    .array(drillSchema)
    .min(3)
    .max(7)
    .describe("Warmup + 3–5 main drills. Total time = session length from profile."),
  conceptsCovered: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe(
      'Specific concept tags the next session will read as history, e.g. "split-step footwork", "elastic landing"',
    ),
});

export const persistedWorkoutSchema = composedWorkoutSchema.extend({
  date: z.string(),
  paper: z.object({ url: z.string(), title: z.string(), notes: z.string() }),
  video: z.object({
    url: z.string(),
    title: z.string(),
    youtubeId: z.string(),
    notes: z.string(),
  }),
});

export type ComposedWorkout = z.infer<typeof composedWorkoutSchema>;
export type Workout = z.infer<typeof persistedWorkoutSchema>;
