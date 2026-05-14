import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentTraceHandler } from "../observability/traceCallback";
import { geminiWatchVideoTool } from "../tools/geminiWatchVideo";
import { youtubeSearchTool } from "../tools/youtubeSearch";
import { youtubeTranscriptTool } from "../tools/youtubeTranscript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptTemplate = readFileSync(
  resolve(__dirname, "../prompts/videoAgent.md"),
  "utf-8",
);

export interface ChosenVideo {
  url: string;
  youtubeId: string;
  title: string;
  description: string;
  integration: string;
  rawText: string;
}

function extractYoutubeId(url: string): string {
  const m = /[?&]v=([A-Za-z0-9_-]{11})/.exec(url) ?? /youtu\.be\/([A-Za-z0-9_-]{11})/.exec(url);
  if (!m) throw new Error(`Could not extract YouTube id from URL: ${url}`);
  return m[1] as string;
}

function parseChoice(text: string): ChosenVideo {
  const get = (label: string): string => {
    const m = new RegExp(`^${label}:\\s*(.+?)(?=^[A-Z_]+:|$)`, "ms").exec(text);
    return (m?.[1] ?? "").trim();
  };
  const url = get("CHOICE_URL");
  const title = get("CHOICE_TITLE");
  const description = get("CHOICE_DESCRIPTION");
  const integration = get("INTEGRATION");
  if (!url || !title) {
    throw new Error(`videoAgent did not produce a valid choice block:\n${text}`);
  }
  return {
    url,
    youtubeId: extractYoutubeId(url),
    title,
    description,
    integration,
    rawText: text,
  };
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

  const agent = createReactAgent({
    llm: model,
    tools: [youtubeSearchTool, youtubeTranscriptTool, geminiWatchVideoTool],
    stateModifier: systemPrompt,
  });

  const handler = new AgentTraceHandler(workoutDate, "video");

  const result = await agent.invoke(
    {
      messages: [new HumanMessage("Find one short basketball training video for today's session.")],
    },
    { callbacks: [handler], recursionLimit: 30 },
  );

  const last = result.messages[result.messages.length - 1];
  const text =
    typeof last?.content === "string"
      ? last.content
      : (last?.content as Array<{ text?: string }> | undefined)
          ?.map((c) => c.text ?? "")
          .join("\n") ?? "";

  return parseChoice(text);
}
