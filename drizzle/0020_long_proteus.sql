CREATE TABLE `savings_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`target_amount` real NOT NULL,
	`saved_amount` real DEFAULT 0 NOT NULL,
	`weekly_allowance` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `savings_goals_user` ON `savings_goals` (`user_id`);