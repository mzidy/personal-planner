CREATE TABLE `ticker_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`symbol` text NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`technical` text DEFAULT '{}' NOT NULL,
	`fundamental` text DEFAULT '{}' NOT NULL,
	`review` text DEFAULT '' NOT NULL,
	`review_error` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
