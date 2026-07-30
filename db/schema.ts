import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  trialLimit: integer("trial_limit").notNull().default(8),
  trialUsed: integer("trial_used").notNull().default(0),
  finalLimit: integer("final_limit").notNull().default(1),
  finalUsed: integer("final_used").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const generationLogs = sqliteTable("generation_logs", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  kind: text("kind").notNull(),
  prompt: text("prompt").notNull(),
  providerMode: text("provider_mode").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("generation_logs_student_idx").on(table.studentId)]);

export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    trial_limit INTEGER NOT NULL DEFAULT 8,
    trial_used INTEGER NOT NULL DEFAULT 0,
    final_limit INTEGER NOT NULL DEFAULT 1,
    final_used INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS generation_logs (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    prompt TEXT NOT NULL,
    provider_mode TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(student_id) REFERENCES students(id)
  )`,
  "CREATE INDEX IF NOT EXISTS generation_logs_student_idx ON generation_logs(student_id)",
];

export const classSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS class_codes (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS class_students (
    id TEXT PRIMARY KEY,
    code_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    video_limit INTEGER NOT NULL DEFAULT 5,
    video_used INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(code_id) REFERENCES class_codes(id)
  )`,
  `CREATE TABLE IF NOT EXISTS video_jobs (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    provider_task_id TEXT NOT NULL UNIQUE,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL,
    video_url TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(student_id) REFERENCES class_students(id)
  )`,
];
