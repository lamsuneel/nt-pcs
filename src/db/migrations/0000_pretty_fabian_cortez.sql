CREATE TYPE "public"."approval_status" AS ENUM('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'OBSOLETE');--> statement-breakpoint
CREATE TYPE "public"."confidentiality" AS ENUM('PUBLIC_INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');--> statement-breakpoint
CREATE TYPE "public"."copy_marking" AS ENUM('CONTROLLED_COPY', 'UNCONTROLLED_REFERENCE_COPY', 'MASTER_COPY', 'SUPERSEDED_COPY');--> statement-breakpoint
CREATE TYPE "public"."copy_status" AS ENUM('REQUESTED', 'APPROVED', 'PRINTED', 'ISSUED', 'ACKNOWLEDGED', 'ACTIVE', 'RECALL_PENDING', 'RETURNED', 'DESTROYED', 'LOST', 'DAMAGED', 'EXPIRED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('SOP', 'WI', 'BMR', 'BPR', 'STP', 'SPECIFICATION', 'FORMAT_CHECKLIST', 'EQUIPMENT_SOP', 'CLEANING_PROCEDURE', 'CALIBRATION_PROCEDURE', 'SAFETY_PROCEDURE', 'QUALITY_MANUAL');--> statement-breakpoint
CREATE TYPE "public"."exception_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."print_classification" AS ENUM('CONTROLLED', 'UNCONTROLLED_REFERENCE');--> statement-breakpoint
CREATE TYPE "public"."print_request_status" AS ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'ISSUED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."recall_item_status" AS ENUM('RECALL_INITIATED', 'RECALL_ACKNOWLEDGED', 'PHYSICALLY_RETRIEVED', 'DESTRUCTION_CONFIRMED', 'OUTSTANDING', 'LOST_INVESTIGATION', 'EXCEPTION_APPROVED');--> statement-breakpoint
CREATE TYPE "public"."recall_status" AS ENUM('INITIATED', 'PARTIALLY_RECONCILED', 'RECONCILED', 'CLOSED_WITH_EXCEPTION');--> statement-breakpoint
CREATE TYPE "public"."role_name" AS ENUM('SYSTEM_ADMIN', 'QA_HEAD', 'DOCUMENT_CONTROLLER', 'QA_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE', 'AUDITOR');--> statement-breakpoint
CREATE TYPE "public"."scan_verdict" AS ENUM('GREEN', 'AMBER', 'RED', 'GREY');--> statement-breakpoint
CREATE TYPE "public"."source_record_type" AS ENUM('PAPER_APPROVAL_REFERENCE', 'ELECTRONIC_SIGNATURE', 'ELECTRONIC_REGULATED_RECORD');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"summary" text NOT NULL,
	"reason_for_change" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"corrects_audit_event_id" uuid,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "controlled_copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"copy_identifier" varchar(150) NOT NULL,
	"print_request_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_revision_id" uuid NOT NULL,
	"copy_sequence" integer NOT NULL,
	"marking" "copy_marking" DEFAULT 'CONTROLLED_COPY' NOT NULL,
	"qr_token" varchar(64) NOT NULL,
	"pdf_file_key" text,
	"page_count" integer,
	"status" "copy_status" DEFAULT 'REQUESTED' NOT NULL,
	"issued_to_department_id" uuid,
	"destination_location" text,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "copy_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controlled_copy_id" uuid NOT NULL,
	"acknowledged_by_user_id" uuid NOT NULL,
	"acknowledgement_date" timestamp with time zone DEFAULT now() NOT NULL,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "copy_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controlled_copy_id" uuid NOT NULL,
	"issued_to_user_id" uuid,
	"department_id" uuid NOT NULL,
	"physical_location" text NOT NULL,
	"equipment_or_line" varchar(150),
	"issued_by_user_id" uuid NOT NULL,
	"issue_date" timestamp with time zone DEFAULT now() NOT NULL,
	"return_date" timestamp with time zone,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "copy_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controlled_copy_id" uuid NOT NULL,
	"scanned_by_user_id" uuid,
	"scan_verdict" "scan_verdict" NOT NULL,
	"scanned_offline" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone,
	"location_at_scan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "destruction_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controlled_copy_id" uuid NOT NULL,
	"recall_item_id" uuid,
	"destruction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"destruction_method" varchar(150),
	"performed_by_user_id" uuid NOT NULL,
	"witness_name" text NOT NULL,
	"witness_user_id" uuid,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_approval_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_revision_id" uuid NOT NULL,
	"source_record_type" "source_record_type" NOT NULL,
	"approval_reference_number" varchar(150),
	"approved_by_name" text,
	"approved_date" timestamp with time zone,
	"notes" text,
	"recorded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_recall_id" uuid,
	"recall_item_id" uuid,
	"reason" text NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"status" "exception_status" DEFAULT 'PENDING' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_recalls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"superseded_revision_id" uuid NOT NULL,
	"new_revision_id" uuid NOT NULL,
	"status" "recall_status" DEFAULT 'INITIATED' NOT NULL,
	"initiated_by_user_id" uuid NOT NULL,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_emergency_withdrawal" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"revision_label" varchar(20) NOT NULL,
	"approval_status" "approval_status" DEFAULT 'DRAFT' NOT NULL,
	"effective_date" timestamp with time zone,
	"review_due_date" timestamp with time zone,
	"superseded_revision_id" uuid,
	"source_file_key" text,
	"scanned_file_key" text,
	"change_summary" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"document_number" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"document_type" "document_type" NOT NULL,
	"department_id" uuid NOT NULL,
	"process_category" varchar(150),
	"owner_user_id" uuid,
	"applicable_equipment" text,
	"confidentiality" "confidentiality" DEFAULT 'PUBLIC_INTERNAL' NOT NULL,
	"master_copy_location" text,
	"source_file_key" text,
	"scanned_file_key" text,
	"has_no_file_yet" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"current_revision_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(30) DEFAULT 'RUNNING' NOT NULL,
	"records_synced" integer DEFAULT 0,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_key" varchar(50) NOT NULL,
	"display_name" text NOT NULL,
	"config_json" jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"last_successful_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"related_entity_type" varchar(100),
	"related_entity_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "print_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"print_request_id" uuid NOT NULL,
	"approver_user_id" uuid NOT NULL,
	"decision" varchar(20) NOT NULL,
	"comments" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "print_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_revision_id" uuid NOT NULL,
	"number_of_copies" integer NOT NULL,
	"requesting_user_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"destination_location" text NOT NULL,
	"intended_purpose" text,
	"reason_for_printing" text,
	"printer" varchar(150),
	"classification" "print_classification" DEFAULT 'CONTROLLED' NOT NULL,
	"review_due_date" timestamp with time zone,
	"status" "print_request_status" DEFAULT 'REQUESTED' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recall_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_recall_id" uuid NOT NULL,
	"controlled_copy_id" uuid NOT NULL,
	"status" "recall_item_status" DEFAULT 'RECALL_INITIATED' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" "role_name" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" varchar(50) NOT NULL,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid,
	"department_id" uuid,
	"full_name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"employee_code" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "controlled_copies" ADD CONSTRAINT "controlled_copies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "controlled_copies" ADD CONSTRAINT "controlled_copies_print_request_id_print_requests_id_fk" FOREIGN KEY ("print_request_id") REFERENCES "public"."print_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "controlled_copies" ADD CONSTRAINT "controlled_copies_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "controlled_copies" ADD CONSTRAINT "controlled_copies_document_revision_id_document_revisions_id_fk" FOREIGN KEY ("document_revision_id") REFERENCES "public"."document_revisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "controlled_copies" ADD CONSTRAINT "controlled_copies_issued_to_department_id_departments_id_fk" FOREIGN KEY ("issued_to_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "copy_acknowledgements" ADD CONSTRAINT "copy_acknowledgements_controlled_copy_id_controlled_copies_id_fk" FOREIGN KEY ("controlled_copy_id") REFERENCES "public"."controlled_copies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "copy_acknowledgements" ADD CONSTRAINT "copy_acknowledgements_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "copy_distributions" ADD CONSTRAINT "copy_distributions_controlled_copy_id_controlled_copies_id_fk" FOREIGN KEY ("controlled_copy_id") REFERENCES "public"."controlled_copies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "copy_distributions" ADD CONSTRAINT "copy_distributions_issued_to_user_id_users_id_fk" FOREIGN KEY ("issued_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "copy_distributions" ADD CONSTRAINT "copy_distributions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "copy_distributions" ADD CONSTRAINT "copy_distributions_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "copy_verifications" ADD CONSTRAINT "copy_verifications_controlled_copy_id_controlled_copies_id_fk" FOREIGN KEY ("controlled_copy_id") REFERENCES "public"."controlled_copies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "copy_verifications" ADD CONSTRAINT "copy_verifications_scanned_by_user_id_users_id_fk" FOREIGN KEY ("scanned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "destruction_confirmations" ADD CONSTRAINT "destruction_confirmations_controlled_copy_id_controlled_copies_id_fk" FOREIGN KEY ("controlled_copy_id") REFERENCES "public"."controlled_copies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "destruction_confirmations" ADD CONSTRAINT "destruction_confirmations_recall_item_id_recall_items_id_fk" FOREIGN KEY ("recall_item_id") REFERENCES "public"."recall_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "destruction_confirmations" ADD CONSTRAINT "destruction_confirmations_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "destruction_confirmations" ADD CONSTRAINT "destruction_confirmations_witness_user_id_users_id_fk" FOREIGN KEY ("witness_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_approval_references" ADD CONSTRAINT "document_approval_references_document_revision_id_document_revisions_id_fk" FOREIGN KEY ("document_revision_id") REFERENCES "public"."document_revisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_approval_references" ADD CONSTRAINT "document_approval_references_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_exceptions" ADD CONSTRAINT "document_exceptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_exceptions" ADD CONSTRAINT "document_exceptions_document_recall_id_document_recalls_id_fk" FOREIGN KEY ("document_recall_id") REFERENCES "public"."document_recalls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_exceptions" ADD CONSTRAINT "document_exceptions_recall_item_id_recall_items_id_fk" FOREIGN KEY ("recall_item_id") REFERENCES "public"."recall_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_exceptions" ADD CONSTRAINT "document_exceptions_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_exceptions" ADD CONSTRAINT "document_exceptions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_recalls" ADD CONSTRAINT "document_recalls_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_recalls" ADD CONSTRAINT "document_recalls_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_recalls" ADD CONSTRAINT "document_recalls_superseded_revision_id_document_revisions_id_fk" FOREIGN KEY ("superseded_revision_id") REFERENCES "public"."document_revisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_recalls" ADD CONSTRAINT "document_recalls_new_revision_id_document_revisions_id_fk" FOREIGN KEY ("new_revision_id") REFERENCES "public"."document_revisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_recalls" ADD CONSTRAINT "document_recalls_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_recalls" ADD CONSTRAINT "document_recalls_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_sync_logs" ADD CONSTRAINT "integration_sync_logs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_approvals" ADD CONSTRAINT "print_approvals_print_request_id_print_requests_id_fk" FOREIGN KEY ("print_request_id") REFERENCES "public"."print_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_approvals" ADD CONSTRAINT "print_approvals_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_requests" ADD CONSTRAINT "print_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_requests" ADD CONSTRAINT "print_requests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_requests" ADD CONSTRAINT "print_requests_document_revision_id_document_revisions_id_fk" FOREIGN KEY ("document_revision_id") REFERENCES "public"."document_revisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_requests" ADD CONSTRAINT "print_requests_requesting_user_id_users_id_fk" FOREIGN KEY ("requesting_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "print_requests" ADD CONSTRAINT "print_requests_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recall_items" ADD CONSTRAINT "recall_items_document_recall_id_document_recalls_id_fk" FOREIGN KEY ("document_recall_id") REFERENCES "public"."document_recalls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recall_items" ADD CONSTRAINT "recall_items_controlled_copy_id_controlled_copies_id_fk" FOREIGN KEY ("controlled_copy_id") REFERENCES "public"."controlled_copies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sites" ADD CONSTRAINT "sites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_org_idx" ON "audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "controlled_copies_copyid_unique" ON "controlled_copies" USING btree ("organization_id","copy_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "controlled_copies_qrtoken_unique" ON "controlled_copies" USING btree ("qr_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "controlled_copies_doc_idx" ON "controlled_copies" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "controlled_copies_status_idx" ON "controlled_copies" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "copy_acknowledgements_copy_idx" ON "copy_acknowledgements" USING btree ("controlled_copy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "copy_distributions_copy_idx" ON "copy_distributions" USING btree ("controlled_copy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "copy_verifications_copy_idx" ON "copy_verifications" USING btree ("controlled_copy_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "departments_site_code_unique" ON "departments" USING btree ("site_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "departments_site_idx" ON "departments" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "destruction_confirmations_copy_idx" ON "destruction_confirmations" USING btree ("controlled_copy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_approval_refs_rev_idx" ON "document_approval_references" USING btree ("document_revision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_exceptions_org_idx" ON "document_exceptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_recalls_doc_idx" ON "document_recalls" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_revisions_doc_rev_unique" ON "document_revisions" USING btree ("document_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_revisions_doc_idx" ON "document_revisions" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_org_docnum_unique" ON "documents" USING btree ("organization_id","document_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_site_idx" ON "documents" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_dept_idx" ON "documents" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_sync_logs_integration_idx" ON "integration_sync_logs" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_org_idx" ON "integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_approvals_req_idx" ON "print_approvals" USING btree ("print_request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_requests_doc_idx" ON "print_requests" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_requests_status_idx" ON "print_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recall_items_recall_idx" ON "recall_items" USING btree ("document_recall_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recall_items_copy_idx" ON "recall_items" USING btree ("controlled_copy_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_unique" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_org_name_unique" ON "roles" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sites_org_code_unique" ON "sites" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sites_org_idx" ON "sites" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_unique" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_org_email_unique" ON "users" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_org_idx" ON "users" USING btree ("organization_id");