ALTER TABLE "print_approvals" ADD COLUMN "approval_reference_number" varchar(150);--> statement-breakpoint
ALTER TABLE "print_approvals" ADD COLUMN "signer_full_name" text;--> statement-breakpoint
ALTER TABLE "print_approvals" ADD COLUMN "attestation_statement" text;