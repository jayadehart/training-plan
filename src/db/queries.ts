import { getDb, withTransaction } from "./client";

export interface WorkoutRow {
  date: string;
  focus: string;
  narrative: string;
  drills_json: string;
  paper_url: string;
  paper_title: string;
  video_url: string;
  video_title: string;
}

export interface InsertWorkoutInput {
  date: string;
  focus: string;
  narrative: string;
  drillsJson: string;
  paper: { url: string; title: string };
  video: { url: string; youtubeId: string; title: string };
  conceptsCovered: string[];
}

export function getRecentWorkouts(limit = 6): WorkoutRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT date, focus, narrative, drills_json,
              paper_url, paper_title, video_url, video_title
         FROM workouts
        ORDER BY date DESC
        LIMIT ?`,
    )
    .all(limit) as unknown as WorkoutRow[];
}

export function getConceptsForDates(dates: string[]): Record<string, string[]> {
  if (dates.length === 0) return {};
  const db = getDb();
  const placeholders = dates.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT workout_date, concept FROM concepts WHERE workout_date IN (${placeholders})`,
    )
    .all(...dates) as unknown as Array<{ workout_date: string; concept: string }>;
  const out: Record<string, string[]> = {};
  for (const row of rows) {
    (out[row.workout_date] ??= []).push(row.concept);
  }
  return out;
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

export function insertWorkout(input: InsertWorkoutInput): void {
  withTransaction(() => {
    const db = getDb();
    db.prepare(
      `INSERT INTO workouts
         (date, focus, narrative, drills_json,
          paper_url, paper_title, video_url, video_title)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.date,
      input.focus,
      input.narrative,
      input.drillsJson,
      input.paper.url,
      input.paper.title,
      input.video.url,
      input.video.title,
    );

    db.prepare(
      `INSERT OR IGNORE INTO used_papers (url, title, workout_date) VALUES (?, ?, ?)`,
    ).run(input.paper.url, input.paper.title, input.date);

    db.prepare(
      `INSERT OR IGNORE INTO used_videos (youtube_id, url, title, workout_date)
       VALUES (?, ?, ?, ?)`,
    ).run(input.video.youtubeId, input.video.url, input.video.title, input.date);

    const conceptStmt = db.prepare(
      `INSERT INTO concepts (workout_date, concept) VALUES (?, ?)`,
    );
    for (const concept of input.conceptsCovered) {
      conceptStmt.run(input.date, concept);
    }
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
