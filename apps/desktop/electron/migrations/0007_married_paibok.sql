CREATE TABLE IF NOT EXISTS `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`title` text NOT NULL,
	`location` text NOT NULL,
	`time` text NOT NULL,
	`mood` text NOT NULL,
	`description` text NOT NULL,
	`shot_notes` text NOT NULL,
	`thumbnail` text,
	`created_at` integer NOT NULL
);
