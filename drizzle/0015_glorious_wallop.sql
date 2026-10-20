CREATE TABLE `claudemy_courses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic` text NOT NULL,
	`level` text DEFAULT 'beginner' NOT NULL,
	`lesson_count` integer DEFAULT 12 NOT NULL,
	`person` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT 'mapping' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`step_started_at` text,
	`sourcing_round` integer DEFAULT 0 NOT NULL,
	`sourcing_cursor` integer DEFAULT 0 NOT NULL,
	`subtopics` text DEFAULT '[]' NOT NULL,
	`themes` text DEFAULT '[]' NOT NULL,
	`splits` text DEFAULT '[]' NOT NULL,
	`gaps` text DEFAULT '[]' NOT NULL,
	`arcs` text DEFAULT '[]' NOT NULL,
	`disagreements` text DEFAULT '[]' NOT NULL,
	`stories` text DEFAULT '[]' NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`web_searches` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `claudemy_lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`number` integer NOT NULL,
	`arc` integer DEFAULT 0 NOT NULL,
	`handle` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`plan` text NOT NULL,
	`script` text,
	`card` text,
	`words` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`problems` text DEFAULT '[]' NOT NULL,
	`heard_at` text,
	`tried_at` text,
	`rule_kept` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `claudemy_courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `claudemy_lessons_course_number` ON `claudemy_lessons` (`course_id`,`number`);--> statement-breakpoint
CREATE TABLE `claudemy_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`seq` integer NOT NULL,
	`url` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT '' NOT NULL,
	`subtopics` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`fail_reason` text DEFAULT '' NOT NULL,
	`words` integer DEFAULT 0 NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`read_at` text,
	`skip_reason` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `claudemy_courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `claudemy_pages_course_seq` ON `claudemy_pages` (`course_id`,`seq`);