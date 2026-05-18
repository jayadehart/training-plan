import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { readFileSync } from "node:fs";
import { composedWorkoutSchema, type Workout } from "../workout";
import type { HistoryContext } from "./loadState";
import type { ChosenPaper } from "./paperAgent";
import type { ChosenVideo } from "./videoAgent";

const systemPrompt = readFileSync(
  new URL("../prompts/composeWorkout.md", import.meta.url),
  "utf-8",
);

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
  }).withStructuredOutput(composedWorkoutSchema);

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

  const composed = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userText),
  ]);

  return {
    ...composed,
    date: args.date,
    paper: {
      url: args.paper.url,
      title: args.paper.title,
      notes: args.paper.notes,
    },
    video: {
      url: args.video.url,
      title: args.video.title,
      youtubeId: args.video.youtubeId,
      notes: args.video.notes,
    },
  };
}
