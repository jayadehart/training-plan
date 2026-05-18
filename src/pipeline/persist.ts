import { insertWorkout } from "../db/queries";
import type { Workout } from "./composeWorkout";
import type { ChosenPaper } from "./paperAgent";
import type { ChosenVideo } from "./videoAgent";

export function persistWorkout(
  workout: Workout,
  paper: ChosenPaper,
  video: ChosenVideo,
): void {
  insertWorkout({
    date: workout.date,
    focus: workout.focus,
    narrative: workout.narrative,
    drillsJson: JSON.stringify(workout.drills),
    paper: { url: paper.url, title: paper.title },
    video: { url: video.url, youtubeId: video.youtubeId, title: video.title },
    conceptsCovered: workout.conceptsCovered,
  });
}
