CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  focus TEXT NOT NULL,
  narrative TEXT NOT NULL,
  drills_json TEXT NOT NULL,
  cooldown TEXT NOT NULL,
  paper_url TEXT NOT NULL,
  paper_title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  video_title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS used_papers (
  url TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  workout_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS used_videos (
  youtube_id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  workout_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS concepts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_date TEXT NOT NULL,
  concept TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workout_date) REFERENCES workouts(date)
);

CREATE INDEX IF NOT EXISTS idx_concepts_workout_date ON concepts(workout_date);

CREATE TABLE IF NOT EXISTS agent_traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_date TEXT NOT NULL,
  agent TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  event TEXT NOT NULL,
  tool_name TEXT,
  input TEXT,
  output TEXT,
  latency_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_traces_workout_date ON agent_traces(workout_date);
