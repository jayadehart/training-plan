import { getRecentWorkouts, getUsedPaperUrls, getUsedVideoIds } from "../db/queries";

export interface HistoryContext {
  historyText: string;
  usedPaperUrls: Set<string>;
  usedVideoIds: Set<string>;
}

export function loadState(historyLimit = 6): HistoryContext {
  const workouts = getRecentWorkouts(historyLimit);

  let historyText: string;
  if (workouts.length === 0) {
    historyText = "(no prior workouts — this is the first session)";
  } else {
    historyText = workouts
      .map((w) =>
        [
          `### ${w.date} — focus: ${w.focus}`,
          `Paper: ${w.paper.title}`,
          `Video: ${w.video.title}`,
          w.conceptsCovered.length
            ? `Concepts: ${w.conceptsCovered.join(", ")}`
            : "Concepts: (none recorded)",
          `Narrative: ${w.narrative}`,
        ].join("\n"),
      )
      .join("\n\n");
  }

  return {
    historyText,
    usedPaperUrls: getUsedPaperUrls(),
    usedVideoIds: getUsedVideoIds(),
  };
}
