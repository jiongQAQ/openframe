CREATE TABLE `props` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`thumbnail` text,
	`created_at` integer NOT NULL
);
