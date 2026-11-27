CREATE TYPE "public"."print_job_priority" AS ENUM('STANDARD', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."print_job_source" AS ENUM('NATIVE', 'GOOGLE_DRIVE', 'SHAREPOINT', 'MASTERCONTROL', 'VEEVA');--> statement-breakpoint
CREATE TYPE "public"."print_job_status" AS ENUM('QUEUED', 'DISPATCHED', 'CONFIRMED', 'PARTIAL', 'FAILED', 'DEAD_LETTER');--> statement-breakpoint
CREATE TYPE "public"."printer_status" AS ENUM('ACTIVE', 'PAUSED', 'CIRCUIT_OPEN');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "overlay_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"logo_file_key" text,
	"paper_size" varchar(10) DEFAULT 'A4' NOT NULL,
	"stamp_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"print_request_id" uuid,
	"copy_id" uuid,
	"printer_id" uuid NOT NULL,
	"queue_name" varchar(150) NOT NULL,
	"bull_job_id" text,
	"status" "print_job_status" DEFAULT 'QUEUED' NOT NULL,
	"priority" "print_job_priority" DEFAULT 'STANDARD' NOT NULL,
	"source" "print_job_source" DEFAULT 'NATIVE' NOT NULL,
	"source_ref" text,
	"requested_pages" integer NOT NULL,
	"confirmed_pages" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"exception_reason" text,
	"exception_granted_by_user_id" uuid,
	"exception_expires_at" timestamp with time zone,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "printers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"connection_endpoint" text,
	"supported_paper_sizes" jsonb DEFAULT '["A4"]'::jsonb NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"status" "printer_status" DEFAULT 'ACTIVE' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"circuit_open_until" timestamp with time zone,
	"last_health_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "overlay_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "print_requests" ADD COLUMN "printer_id" uuid;--> statement-breakpoint
ALTER TABLE "print_requests" ADD COLUMN "is_urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "print_requests" ADD COLUMN "source" "print_job_source" DEFAULT 'NATIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "print_requests" ADD COLUMN "source_ref" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "overlay_profiles" ADD CONSTRAINT "overlay_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "overlay_profiles" ADD CONSTRAINT "overlay_profiles_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_print_request_id_print_requests_id_fk" FOREIGN KEY ("print_request_id") REFERENCES "public"."print_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_copy_id_controlled_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."controlled_copies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_exception_granted_by_user_id_users_id_fk" FOREIGN KEY ("exception_granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "printers" ADD CONSTRAINT "printers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "printers" ADD CONSTRAINT "printers_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overlay_profiles_org_idx" ON "overlay_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_jobs_org_idx" ON "print_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_jobs_printer_idx" ON "print_jobs" USING btree ("printer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_jobs_status_idx" ON "print_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "printers_org_idx" ON "printers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "printers_site_idx" ON "printers" USING btree ("site_id");