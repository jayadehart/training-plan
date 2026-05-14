import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HistoryContext } from "./loadState";

const __dirname = dirname(fileURLToPath(import.meta.url));
const systemPrompt = readFileSync(
  resolve(__dirname, "../prompts/pickFocus.md"),
  "utf-8",
);

export async function pickFocus(
  profile: string,
  history: HistoryContext,
): Promise<string> {
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-6",
    temperature: 0.7,
    maxTokens: 600,
  });

  const userText = [
    "## Player profile",
    profile,
    "",
    "## Recent workout history",
    history.historyText,
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
  return text.trim();
}
