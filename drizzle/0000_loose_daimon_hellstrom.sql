CREATE TABLE `customer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text,
	`last_name` text,
	`age` integer,
	`phone_number` integer,
	`monthly_salary` integer,
	`approved_limit` integer
);
--> statement-breakpoint
CREATE TABLE `loan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer,
	`loan_amount` integer,
	`interest_rate` real,
	`tenure` integer,
	`monthly_payment` integer,
	`emi_paid_on_time` integer,
	`start_date` integer,
	`end_date` integer,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE no action
);
