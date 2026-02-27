CREATE TABLE `character_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_character_id` text NOT NULL,
	`target_character_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`strength` integer NOT NULL,
	`notes` text NOT NULL,
	`evidence` text NOT NULL,
	`created_at` integer NOT NULL
);
