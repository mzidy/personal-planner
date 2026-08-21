CREATE TABLE `stats_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`height_cm` real,
	`target_weight_kg` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stats_profiles_user` ON `stats_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `weigh_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_key` text NOT NULL,
	`weight_kg` real NOT NULL,
	`body_fat_percent` real,
	`notes` text DEFAULT '' NOT NULL,
	`measured_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weigh_ins_user_week` ON `weigh_ins` (`user_id`,`week_key`);