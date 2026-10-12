CREATE TABLE `stop_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`emoji` text NOT NULL,
	`label` text NOT NULL,
	`base_category` text DEFAULT 'other' NOT NULL,
	`created_by_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "stop_categories_emoji_len" CHECK(length("stop_categories"."emoji") <= 16),
	CONSTRAINT "stop_categories_label_len" CHECK(length("stop_categories"."label") <= 20),
	CONSTRAINT "stop_categories_base" CHECK("stop_categories"."base_category" in ('sight', 'food', 'hotel', 'transport', 'shopping', 'activity', 'other'))
);
--> statement-breakpoint
ALTER TABLE `trip_stops` ADD `custom_category_id` integer REFERENCES stop_categories(id) ON DELETE set null;