CREATE TABLE `trip_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`last_viewed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trip_members_role" CHECK("trip_members"."role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_members_trip_user` ON `trip_members` (`trip_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `trip_members_user` ON `trip_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `trip_stops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip_id` integer NOT NULL,
	`date` text,
	`start_time` text,
	`end_time` text,
	`title` text NOT NULL,
	`category` text DEFAULT 'sight' NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`address` text,
	`notes` text,
	`cost` real,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_by_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "trip_stops_title_len" CHECK(length("trip_stops"."title") <= 100),
	CONSTRAINT "trip_stops_address_len" CHECK(length("trip_stops"."address") <= 200),
	CONSTRAINT "trip_stops_notes_len" CHECK(length("trip_stops"."notes") <= 1000),
	CONSTRAINT "trip_stops_category" CHECK("trip_stops"."category" in ('sight', 'food', 'hotel', 'transport', 'shopping', 'activity', 'other')),
	CONSTRAINT "trip_stops_lat" CHECK("trip_stops"."lat" between -90 and 90),
	CONSTRAINT "trip_stops_lng" CHECK("trip_stops"."lng" between -180 and 180)
);
--> statement-breakpoint
CREATE INDEX `trip_stops_trip` ON `trip_stops` (`trip_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`color` integer DEFAULT 0 NOT NULL,
	`travel_mode` text DEFAULT 'car' NOT NULL,
	`owner_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "trips_travel_mode" CHECK("trips"."travel_mode" in ('car', 'bike', 'foot', 'straight')),
	CONSTRAINT "trips_name_len" CHECK(length("trips"."name") <= 100),
	CONSTRAINT "trips_description_len" CHECK(length("trips"."description") <= 500),
	CONSTRAINT "trips_date_range" CHECK("trips"."end_date" >= "trips"."start_date"),
	CONSTRAINT "trips_color_range" CHECK("trips"."color" between 0 and 255)
);
