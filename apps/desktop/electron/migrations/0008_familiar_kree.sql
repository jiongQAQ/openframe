CREATE TABLE IF NOT EXISTS `shots` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`shot_index` integer NOT NULL,
	`shot_size` text NOT NULL,
	`camera_angle` text NOT NULL,
	`camera_move` text NOT NULL,
	`duration_sec` integer NOT NULL,
	`action` text NOT NULL,
	`dialogue` text NOT NULL,
	`character_ids` text NOT NULL,
	`thumbnail` text,
	`created_at` integer NOT NULL
);
