import { tool } from "@langchain/core/tools";
import { z } from "zod";

const ARXIV_API = "http://export.arxiv.org/api/query";

interface ArxivResult {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  url: string;
}

function parseArxivXml(xml: string): ArxivResult[] {
  const entries = xml.split(/<entry>/).slice(1);
  return entries.map((entry) => {
    const get = (tag: string): string => {
      const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return match?.[1]?.trim().replace(/\s+/g, " ") ?? "";
    };
    const id = get("id");
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) =>
      (m[1] ?? "").trim(),
    );
    return {
      id,
      title: get("title"),
      summary: get("summary"),
      authors,
      published: get("published"),
      url: id,
    };
  });
}

export const arxivSearchTool = tool(
  async ({ query, maxResults }) => {
    const url = `${ARXIV_API}?search_query=${encodeURIComponent(
      `all:${query}`,
    )}&start=0&max_results=${maxResults}&sortBy=relevance`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`arXiv ${res.status}: ${await res.text()}`);
    const xml = await res.text();
    const results = parseArxivXml(xml);
    return JSON.stringify(
      results.map((r) => ({
        url: r.url,
        title: r.title,
        authors: r.authors.slice(0, 4),
        published: r.published,
        abstract: r.summary.slice(0, 800),
      })),
    );
  },
  {
    name: "arxiv_search",
    description:
      "Search arXiv for research papers on motor learning, sports science, skill acquisition, biomechanics, etc. Returns titles, authors, abstracts, and URLs.",
    schema: z.object({
      query: z.string().describe("Search query, e.g. 'motor learning chunking'"),
      maxResults: z.number().int().min(1).max(15).default(5),
    }),
  },
);
