CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`age` text NOT NULL,
	`personality` text NOT NULL,
	`appearance` text NOT NULL,
	`background` text NOT NULL,
	`created_at` integer NOT NULL
);
