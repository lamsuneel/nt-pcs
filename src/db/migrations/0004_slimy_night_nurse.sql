ALTER TABLE "documents" ADD COLUMN "external_provider" "print_job_source";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "external_ref" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_external_ref_idx" ON "documents" USING btree ("external_provider","external_ref");