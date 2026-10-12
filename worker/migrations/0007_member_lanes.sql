ALTER TABLE `trip_stops` ADD `member_id` integer REFERENCES users(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `trip_stops` ADD `phase` text;