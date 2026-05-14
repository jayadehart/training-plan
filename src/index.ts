import "dotenv/config";
import { parseArgs } from "node:util";
import { loadProfile } from "./config";
import { closeDb } from "./db/client";
import { configureLangSmith } from "./observability/langsmith";
import { composeWorkout } from "./pipeline/composeWorkout";
import { loadState } from "./pipeline/loadState";
import { runPaperAgent } from "./pipeline/paperAgent";
import { persistWorkout } from "./pipeline/persist";
import { pickFocus } from "./pipeline/pickFocus";
import { sendEmail } from "./pipeline/sendEmail";
import { runVideoAgent } from "./pipeline/videoAgent";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      to: { type: "string" },
      date: { type: "string" },
    },
    allowPositionals: false,
  });

  const date = values.date ?? todayIso();
  const dryRun = values["dry-run"] ?? false;
  const to = values.to ?? process.env.EMAIL_TO;

  configureLangSmith(date);

  const profile = loadProfile();
  const history = loadState(6);

  console.log(`\n=== Workout pipeline for ${date} ===`);
  console.log(`History: ${history.usedPaperUrls.size} papers used, ${history.usedVideoIds.size} videos used`);

  console.log("\n[1/5] Picking focus...");
  const focus = await pickFocus(profile, history);
  console.log(`Focus: ${focus}`);

  console.log("\n[2/5] Running paper agent...");
  const paper = await runPaperAgent(focus, history.usedPaperUrls, date);
  console.log(`Paper: ${paper.title} (${paper.url})`);

  console.log("\n[3/5] Running video agent...");
  const video = await runVideoAgent(focus, history.usedVideoIds, date);
  console.log(`Video: ${video.title} (${video.url})`);

  console.log("\n[4/5] Composing workout...");
  const workout = await composeWorkout({ date, profile, history, focus, paper, video });
  console.log(`Workout: ${workout.drills.length} drills, ${workout.conceptsCovered.length} concepts`);

  if (dryRun) {
    console.log("\n[DRY RUN] Workout JSON:");
    console.log(JSON.stringify(workout, null, 2));
    console.log("\n[DRY RUN] Skipping email and persist.");
    return;
  }

  if (!to) throw new Error("No recipient — set EMAIL_TO or pass --to");

  console.log(`\n[5/5] Sending email to ${to} and persisting...`);
  await sendEmail({ workout, paper, video, to });
  persistWorkout(workout, paper, video);

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
