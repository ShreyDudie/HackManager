CREATE TABLE `checkin_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text,
	`registration_id` text,
	`token_id` text,
	`scanned_by` text NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`result` text NOT NULL,
	`message` text NOT NULL,
	`scanned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`token_id`) REFERENCES `checkin_tokens`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`scanned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `checkin_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`purpose` text NOT NULL,
	`day` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`redeemed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkin_tokens_token_hash_unique` ON `checkin_tokens` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `checkin_tokens_registration_purpose_day_unique` ON `checkin_tokens` (`registration_id`,`purpose`,`day`);