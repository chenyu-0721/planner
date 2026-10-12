ALTER TABLE `trip_stops` ADD `arrive_mode` text;--> statement-breakpoint
ALTER TABLE `trips` ADD `route_mode` text DEFAULT 'car' NOT NULL;--> statement-breakpoint
-- 沿用既有行程原本的交通方式設定
UPDATE `trips` SET `route_mode` = `travel_mode`;
