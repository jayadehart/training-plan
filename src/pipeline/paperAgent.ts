import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { AgentTraceHandler } from "../observability/traceCallback";
import { arxivSearchTool } from "../tools/arxivSearch";
import { semanticScholarSearchTool } from "../tools/semanticScholarSearch";
import { fetchUrlTool, webSearchTool } from "../tools/webSearch";

const promptTemplate = readFileSync(
  new URL("../prompts/paperAgent.md", import.meta.url),
  "utf-8",
);

const paperChoiceSchema = z.object({
  url: z.url().describe("Full URL of the chosen paper or article"),
  title: z.string().describe("Title of the paper or article"),
  notes: z
    .string()
    .describe(
      "A paragraph describing the key insight and the specific cue or rule of thumb a coach could weave into a drill today.",
    ),
});

export type ChosenPaper = z.infer<typeof paperChoiceSchema>;

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

  const agent = createAgent({
    model,
    tools: [arxivSearchTool, semanticScholarSearchTool, webSearchTool, fetchUrlTool],
    systemPrompt,
    responseFormat: paperChoiceSchema,
  });

  const handler = new AgentTraceHandler(workoutDate, "paper");

  const result = await agent.invoke(
    {
      messages: [new HumanMessage("Find one paper or article for today's session.")],
    },
    { callbacks: [handler], recursionLimit: 30 },
  );

  if (!result.structuredResponse) {
    throw new Error("paperAgent did not produce a structured response");
  }
  return result.structuredResponse;
}
