import {
  getConceptsForDates,
  getRecentWorkouts,
  getUsedPaperUrls,
  getUsedVideoIds,
} from "../db/queries";

export interface HistoryContext {
  historyText: string;
  usedPaperUrls: Set<string>;
  usedVideoIds: Set<string>;
}

export function loadState(historyLimit = 6): HistoryContext {
  const workouts = getRecentWorkouts(historyLimit);
  const dates = workouts.map((w) => w.date);
  const conceptsByDate = getConceptsForDates(dates);

  let historyText: string;
  if (workouts.length === 0) {
    historyText = "(no prior workouts — this is the first session)";
  } else {
    historyText = workouts
      .map((w) => {
        const concepts = conceptsByDate[w.date] ?? [];
        return [
          `### ${w.date} — focus: ${w.focus}`,
          `Paper: ${w.paper_title}`,
          `Video: ${w.video_title}`,
          concepts.length ? `Concepts: ${concepts.join(", ")}` : "Concepts: (none recorded)",
          `Narrative: ${w.narrative}`,
        ].join("\n");
      })
      .join("\n\n");
  }

  return {
    historyText,
    usedPaperUrls: getUsedPaperUrls(),
    usedVideoIds: getUsedVideoIds(),
  };
}
