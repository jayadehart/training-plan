import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  END,
  ReducedValue,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import { z } from "zod";
import { geminiReadPaperTool } from "../tools/geminiReadPaper";
import { semanticScholarSearchTool } from "../tools/semanticScholarSearch";

const MAX_ATTEMPTS = 3;

const paperCandidateSchema = z.object({
  url: z.string(),
  pdfUrl: z.string(),
  title: z.string(),
  authors: z.array(z.string()).optional(),
  year: z.number().nullable().optional(),
  venue: z.string().nullable().optional(),
  abstract: z.string().optional(),
});

type PaperCandidate = z.infer<typeof paperCandidateSchema>;

const PaperState = new StateSchema({
  focus: z.string(),
  query: z.string().optional(),
  pastQueries: new ReducedValue(z.array(z.string()).default(() => []), {
    reducer: (current: string[], incoming: string[]) => current.concat(incoming),
  }),
  searchResults: z.array(paperCandidateSchema).default(() => []),
  attempts: z.number().default(0),
  selectedPaper: paperCandidateSchema.optional(),
  paperContent: z.string().optional(),
  triedPapers: new ReducedValue(z.array(z.string()).default(() => []), {
    reducer: (current: string[], incoming: string[]) => current.concat(incoming),
  }),
  actionable: z.boolean().optional(),
});

const model = new ChatAnthropic({
  model: "claude-sonnet-4-6",
  maxTokens: 1000,
  streaming: false,
});

const generateQuery: typeof PaperState.Node = async (state) => {
  const priorBlock = state.pastQueries.length
    ? `Previously tried queries (do not repeat or trivially rephrase):\n${state.pastQueries.map((q) => `- ${q}`).join("\n")}`
    : "(no prior attempts)";

  const result = await model.invoke([
    new SystemMessage(
      "You generate academic search queries for finding research papers that yield a concrete coaching cue for a basketball training session. Return ONLY the search query — no quotes, no commentary, no preamble.",
    ),
    new HumanMessage(
      `Today's focus: ${state.focus}\n\n${priorBlock}`,
    ),
  ]);

  const query = result.text.trim();
  return { query, pastQueries: [query] };
};

const searchPapers: typeof PaperState.Node = async (state) => {
  const raw = await semanticScholarSearchTool.invoke({
    query: state.query as string,
    maxResults: 5,
  });
  const papers = JSON.parse(raw) as PaperCandidate[];
  return {
    searchResults: papers,
    attempts: state.attempts + 1,
  };
};

const evaluateResults: typeof PaperState.Node = async (state) => {
  const fresh = state.searchResults.filter(
    (p) => !state.triedPapers.includes(p.url),
  );

  if (fresh.length === 0) {
    return { selectedPaper: undefined };
  }

  const DecisionSchema = z.object({
    relevant: z
      .boolean()
      .describe("True if at least one candidate is relevant enough to read in full."),
    chosenIndex: z
      .number()
      .int()
      .min(0)
      .nullable()
      .describe("Zero-based index of the chosen candidate, or null if none are relevant."),
    reasoning: z.string().describe("One sentence justifying the decision."),
  });
  const llm = model.withStructuredOutput(DecisionSchema);

  const candidates = fresh
    .map(
      (p, i) =>
        `[${i}] ${p.title}\n    venue: ${p.venue ?? "?"} (${p.year ?? "?"})\n    abstract: ${p.abstract ?? "(none)"}`,
    )
    .join("\n\n");

  const result = await llm.invoke([
    new SystemMessage(
      "Decide whether any candidate paper's abstract is concrete enough to yield a coaching cue or rule of thumb for today's basketball training focus. Reject papers that are too theoretical, off-topic, or whose abstract is missing.",
    ),
    new HumanMessage(
      `Focus: ${state.focus}\nQuery used: ${state.query}\n\nCandidates:\n${candidates}\n\nPick the single best paper if any is relevant.`,
    ),
  ]);

  if (
    result.relevant &&
    result.chosenIndex !== null &&
    result.chosenIndex < fresh.length
  ) {
    return { selectedPaper: fresh[result.chosenIndex] };
  }
  return { selectedPaper: undefined };
};

const readPaper: typeof PaperState.Node = async (state) => {
  const content = await geminiReadPaperTool.invoke({
    pdfUrl: state.selectedPaper!.pdfUrl,
  });
  return { paperContent: content };
};

const judgeActionability: typeof PaperState.Node = async (state) => {
  const JudgmentSchema = z.object({
    actionable: z
      .boolean()
      .describe(
        "True if the summary contains a concrete, applicable coaching cue or rule of thumb a basketball coach could use today.",
      ),
    reasoning: z.string().describe("One sentence justifying the decision."),
  });
  const llm = model.withStructuredOutput(JudgmentSchema);

  const result = await llm.invoke([
    new SystemMessage(
      "Judge whether a paper summary is actionable for a basketball coach. Actionable means a specific, applicable cue, rule of thumb, or drill concept — not abstract theory or vague suggestions.",
    ),
    new HumanMessage(
      `Focus: ${state.focus}\nPaper: ${state.selectedPaper!.title}\n\nSummary:\n${state.paperContent}`,
    ),
  ]);

  if (result.actionable) {
    return { actionable: true };
  }
  return {
    actionable: false,
    triedPapers: [state.selectedPaper!.url],
  };
};

const routeAfterEvaluation = (state: typeof PaperState.State) => {
  if (state.selectedPaper) return "readPaper";
  if (state.attempts >= MAX_ATTEMPTS) return END;
  return "generateQuery";
};

const routeAfterJudgment = (state: typeof PaperState.State) => {
  if (state.actionable) return END;
  return "evaluateResults";
};

export const paperGraph = new StateGraph(PaperState)
  .addNode("generateQuery", generateQuery)
  .addNode("searchPapers", searchPapers)
  .addNode("evaluateResults", evaluateResults)
  .addNode("readPaper", readPaper)
  .addNode("judgeActionability", judgeActionability)
  .addEdge(START, "generateQuery")
  .addEdge("generateQuery", "searchPapers")
  .addEdge("searchPapers", "evaluateResults")
  .addConditionalEdges("evaluateResults", routeAfterEvaluation, {
    readPaper: "readPaper",
    generateQuery: "generateQuery",
    [END]: END,
  })
  .addEdge("readPaper", "judgeActionability")
  .addConditionalEdges("judgeActionability", routeAfterJudgment, {
    evaluateResults: "evaluateResults",
    [END]: END,
  })
  .compile();
