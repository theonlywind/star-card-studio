ALTER TABLE `class_students` ADD `start_image_limit` integer DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE `class_students` ADD `start_image_used` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `class_students` ADD `end_image_limit` integer DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE `class_students` ADD `end_image_used` integer DEFAULT 0 NOT NULL;
