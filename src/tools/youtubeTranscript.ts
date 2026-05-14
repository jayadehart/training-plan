import { tool } from "@langchain/core/tools";
import { YoutubeTranscript } from "youtube-transcript";
import { z } from "zod";

export const youtubeTranscriptTool = tool(
  async ({ youtubeId }) => {
    try {
      const segments = await YoutubeTranscript.fetchTranscript(youtubeId);
      const text = segments.map((s) => s.text).join(" ");
      if (!text.trim()) return "NO_TRANSCRIPT_AVAILABLE";
      return text.slice(0, 5000);
    } catch (err) {
      return `NO_TRANSCRIPT_AVAILABLE (${(err as Error).message})`;
    }
  },
  {
    name: "youtube_transcript",
    description:
      "Fetch the caption/transcript of a YouTube video by id. Returns the transcript text, or 'NO_TRANSCRIPT_AVAILABLE' if none exists. Cheap context — try this before calling gemini_watch_video.",
    schema: z.object({
      youtubeId: z.string().describe("The YouTube video id (e.g. 'dQw4w9WgXcQ')"),
    }),
  },
);
