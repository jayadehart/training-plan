import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export const webSearchTool = tool(
  async ({ query, maxResults }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY not set");
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: "basic",
        include_answer: false,
      }),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { results?: TavilyResult[] };
    const results = data.results ?? [];
    return JSON.stringify(
      results.map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.content.slice(0, 600),
      })),
    );
  },
  {
    name: "web_search",
    description:
      "Search the open web for basketball coaching blogs, sports science articles, training methodology posts, and other non-academic sources.",
    schema: z.object({
      query: z.string(),
      maxResults: z.number().int().min(1).max(10).default(5),
    }),
  },
);

export const fetchUrlTool = tool(
  async ({ url }) => {
    const res = await fetch(url, {
      headers: { "User-Agent": "training-plan-bot/0.1" },
    });
    if (!res.ok) throw new Error(`Fetch ${res.status}`);
    const text = await res.text();
    const stripped = text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return stripped.slice(0, 6000);
  },
  {
    name: "fetch_url",
    description:
      "Fetch and return the text content of a URL. Use after a search to read the full article/abstract.",
    schema: z.object({ url: z.string().url() }),
  },
);
