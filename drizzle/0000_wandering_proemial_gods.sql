CREATE TABLE `generation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`kind` text NOT NULL,
	`prompt` text NOT NULL,
	`provider_mode` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `generation_logs_student_idx` ON `generation_logs` (`student_id`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`trial_limit` integer DEFAULT 8 NOT NULL,
	`trial_used` integer DEFAULT 0 NOT NULL,
	`final_limit` integer DEFAULT 1 NOT NULL,
	`final_used` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
