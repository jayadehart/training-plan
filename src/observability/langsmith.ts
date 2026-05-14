export function configureLangSmith(workoutDate: string): void {
  if (process.env.LANGSMITH_API_KEY) {
    process.env.LANGSMITH_TRACING = process.env.LANGSMITH_TRACING ?? "true";
    process.env.LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT ?? "training-plan";
  }
  process.env.LANGSMITH_RUN_TAG = `workout:${workoutDate}`;
}
