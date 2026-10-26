CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`hackathon_id` text NOT NULL,
	`registration_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`round_id` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`url` text,
	`file_upload_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`file_upload_id`) REFERENCES `file_uploads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_event_owner_kind_round_unique` ON `submissions` (`hackathon_id`,`owner_id`,`kind`,`round_id`);