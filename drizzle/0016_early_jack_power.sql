CREATE TABLE `smart_home_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'roborock' NOT NULL,
	`email` text NOT NULL,
	`base_url` text NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`country_code` text DEFAULT '' NOT NULL,
	`client_identifier` text NOT NULL,
	`credentials` text,
	`status` text DEFAULT 'awaiting_code' NOT NULL,
	`connected_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smart_home_accounts_user_provider` ON `smart_home_accounts` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `smart_home_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`duid` text NOT NULL,
	`name` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`product_name` text DEFAULT '' NOT NULL,
	`protocol_version` text DEFAULT '1.0' NOT NULL,
	`local_key` text NOT NULL,
	`online` integer DEFAULT true NOT NULL,
	`last_status` text,
	`last_status_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `smart_home_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smart_home_devices_account_duid` ON `smart_home_devices` (`account_id`,`duid`);