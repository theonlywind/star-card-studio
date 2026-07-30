CREATE TABLE `class_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `code_hash` text NOT NULL,
  `label` text NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_codes_code_hash_unique` ON `class_codes` (`code_hash`);
--> statement-breakpoint
CREATE TABLE `class_students` (
  `id` text PRIMARY KEY NOT NULL,
  `code_id` text NOT NULL,
  `display_name` text NOT NULL,
  `video_limit` integer DEFAULT 5 NOT NULL,
  `video_used` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`code_id`) REFERENCES `class_codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_students_code_id_unique` ON `class_students` (`code_id`);
--> statement-breakpoint
CREATE TABLE `video_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `student_id` text NOT NULL,
  `provider_task_id` text NOT NULL,
  `prompt` text NOT NULL,
  `status` text NOT NULL,
  `video_url` text,
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`student_id`) REFERENCES `class_students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_jobs_provider_task_id_unique` ON `video_jobs` (`provider_task_id`);
