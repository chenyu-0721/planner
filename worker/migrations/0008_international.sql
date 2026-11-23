CREATE TABLE `trip_bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip_id` integer NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`title` text NOT NULL,
	`start_at` text,
	`end_at` text,
	`from_place` text,
	`to_place` text,
	`reference` text,
	`cost` real,
	`currency` text,
	`url` text,
	`notes` text,
	`created_by_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "trip_bookings_kind" CHECK("trip_bookings"."kind" in ('flight', 'hotel', 'train', 'car', 'ticket', 'other')),
	CONSTRAINT "trip_bookings_title_len" CHECK(length("trip_bookings"."title") <= 100),
	CONSTRAINT "trip_bookings_from_len" CHECK(length("trip_bookings"."from_place") <= 200),
	CONSTRAINT "trip_bookings_to_len" CHECK(length("trip_bookings"."to_place") <= 200),
	CONSTRAINT "trip_bookings_reference_len" CHECK(length("trip_bookings"."reference") <= 60),
	CONSTRAINT "trip_bookings_url_len" CHECK(length("trip_bookings"."url") <= 1000),
	CONSTRAINT "trip_bookings_notes_len" CHECK(length("trip_bookings"."notes") <= 1000)
);
--> statement-breakpoint
CREATE INDEX `trip_bookings_trip` ON `trip_bookings` (`trip_id`);--> statement-breakpoint
CREATE TABLE `trip_checklist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip_id` integer NOT NULL,
	`title` text NOT NULL,
	`section` text DEFAULT 'other' NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`assignee_id` integer,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "trip_checklist_section" CHECK("trip_checklist"."section" in ('docs', 'money', 'booking', 'packing', 'other')),
	CONSTRAINT "trip_checklist_title_len" CHECK(length("trip_checklist"."title") <= 100)
);
--> statement-breakpoint
CREATE INDEX `trip_checklist_trip` ON `trip_checklist` (`trip_id`);--> statement-breakpoint
ALTER TABLE `trip_stops` ADD `currency` text;--> statement-breakpoint
ALTER TABLE `trips` ADD `currency` text DEFAULT 'TWD' NOT NULL;