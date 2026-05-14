import { tool } from "@langchain/core/tools";
import { google } from "googleapis";
import { z } from "zod";

function isoDurationToSeconds(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return h * 3600 + min * 60 + s;
}

export const youtubeSearchTool = tool(
  async ({ query, maxResults, maxDurationSeconds }) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY not set");
    const yt = google.youtube({ version: "v3", auth: apiKey });

    const search = await yt.search.list({
      q: query,
      part: ["snippet"],
      type: ["video"],
      maxResults,
      videoDuration: maxDurationSeconds <= 240 ? "short" : "any",
      safeSearch: "none",
    });
    const items = search.data.items ?? [];
    const ids = items
      .map((i) => i.id?.videoId)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return JSON.stringify([]);

    const details = await yt.videos.list({
      id: ids,
      part: ["contentDetails", "snippet", "statistics"],
    });
    type VideoDetails = NonNullable<typeof details.data.items>[number];
    const detailsByid = new Map<string, VideoDetails>();
    for (const v of details.data.items ?? []) {
      if (v.id) detailsByid.set(v.id, v);
    }

    const out = ids
      .map((id) => {
        const d = detailsByid.get(id);
        if (!d) return null;
        const duration = isoDurationToSeconds(d.contentDetails?.duration ?? "PT0S");
        if (duration === 0 || duration > maxDurationSeconds) return null;
        return {
          youtubeId: id,
          url: `https://www.youtube.com/watch?v=${id}`,
          title: d.snippet?.title ?? "",
          channel: d.snippet?.channelTitle ?? "",
          description: (d.snippet?.description ?? "").slice(0, 400),
          durationSeconds: duration,
          viewCount: d.statistics?.viewCount,
        };
      })
      .filter((v) => v !== null);

    return JSON.stringify(out);
  },
  {
    name: "youtube_search",
    description:
      "Search YouTube for short basketball training/move-breakdown videos. Returns id, url, title, channel, description, duration, view count. Filters to videos at or under maxDurationSeconds.",
    schema: z.object({
      query: z.string(),
      maxResults: z.number().int().min(1).max(15).default(8),
      maxDurationSeconds: z.number().int().min(15).max(600).default(90),
    }),
  },
);
