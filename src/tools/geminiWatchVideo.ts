import { tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

const WATCH_PROMPT = `You are a basketball training analyst watching a short video.
Describe in concrete terms:
1. The basketball move or concept being taught (be specific — e.g. "split-step into pull-up", not "shooting").
2. The cues a coach would emphasize (footwork, hand placement, eyes, balance, etc.).
3. The skill level it's appropriate for (beginner / intermediate / advanced) and why.
4. How a player could turn this into a drill they could do in a 5-minute block.
Keep it under 200 words. Be specific and avoid generic advice.`;

let _model: ChatGoogleGenerativeAI | null = null;

function getModel(): ChatGoogleGenerativeAI {
  if (_model) return _model;
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  _model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-2.5-flash",
    temperature: 0.3,
  });
  return _model;
}

export const geminiWatchVideoTool = tool(
  async ({ youtubeUrl }) => {
    const model = getModel();
    const message = new HumanMessage({
      content: [
        { type: "media", fileUri: youtubeUrl, mimeType: "video/mp4" },
        { type: "text", text: WATCH_PROMPT },
      ],
    });
    const result = await model.invoke([message]);
    const text = typeof result.content === "string"
      ? result.content
      : result.content.map((c) => (typeof c === "string" ? c : "text" in c ? c.text : "")).join("\n");
    return text.trim();
  },
  {
    name: "gemini_watch_video",
    description:
      "Have Gemini actually watch a YouTube video and return a description of the basketball move, coaching cues, skill level, and how to drill it. Use this when transcript+metadata aren't enough to judge the video.",
    schema: z.object({
      youtubeUrl: z.string().url().describe("Full YouTube URL of the video to watch"),
    }),
  },
);
