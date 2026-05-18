import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { AgentTraceHandler } from "../observability/traceCallback";
import { geminiWatchVideoTool } from "../tools/geminiWatchVideo";
import { youtubeSearchTool } from "../tools/youtubeSearch";
import { youtubeTranscriptTool } from "../tools/youtubeTranscript";

const promptTemplate = readFileSync(
  new URL("../prompts/videoAgent.md", import.meta.url),
  "utf-8",
);

const videoChoiceSchema = z.object({
  url: z.url().describe("Full YouTube watch URL, e.g. https://www.youtube.com/watch?v=XXXX"),
  title: z.string().describe("Video title"),
  notes: z
    .string()
    .describe(
      "A paragraph describing the move/concept taught, the coach's cues, and how this becomes today's drill block (reps, intensity, focus).",
    ),
});

type VideoChoice = z.infer<typeof videoChoiceSchema>;
export type ChosenVideo = VideoChoice & { youtubeId: string };

function extractYoutubeId(url: string): string {
  const m = /[?&]v=([A-Za-z0-9_-]{11})/.exec(url) ?? /youtu\.be\/([A-Za-z0-9_-]{11})/.exec(url);
  if (!m) throw new Error(`Could not extract YouTube id from URL: ${url}`);
  return m[1] as string;
}

export async function runVideoAgent(
  focus: string,
  usedVideoIds: Set<string>,
  workoutDate: string,
): Promise<ChosenVideo> {
  const usedList =
    usedVideoIds.size === 0
      ? "(none yet)"
      : [...usedVideoIds].map((id) => `- ${id}`).join("\n");

  const systemPrompt = promptTemplate
    .replace("{{FOCUS}}", focus)
    .replace("{{USED_VIDEOS}}", usedList);

  const model = new ChatAnthropic({
    model: "claude-sonnet-4-6",
    temperature: 0.5,
    maxTokens: 2000,
  });

  const agent = createAgent({
    model,
    tools: [youtubeSearchTool, youtubeTranscriptTool, geminiWatchVideoTool],
    systemPrompt,
    responseFormat: videoChoiceSchema,
  });

  const handler = new AgentTraceHandler(workoutDate, "video");

  const result = await agent.invoke(
    {
      messages: [new HumanMessage("Find one short basketball training video for today's session.")],
    },
    { callbacks: [handler], recursionLimit: 30 },
  );

  if (!result.structuredResponse) {
    throw new Error("videoAgent did not produce a structured response");
  }
  const choice = result.structuredResponse;
  return { ...choice, youtubeId: extractYoutubeId(choice.url) };
}
