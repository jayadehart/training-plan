import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { HistoryContext } from "./loadState";
import type { ChosenPaper } from "./paperAgent";
import type { ChosenVideo } from "./videoAgent";

const systemPrompt = readFileSync(
  new URL("../prompts/composeWorkout.md", import.meta.url),
  "utf-8",
);

export const drillSchema = z.object({
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

export const workoutSchema = z.object({
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
    .describe("Warmup + 3–5 main drills + cooldown. Total time = session length from profile."),
  conceptsCovered: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe(
      'Specific concept tags the next session will read as history, e.g. "split-step footwork", "elastic landing"',
    ),
});

export type Workout = z.infer<typeof workoutSchema> & { date: string };

export async function composeWorkout(args: {
  date: string;
  profile: string;
  history: HistoryContext;
  focus: string;
  paper: ChosenPaper;
  video: ChosenVideo;
}): Promise<Workout> {

  const model = new ChatAnthropic({
    model: "claude-opus-4-7",
    maxTokens: 3000,
  }).withStructuredOutput(workoutSchema);

  const userText = [
    "## Player profile",
    args.profile,
    "",
    "## Recent history",
    args.history.historyText,
    "",
    "## Today's focus",
    args.focus,
    "",
    "## Chosen paper",
    `URL: ${args.paper.url}`,
    `Title: ${args.paper.title}`,
    `Notes: ${args.paper.notes}`,
    "",
    "## Chosen video",
    `URL: ${args.video.url}`,
    `Title: ${args.video.title}`,
    `Notes: ${args.video.notes}`,
  ].join("\n");

  const parsed = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userText),
  ]);
  return { ...parsed, date: args.date };
}
