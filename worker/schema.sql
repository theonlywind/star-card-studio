CREATE TABLE IF NOT EXISTS student_codes (
  id INTEGER PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  code_id INTEGER NOT NULL UNIQUE REFERENCES student_codes(id),
  display_name TEXT NOT NULL,
  trial_remaining INTEGER NOT NULL DEFAULT 5,
  final_remaining INTEGER NOT NULL DEFAULT 2,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS generation_logs (
  id INTEGER PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  kind TEXT NOT NULL CHECK(kind IN ('trial','final')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS generation_logs_student_id ON generation_logs(student_id);
