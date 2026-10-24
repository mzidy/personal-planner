CREATE TABLE `alexa_link_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alexa_link_codes_user` ON `alexa_link_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `alexa_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`alexa_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alexa_links_alexa_user` ON `alexa_links` (`alexa_user_id`);