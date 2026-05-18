import { persistedWorkoutSchema, type Workout } from "../workout";
import { getDb, withTransaction } from "./client";

export function getRecentWorkouts(limit = 6): Workout[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT data FROM workouts ORDER BY date DESC LIMIT ?`)
    .all(limit) as unknown as Array<{ data: string }>;
  return rows.map((r) => persistedWorkoutSchema.parse(JSON.parse(r.data)));
}

export function getUsedPaperUrls(): Set<string> {
  const db = getDb();
  const rows = db.prepare(`SELECT url FROM used_papers`).all() as unknown as Array<{
    url: string;
  }>;
  return new Set(rows.map((r) => r.url));
}

export function getUsedVideoIds(): Set<string> {
  const db = getDb();
  const rows = db.prepare(`SELECT youtube_id FROM used_videos`).all() as unknown as Array<{
    youtube_id: string;
  }>;
  return new Set(rows.map((r) => r.youtube_id));
}

export function insertWorkout(workout: Workout): void {
  withTransaction(() => {
    const db = getDb();
    db.prepare(`INSERT INTO workouts (date, data) VALUES (?, ?)`).run(
      workout.date,
      JSON.stringify(workout),
    );

    db.prepare(
      `INSERT OR IGNORE INTO used_papers (url, title, workout_date) VALUES (?, ?, ?)`,
    ).run(workout.paper.url, workout.paper.title, workout.date);

    db.prepare(
      `INSERT OR IGNORE INTO used_videos (youtube_id, url, title, workout_date)
       VALUES (?, ?, ?, ?)`,
    ).run(workout.video.youtubeId, workout.video.url, workout.video.title, workout.date);
  });
}

export interface TraceRow {
  workoutDate: string;
  agent: "paper" | "video";
  stepIndex: number;
  event: "tool_call" | "tool_result" | "agent_action" | "agent_finish";
  toolName?: string;
  input?: string;
  output?: string;
  latencyMs?: number;
}

export function insertTrace(row: TraceRow): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO agent_traces
       (workout_date, agent, step_index, event, tool_name, input, output, latency_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.workoutDate,
    row.agent,
    row.stepIndex,
    row.event,
    row.toolName ?? null,
    row.input ?? null,
    row.output ?? null,
    row.latencyMs ?? null,
  );
}
