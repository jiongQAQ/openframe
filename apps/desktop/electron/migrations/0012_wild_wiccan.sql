ALTER TABLE `shots` ADD `prop_ids` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
UPDATE `shots`
SET `prop_ids` = '[]'
WHERE `prop_ids` IS NULL OR `prop_ids` = '';
