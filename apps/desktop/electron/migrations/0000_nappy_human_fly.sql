CREATE TABLE `chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` text NOT NULL,
	`content` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`project_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `genres` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`thumbnail` text,
	`prompt` text NOT NULL,
	`created_at` integer NOT NULL
);
