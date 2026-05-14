import { tool } from "@langchain/core/tools";
import { z } from "zod";

const SS_API = "https://api.semanticscholar.org/graph/v1/paper/search";

interface SsPaper {
  paperId: string;
  title: string;
  abstract: string | null;
  authors: Array<{ name: string }>;
  year: number | null;
  url: string;
  venue: string | null;
}

export const semanticScholarSearchTool = tool(
  async ({ query, maxResults }) => {
    const url = `${SS_API}?query=${encodeURIComponent(
      query,
    )}&limit=${maxResults}&fields=title,abstract,authors,year,url,venue`;
    const res = await fetch(url, {
      headers: process.env.SEMANTIC_SCHOLAR_API_KEY
        ? { "x-api-key": process.env.SEMANTIC_SCHOLAR_API_KEY }
        : {},
    });
    if (!res.ok) throw new Error(`SemanticScholar ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { data?: SsPaper[] };
    const papers = data.data ?? [];
    return JSON.stringify(
      papers.map((p) => ({
        url: p.url,
        title: p.title,
        authors: p.authors.slice(0, 4).map((a) => a.name),
        year: p.year,
        venue: p.venue,
        abstract: (p.abstract ?? "").slice(0, 800),
      })),
    );
  },
  {
    name: "semantic_scholar_search",
    description:
      "Search Semantic Scholar for academic papers across all fields including sports science, motor learning, and skill acquisition. Returns titles, authors, abstracts, and URLs.",
    schema: z.object({
      query: z.string(),
      maxResults: z.number().int().min(1).max(15).default(5),
    }),
  },
);
