ALTER TABLE "controlled_copies" ADD COLUMN "print_outcome" varchar(20);--> statement-breakpoint
ALTER TABLE "controlled_copies" ADD COLUMN "print_outcome_note" text;--> statement-breakpoint
ALTER TABLE "recall_items" ADD COLUMN "destruction_due_at" timestamp with time zone;