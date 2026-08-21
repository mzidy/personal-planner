CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`horizon` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` real,
	`bought` integer DEFAULT false NOT NULL,
	`bought_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
