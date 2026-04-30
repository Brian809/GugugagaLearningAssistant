CREATE TABLE `mistake_records` (
	`id` text PRIMARY KEY NOT NULL,
	`problem_text` text NOT NULL,
	`problem_image` text,
	`user_answer` text NOT NULL,
	`correct_answer` text NOT NULL,
	`analysis` text,
	`tags` text,
	`subject` text,
	`is_reviewed` integer DEFAULT false,
	`review_count` integer DEFAULT 0,
	`last_reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
