CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`type` text DEFAULT 'link' NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`storage_key` text,
	`mime_type` text,
	`size` integer,
	`created_by_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "attachments_type" CHECK("attachments"."type" in ('link', 'file')),
	CONSTRAINT "attachments_name_len" CHECK(length("attachments"."name") <= 200),
	CONSTRAINT "attachments_url_len" CHECK(length("attachments"."url") <= 1000),
	CONSTRAINT "attachments_mime_len" CHECK(length("attachments"."mime_type") <= 127)
);
--> statement-breakpoint
CREATE INDEX `attachments_task` ON `attachments` (`task_id`);--> statement-breakpoint
CREATE TABLE `buckets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`name` text NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "buckets_name_len" CHECK(length("buckets"."name") <= 100)
);
--> statement-breakpoint
CREATE INDEX `buckets_plan` ON `buckets` (`plan_id`);--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`title` text NOT NULL,
	`is_checked` integer DEFAULT false NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "checklist_items_title_len" CHECK(length("checklist_items"."title") <= 100)
);
--> statement-breakpoint
CREATE INDEX `checklist_items_task` ON `checklist_items` (`task_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`user_id` integer,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "comments_content_len" CHECK(length("comments"."content") <= 2000)
);
--> statement-breakpoint
CREATE INDEX `comments_task` ON `comments` (`task_id`);--> statement-breakpoint
CREATE TABLE `my_day_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `my_day_items_user_task_date` ON `my_day_items` (`user_id`,`task_id`,`date`);--> statement-breakpoint
CREATE INDEX `my_day_items_task` ON `my_day_items` (`task_id`);--> statement-breakpoint
CREATE TABLE `plan_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`last_viewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "plan_members_role" CHECK("plan_members"."role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_members_plan_user` ON `plan_members` (`plan_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `plan_members_user` ON `plan_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` integer DEFAULT 0 NOT NULL,
	`owner_id` integer,
	`label_names` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "plans_name_len" CHECK(length("plans"."name") <= 100),
	CONSTRAINT "plans_description_len" CHECK(length("plans"."description") <= 500),
	CONSTRAINT "plans_label_names_len" CHECK(length("plans"."label_names") <= 1500),
	CONSTRAINT "plans_color_range" CHECK("plans"."color" between 0 and 255)
);
--> statement-breakpoint
CREATE TABLE `task_assignees` (
	`task_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	PRIMARY KEY(`task_id`, `user_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_assignees_user` ON `task_assignees` (`user_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`bucket_id` integer,
	`title` text NOT NULL,
	`notes` text,
	`progress` integer DEFAULT 0 NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`start_date` text,
	`due_date` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`preview_type` text DEFAULT 'automatic' NOT NULL,
	`labels` text DEFAULT '[]' NOT NULL,
	`completed_at` text,
	`completed_by_id` integer,
	`created_by_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tasks_title_len" CHECK(length("tasks"."title") <= 200),
	CONSTRAINT "tasks_notes_len" CHECK(length("tasks"."notes") <= 10000),
	CONSTRAINT "tasks_labels_len" CHECK(length("tasks"."labels") <= 80),
	CONSTRAINT "tasks_progress" CHECK("tasks"."progress" in (0, 50, 100)),
	CONSTRAINT "tasks_priority" CHECK("tasks"."priority" in (1, 3, 5, 9)),
	CONSTRAINT "tasks_preview_type" CHECK("tasks"."preview_type" in ('automatic', 'noPreview', 'checklist', 'description', 'reference'))
);
--> statement-breakpoint
CREATE INDEX `tasks_plan` ON `tasks` (`plan_id`);--> statement-breakpoint
CREATE INDEX `tasks_bucket` ON `tasks` (`bucket_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`role` text DEFAULT 'member' NOT NULL,
	`color` text DEFAULT '#0078d4' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "users_username_len" CHECK(length("users"."username") <= 50),
	CONSTRAINT "users_display_name_len" CHECK(length("users"."display_name") <= 50),
	CONSTRAINT "users_email_len" CHECK(length("users"."email") <= 100),
	CONSTRAINT "users_color_len" CHECK(length("users"."color") <= 7),
	CONSTRAINT "users_role" CHECK("users"."role" in ('admin', 'member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username` ON `users` (`username`);