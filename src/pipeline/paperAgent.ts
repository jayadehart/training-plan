import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentTraceHandler } from "../observability/traceCallback";
import { arxivSearchTool } from "../tools/arxivSearch";
import { semanticScholarSearchTool } from "../tools/semanticScholarSearch";
import { fetchUrlTool, webSearchTool } from "../tools/webSearch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptTemplate = readFileSync(
  resolve(__dirname, "../prompts/paperAgent.md"),
  "utf-8",
);

export interface ChosenPaper {
  url: string;
  title: string;
  summary: string;
  integration: string;
  rawText: string;
}

function parseChoice(text: string): ChosenPaper {
  const get = (label: string): string => {
    const m = new RegExp(`^${label}:\\s*(.+?)(?=^[A-Z_]+:|$)`, "ms").exec(text);
    return (m?.[1] ?? "").trim();
  };
  const url = get("CHOICE_URL");
  const title = get("CHOICE_TITLE");
  const summary = get("CHOICE_SUMMARY");
  const integration = get("INTEGRATION");
  if (!url || !title) {
    throw new Error(`paperAgent did not produce a valid choice block:\n${text}`);
  }
  return { url, title, summary, integration, rawText: text };
}

export async function runPaperAgent(
  focus: string,
  usedPaperUrls: Set<string>,
  workoutDate: string,
): Promise<ChosenPaper> {
  const usedList =
    usedPaperUrls.size === 0
      ? "(none yet)"
      : [...usedPaperUrls].map((u) => `- ${u}`).join("\n");

  const systemPrompt = promptTemplate
    .replace("{{FOCUS}}", focus)
    .replace("{{USED_PAPERS}}", usedList);

  const model = new ChatAnthropic({
    model: "claude-sonnet-4-6",
    temperature: 0.5,
    maxTokens: 2000,
  });

  const agent = createReactAgent({
    llm: model,
    tools: [arxivSearchTool, semanticScholarSearchTool, webSearchTool, fetchUrlTool],
    stateModifier: systemPrompt,
  });

  const handler = new AgentTraceHandler(workoutDate, "paper");

  const result = await agent.invoke(
    {
      messages: [new HumanMessage("Find one paper or article for today's session.")],
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
