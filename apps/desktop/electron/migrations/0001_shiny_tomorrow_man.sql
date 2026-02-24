CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`video_ratio` text NOT NULL,
	`thumbnail` text,
	`category` text NOT NULL,
	`genre` text NOT NULL,
	`series_count` integer NOT NULL,
	`created_at` integer NOT NULL
);
