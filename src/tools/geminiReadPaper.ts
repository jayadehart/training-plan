import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

const READ_PROMPT = `You are a basketball training research assistant reading an academic paper.
Extract:
1. The paper's core finding or claim (1-2 sentences).
2. The methodology in brief — what they actually measured and how.
3. The single most actionable coaching cue or rule of thumb a basketball coach could weave into a drill today.
4. Limitations or caveats relevant to practical application.
Keep it under 250 words. Skip the literature review. Focus on what's useful in a gym.`;

let _model: ChatGoogleGenerativeAI | null = null;

function getModel(): ChatGoogleGenerativeAI {
  if (_model) return _model;
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  _model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-2.5-flash",
  });
  return _model;
}

export const geminiReadPaperTool = tool(
  async ({ pdfUrl }) => {
    const model = getModel();
    const message = new HumanMessage({
      content: [
        { type: "media", fileUri: pdfUrl, mimeType: "application/pdf" },
        { type: "text", text: READ_PROMPT },
      ],
    });
    const result = await model.invoke([message]);
    return result.text.trim();
  },
  {
    name: "gemini_read_paper",
    description:
      "Have Gemini read an academic paper PDF and return a focused summary: core finding, methodology, the single most actionable coaching cue, and caveats.",
    schema: z.object({
      pdfUrl: z.url().describe("Direct URL to the paper PDF"),
    }),
  },
);
