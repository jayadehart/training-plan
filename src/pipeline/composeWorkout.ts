import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { HistoryContext } from "./loadState";
import type { ChosenPaper } from "./paperAgent";
import type { ChosenVideo } from "./videoAgent";

const __dirname = dirname(fileURLToPath(import.meta.url));
const systemPrompt = readFileSync(
  resolve(__dirname, "../prompts/composeWorkout.md"),
  "utf-8",
);

export const drillSchema = z.object({
  name: z.string(),
  duration: z.number().positive(),
  sets: z.string(),
  cues: z.string(),
  references: z.array(z.string()).min(1),
});

export const workoutSchema = z.object({
  focus: z.string(),
  narrative: z.string(),
  drills: z.array(drillSchema).min(3).max(7),
  cooldown: z.string(),
  conceptsCovered: z.array(z.string()).min(3).max(8),
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
  });

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
    `Summary: ${args.paper.summary}`,
    `Integration hook: ${args.paper.integration}`,
    "",
    "## Chosen video",
    `URL: ${args.video.url}`,
    `Title: ${args.video.title}`,
    `Description: ${args.video.description}`,
    `Integration hook: ${args.video.integration}`,
  ].join("\n");

  const result = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userText),
  ]);
  const text =
    typeof result.content === "string"
      ? result.content
      : result.content
          .map((c) => (typeof c === "string" ? c : "text" in c ? c.text : ""))
          .join("\n");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`composeWorkout did not return JSON:\n${text}`);
  }
  const parsed = workoutSchema.parse(JSON.parse(jsonMatch[0]));
  return { ...parsed, date: args.date };
}
