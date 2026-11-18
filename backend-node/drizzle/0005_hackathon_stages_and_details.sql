ALTER TABLE `hackathons` ADD `location` text DEFAULT 'Campus Main Auditorium' NOT NULL;--> statement-breakpoint
ALTER TABLE `hackathons` ADD `header_image` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `hackathons` ADD `stages` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `hackathons` ADD `problem_statements` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `hackathons` ADD `schedules` text DEFAULT '{}' NOT NULL;

