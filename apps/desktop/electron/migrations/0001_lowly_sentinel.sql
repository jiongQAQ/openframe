CREATE TABLE `genre_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `genres` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`thumbnail` text,
	`category_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `genre_categories`(`id`) ON UPDATE no action ON DELETE no action
);
