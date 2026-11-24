--
-- PostgreSQL database dump
--

\restrict S4T24mvRpeqKHm8GZCWg58W7fibwqwEob3fFrP2yryLX9uv4gEUTf2uChS2u9kq

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.approval_status AS ENUM (
    'DRAFT',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'OBSOLETE'
);


--
-- Name: confidentiality; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.confidentiality AS ENUM (
    'PUBLIC_INTERNAL',
    'CONFIDENTIAL',
    'RESTRICTED'
);


--
-- Name: copy_marking; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.copy_marking AS ENUM (
    'CONTROLLED_COPY',
    'UNCONTROLLED_REFERENCE_COPY',
    'MASTER_COPY',
    'SUPERSEDED_COPY'
);


--
-- Name: copy_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.copy_status AS ENUM (
    'REQUESTED',
    'APPROVED',
    'PRINTED',
    'ISSUED',
    'ACKNOWLEDGED',
    'ACTIVE',
    'RECALL_PENDING',
    'RETURNED',
    'DESTROYED',
    'LOST',
    'DAMAGED',
    'EXPIRED',
    'SUPERSEDED'
);


--
-- Name: document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_type AS ENUM (
    'SOP',
    'WI',
    'BMR',
    'BPR',
    'STP',
    'SPECIFICATION',
    'FORMAT_CHECKLIST',
    'EQUIPMENT_SOP',
    'CLEANING_PROCEDURE',
    'CALIBRATION_PROCEDURE',
    'SAFETY_PROCEDURE',
    'QUALITY_MANUAL'
);


--
-- Name: exception_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exception_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: print_classification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.print_classification AS ENUM (
    'CONTROLLED',
    'UNCONTROLLED_REFERENCE'
);


--
-- Name: print_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.print_request_status AS ENUM (
    'REQUESTED',
    'APPROVED',
    'REJECTED',
    'ISSUED',
    'CANCELLED'
);


--
-- Name: recall_item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recall_item_status AS ENUM (
    'RECALL_INITIATED',
    'RECALL_ACKNOWLEDGED',
    'PHYSICALLY_RETRIEVED',
    'DESTRUCTION_CONFIRMED',
    'OUTSTANDING',
    'LOST_INVESTIGATION',
    'EXCEPTION_APPROVED'
);


--
-- Name: recall_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recall_status AS ENUM (
    'INITIATED',
    'PARTIALLY_RECONCILED',
    'RECONCILED',
    'CLOSED_WITH_EXCEPTION'
);


--
-- Name: role_name; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role_name AS ENUM (
    'SYSTEM_ADMIN',
    'QA_HEAD',
    'DOCUMENT_CONTROLLER',
    'QA_MANAGER',
    'DEPARTMENT_HEAD',
    'EMPLOYEE',
    'AUDITOR'
);


--
-- Name: scan_verdict; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scan_verdict AS ENUM (
    'GREEN',
    'AMBER',
    'RED',
    'GREY'
);


--
-- Name: source_record_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.source_record_type AS ENUM (
    'PAPER_APPROVAL_REFERENCE',
    'ELECTRONIC_SIGNATURE',
    'ELECTRONIC_REGULATED_RECORD'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    event_type character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id uuid,
    summary text NOT NULL,
    reason_for_change text,
    previous_value jsonb,
    new_value jsonb,
    corrects_audit_event_id uuid,
    ip_address character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: controlled_copies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.controlled_copies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    copy_identifier character varying(150) NOT NULL,
    print_request_id uuid NOT NULL,
    document_id uuid NOT NULL,
    document_revision_id uuid NOT NULL,
    copy_sequence integer NOT NULL,
    marking public.copy_marking DEFAULT 'CONTROLLED_COPY'::public.copy_marking NOT NULL,
    qr_token character varying(64) NOT NULL,
    pdf_file_key text,
    page_count integer,
    status public.copy_status DEFAULT 'REQUESTED'::public.copy_status NOT NULL,
    issued_to_department_id uuid,
    destination_location text,
    printed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    print_outcome character varying(20),
    print_outcome_note text
);


--
-- Name: copy_acknowledgements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copy_acknowledgements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    controlled_copy_id uuid NOT NULL,
    acknowledged_by_user_id uuid NOT NULL,
    acknowledgement_date timestamp with time zone DEFAULT now() NOT NULL,
    remarks text
);


--
-- Name: copy_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copy_distributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    controlled_copy_id uuid NOT NULL,
    issued_to_user_id uuid,
    department_id uuid NOT NULL,
    physical_location text NOT NULL,
    equipment_or_line character varying(150),
    issued_by_user_id uuid NOT NULL,
    issue_date timestamp with time zone DEFAULT now() NOT NULL,
    return_date timestamp with time zone,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: copy_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copy_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    controlled_copy_id uuid NOT NULL,
    scanned_by_user_id uuid,
    scan_verdict public.scan_verdict NOT NULL,
    scanned_offline boolean DEFAULT false NOT NULL,
    last_sync_at timestamp with time zone,
    location_at_scan text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    site_id uuid NOT NULL,
    name text NOT NULL,
    code character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: destruction_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.destruction_confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    controlled_copy_id uuid NOT NULL,
    recall_item_id uuid,
    destruction_date timestamp with time zone DEFAULT now() NOT NULL,
    destruction_method character varying(150),
    performed_by_user_id uuid NOT NULL,
    witness_name text NOT NULL,
    witness_user_id uuid,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_approval_references; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_approval_references (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_revision_id uuid NOT NULL,
    source_record_type public.source_record_type NOT NULL,
    approval_reference_number character varying(150),
    approved_by_name text,
    approved_date timestamp with time zone,
    notes text,
    recorded_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    document_recall_id uuid,
    recall_item_id uuid,
    reason text NOT NULL,
    requested_by_user_id uuid NOT NULL,
    status public.exception_status DEFAULT 'PENDING'::public.exception_status NOT NULL,
    decided_by_user_id uuid,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_recalls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_recalls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    document_id uuid NOT NULL,
    superseded_revision_id uuid NOT NULL,
    new_revision_id uuid NOT NULL,
    status public.recall_status DEFAULT 'INITIATED'::public.recall_status NOT NULL,
    initiated_by_user_id uuid NOT NULL,
    initiated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_emergency_withdrawal boolean DEFAULT false NOT NULL,
    closed_at timestamp with time zone,
    closed_by_user_id uuid
);


--
-- Name: document_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    revision_number integer NOT NULL,
    revision_label character varying(20) NOT NULL,
    approval_status public.approval_status DEFAULT 'DRAFT'::public.approval_status NOT NULL,
    effective_date timestamp with time zone,
    review_due_date timestamp with time zone,
    superseded_revision_id uuid,
    source_file_key text,
    scanned_file_key text,
    change_summary text,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    site_id uuid NOT NULL,
    document_number character varying(100) NOT NULL,
    title text NOT NULL,
    document_type public.document_type NOT NULL,
    department_id uuid NOT NULL,
    process_category character varying(150),
    owner_user_id uuid,
    applicable_equipment text,
    confidentiality public.confidentiality DEFAULT 'PUBLIC_INTERNAL'::public.confidentiality NOT NULL,
    master_copy_location text,
    source_file_key text,
    scanned_file_key text,
    has_no_file_yet boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    current_revision_id uuid,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: integration_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status character varying(30) DEFAULT 'RUNNING'::character varying NOT NULL,
    records_synced integer DEFAULT 0,
    error_message text
);


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider_key character varying(50) NOT NULL,
    display_name text NOT NULL,
    config_json jsonb,
    is_active boolean DEFAULT false NOT NULL,
    last_successful_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(100) NOT NULL,
    title text NOT NULL,
    body text,
    related_entity_type character varying(100),
    related_entity_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(100) NOT NULL,
    description text
);


--
-- Name: print_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    print_request_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    decision character varying(20) NOT NULL,
    comments text,
    decided_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: print_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    document_id uuid NOT NULL,
    document_revision_id uuid NOT NULL,
    number_of_copies integer NOT NULL,
    requesting_user_id uuid NOT NULL,
    department_id uuid NOT NULL,
    destination_location text NOT NULL,
    intended_purpose text,
    reason_for_printing text,
    printer character varying(150),
    classification public.print_classification DEFAULT 'CONTROLLED'::public.print_classification NOT NULL,
    review_due_date timestamp with time zone,
    status public.print_request_status DEFAULT 'REQUESTED'::public.print_request_status NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recall_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recall_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_recall_id uuid NOT NULL,
    controlled_copy_id uuid NOT NULL,
    status public.recall_item_status DEFAULT 'RECALL_INITIATED'::public.recall_item_status NOT NULL,
    acknowledged_at timestamp with time zone,
    retrieved_at timestamp with time zone,
    escalated_at timestamp with time zone,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    destruction_due_at timestamp with time zone
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name public.role_name NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    code character varying(50) NOT NULL,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    site_id uuid,
    department_id uuid,
    full_name text NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    employee_code character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: controlled_copies controlled_copies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_copies
    ADD CONSTRAINT controlled_copies_pkey PRIMARY KEY (id);


--
-- Name: copy_acknowledgements copy_acknowledgements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_acknowledgements
    ADD CONSTRAINT copy_acknowledgements_pkey PRIMARY KEY (id);


--
-- Name: copy_distributions copy_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_distributions
    ADD CONSTRAINT copy_distributions_pkey PRIMARY KEY (id);


--
-- Name: copy_verifications copy_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_verifications
    ADD CONSTRAINT copy_verifications_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: destruction_confirmations destruction_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destruction_confirmations
    ADD CONSTRAINT destruction_confirmations_pkey PRIMARY KEY (id);


--
-- Name: document_approval_references document_approval_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approval_references
    ADD CONSTRAINT document_approval_references_pkey PRIMARY KEY (id);


--
-- Name: document_exceptions document_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exceptions
    ADD CONSTRAINT document_exceptions_pkey PRIMARY KEY (id);


--
-- Name: document_recalls document_recalls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recalls
    ADD CONSTRAINT document_recalls_pkey PRIMARY KEY (id);


--
-- Name: document_revisions document_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_revisions
    ADD CONSTRAINT document_revisions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: integration_sync_logs integration_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_sync_logs
    ADD CONSTRAINT integration_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_key_unique UNIQUE (key);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: print_approvals print_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_approvals
    ADD CONSTRAINT print_approvals_pkey PRIMARY KEY (id);


--
-- Name: print_requests print_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_requests
    ADD CONSTRAINT print_requests_pkey PRIMARY KEY (id);


--
-- Name: recall_items recall_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recall_items
    ADD CONSTRAINT recall_items_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_events_created_idx ON public.audit_events USING btree (created_at);


--
-- Name: audit_events_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_events_entity_idx ON public.audit_events USING btree (entity_type, entity_id);


--
-- Name: audit_events_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_events_org_idx ON public.audit_events USING btree (organization_id);


--
-- Name: controlled_copies_copyid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX controlled_copies_copyid_unique ON public.controlled_copies USING btree (organization_id, copy_identifier);


--
-- Name: controlled_copies_doc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX controlled_copies_doc_idx ON public.controlled_copies USING btree (document_id);


--
-- Name: controlled_copies_qrtoken_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX controlled_copies_qrtoken_unique ON public.controlled_copies USING btree (qr_token);


--
-- Name: controlled_copies_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX controlled_copies_status_idx ON public.controlled_copies USING btree (status);


--
-- Name: copy_acknowledgements_copy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX copy_acknowledgements_copy_idx ON public.copy_acknowledgements USING btree (controlled_copy_id);


--
-- Name: copy_distributions_copy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX copy_distributions_copy_idx ON public.copy_distributions USING btree (controlled_copy_id);


--
-- Name: copy_verifications_copy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX copy_verifications_copy_idx ON public.copy_verifications USING btree (controlled_copy_id);


--
-- Name: departments_site_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX departments_site_code_unique ON public.departments USING btree (site_id, code);


--
-- Name: departments_site_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX departments_site_idx ON public.departments USING btree (site_id);


--
-- Name: destruction_confirmations_copy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX destruction_confirmations_copy_idx ON public.destruction_confirmations USING btree (controlled_copy_id);


--
-- Name: doc_approval_refs_rev_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doc_approval_refs_rev_idx ON public.document_approval_references USING btree (document_revision_id);


--
-- Name: document_exceptions_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_exceptions_org_idx ON public.document_exceptions USING btree (organization_id);


--
-- Name: document_recalls_doc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_recalls_doc_idx ON public.document_recalls USING btree (document_id);


--
-- Name: document_revisions_doc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_revisions_doc_idx ON public.document_revisions USING btree (document_id);


--
-- Name: document_revisions_doc_rev_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_revisions_doc_rev_unique ON public.document_revisions USING btree (document_id, revision_number);


--
-- Name: documents_dept_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_dept_idx ON public.documents USING btree (department_id);


--
-- Name: documents_org_docnum_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documents_org_docnum_unique ON public.documents USING btree (organization_id, document_number);


--
-- Name: documents_site_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_site_idx ON public.documents USING btree (site_id);


--
-- Name: integration_sync_logs_integration_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_sync_logs_integration_idx ON public.integration_sync_logs USING btree (integration_id);


--
-- Name: integrations_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integrations_org_idx ON public.integrations USING btree (organization_id);


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id);


--
-- Name: organizations_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organizations_slug_unique ON public.organizations USING btree (slug);


--
-- Name: print_approvals_req_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX print_approvals_req_idx ON public.print_approvals USING btree (print_request_id);


--
-- Name: print_requests_doc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX print_requests_doc_idx ON public.print_requests USING btree (document_id);


--
-- Name: print_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX print_requests_status_idx ON public.print_requests USING btree (status);


--
-- Name: recall_items_copy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recall_items_copy_idx ON public.recall_items USING btree (controlled_copy_id);


--
-- Name: recall_items_recall_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recall_items_recall_idx ON public.recall_items USING btree (document_recall_id);


--
-- Name: role_permissions_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX role_permissions_unique ON public.role_permissions USING btree (role_id, permission_id);


--
-- Name: roles_org_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_org_name_unique ON public.roles USING btree (organization_id, name);


--
-- Name: sites_org_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sites_org_code_unique ON public.sites USING btree (organization_id, code);


--
-- Name: sites_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sites_org_idx ON public.sites USING btree (organization_id);


--
-- Name: user_roles_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_roles_unique ON public.user_roles USING btree (user_id, role_id);


--
-- Name: users_org_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_org_email_unique ON public.users USING btree (organization_id, email);


--
-- Name: users_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_org_idx ON public.users USING btree (organization_id);


--
-- Name: audit_events audit_events_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_events audit_events_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: controlled_copies controlled_copies_document_id_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_copies
    ADD CONSTRAINT controlled_copies_document_id_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: controlled_copies controlled_copies_document_revision_id_document_revisions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_copies
    ADD CONSTRAINT controlled_copies_document_revision_id_document_revisions_id_fk FOREIGN KEY (document_revision_id) REFERENCES public.document_revisions(id);


--
-- Name: controlled_copies controlled_copies_issued_to_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_copies
    ADD CONSTRAINT controlled_copies_issued_to_department_id_departments_id_fk FOREIGN KEY (issued_to_department_id) REFERENCES public.departments(id);


--
-- Name: controlled_copies controlled_copies_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_copies
    ADD CONSTRAINT controlled_copies_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: controlled_copies controlled_copies_print_request_id_print_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_copies
    ADD CONSTRAINT controlled_copies_print_request_id_print_requests_id_fk FOREIGN KEY (print_request_id) REFERENCES public.print_requests(id);


--
-- Name: copy_acknowledgements copy_acknowledgements_acknowledged_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_acknowledgements
    ADD CONSTRAINT copy_acknowledgements_acknowledged_by_user_id_users_id_fk FOREIGN KEY (acknowledged_by_user_id) REFERENCES public.users(id);


--
-- Name: copy_acknowledgements copy_acknowledgements_controlled_copy_id_controlled_copies_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_acknowledgements
    ADD CONSTRAINT copy_acknowledgements_controlled_copy_id_controlled_copies_id_f FOREIGN KEY (controlled_copy_id) REFERENCES public.controlled_copies(id);


--
-- Name: copy_distributions copy_distributions_controlled_copy_id_controlled_copies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_distributions
    ADD CONSTRAINT copy_distributions_controlled_copy_id_controlled_copies_id_fk FOREIGN KEY (controlled_copy_id) REFERENCES public.controlled_copies(id);


--
-- Name: copy_distributions copy_distributions_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_distributions
    ADD CONSTRAINT copy_distributions_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: copy_distributions copy_distributions_issued_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_distributions
    ADD CONSTRAINT copy_distributions_issued_by_user_id_users_id_fk FOREIGN KEY (issued_by_user_id) REFERENCES public.users(id);


--
-- Name: copy_distributions copy_distributions_issued_to_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_distributions
    ADD CONSTRAINT copy_distributions_issued_to_user_id_users_id_fk FOREIGN KEY (issued_to_user_id) REFERENCES public.users(id);


--
-- Name: copy_verifications copy_verifications_controlled_copy_id_controlled_copies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_verifications
    ADD CONSTRAINT copy_verifications_controlled_copy_id_controlled_copies_id_fk FOREIGN KEY (controlled_copy_id) REFERENCES public.controlled_copies(id);


--
-- Name: copy_verifications copy_verifications_scanned_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_verifications
    ADD CONSTRAINT copy_verifications_scanned_by_user_id_users_id_fk FOREIGN KEY (scanned_by_user_id) REFERENCES public.users(id);


--
-- Name: departments departments_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: departments departments_site_id_sites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_site_id_sites_id_fk FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: destruction_confirmations destruction_confirmations_controlled_copy_id_controlled_copies_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destruction_confirmations
    ADD CONSTRAINT destruction_confirmations_controlled_copy_id_controlled_copies_ FOREIGN KEY (controlled_copy_id) REFERENCES public.controlled_copies(id);


--
-- Name: destruction_confirmations destruction_confirmations_performed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destruction_confirmations
    ADD CONSTRAINT destruction_confirmations_performed_by_user_id_users_id_fk FOREIGN KEY (performed_by_user_id) REFERENCES public.users(id);


--
-- Name: destruction_confirmations destruction_confirmations_recall_item_id_recall_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destruction_confirmations
    ADD CONSTRAINT destruction_confirmations_recall_item_id_recall_items_id_fk FOREIGN KEY (recall_item_id) REFERENCES public.recall_items(id);


--
-- Name: destruction_confirmations destruction_confirmations_witness_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destruction_confirmations
    ADD CONSTRAINT destruction_confirmations_witness_user_id_users_id_fk FOREIGN KEY (witness_user_id) REFERENCES public.users(id);


--
-- Name: document_approval_references document_approval_references_document_revision_id_document_revi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approval_references
    ADD CONSTRAINT document_approval_references_document_revision_id_document_revi FOREIGN KEY (document_revision_id) REFERENCES public.document_revisions(id);


--
-- Name: document_approval_references document_approval_references_recorded_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approval_references
    ADD CONSTRAINT document_approval_references_recorded_by_user_id_users_id_fk FOREIGN KEY (recorded_by_user_id) REFERENCES public.users(id);


--
-- Name: document_exceptions document_exceptions_decided_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exceptions
    ADD CONSTRAINT document_exceptions_decided_by_user_id_users_id_fk FOREIGN KEY (decided_by_user_id) REFERENCES public.users(id);


--
-- Name: document_exceptions document_exceptions_document_recall_id_document_recalls_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exceptions
    ADD CONSTRAINT document_exceptions_document_recall_id_document_recalls_id_fk FOREIGN KEY (document_recall_id) REFERENCES public.document_recalls(id);


--
-- Name: document_exceptions document_exceptions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exceptions
    ADD CONSTRAINT document_exceptions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: document_exceptions document_exceptions_recall_item_id_recall_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exceptions
    ADD CONSTRAINT document_exceptions_recall_item_id_recall_items_id_fk FOREIGN KEY (recall_item_id) REFERENCES public.recall_items(id);


--
-- Name: document_exceptions document_exceptions_requested_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exceptions
    ADD CONSTRAINT document_exceptions_requested_by_user_id_users_id_fk FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- Name: document_recalls document_recalls_closed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recalls
    ADD CONSTRAINT document_recalls_closed_by_user_id_users_id_fk FOREIGN KEY (closed_by_user_id) REFERENCES public.users(id);


--
-- Name: document_recalls document_recalls_document_id_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recalls
    ADD CONSTRAINT document_recalls_document_id_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_recalls document_recalls_initiated_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recalls
    ADD CONSTRAINT document_recalls_initiated_by_user_id_users_id_fk FOREIGN KEY (initiated_by_user_id) REFERENCES public.users(id);


--
-- Name: document_recalls document_recalls_new_revision_id_document_revisions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recalls
    ADD CONSTRAINT document_recalls_new_revision_id_document_revisions_id_fk FOREIGN KEY (new_revision_id) REFERENCES public.document_revisions(id);


--
-- Name: document_recalls document_recalls_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recalls
    ADD CONSTRAINT document_recalls_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: document_recalls document_recalls_superseded_revision_id_document_revisions_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recalls
    ADD CONSTRAINT document_recalls_superseded_revision_id_document_revisions_id_f FOREIGN KEY (superseded_revision_id) REFERENCES public.document_revisions(id);


--
-- Name: document_revisions document_revisions_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_revisions
    ADD CONSTRAINT document_revisions_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: document_revisions document_revisions_document_id_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_revisions
    ADD CONSTRAINT document_revisions_document_id_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: documents documents_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: documents documents_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: documents documents_owner_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_owner_user_id_users_id_fk FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_site_id_sites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_site_id_sites_id_fk FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: integration_sync_logs integration_sync_logs_integration_id_integrations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_sync_logs
    ADD CONSTRAINT integration_sync_logs_integration_id_integrations_id_fk FOREIGN KEY (integration_id) REFERENCES public.integrations(id);


--
-- Name: integrations integrations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: notifications notifications_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: print_approvals print_approvals_approver_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_approvals
    ADD CONSTRAINT print_approvals_approver_user_id_users_id_fk FOREIGN KEY (approver_user_id) REFERENCES public.users(id);


--
-- Name: print_approvals print_approvals_print_request_id_print_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_approvals
    ADD CONSTRAINT print_approvals_print_request_id_print_requests_id_fk FOREIGN KEY (print_request_id) REFERENCES public.print_requests(id);


--
-- Name: print_requests print_requests_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_requests
    ADD CONSTRAINT print_requests_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: print_requests print_requests_document_id_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_requests
    ADD CONSTRAINT print_requests_document_id_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: print_requests print_requests_document_revision_id_document_revisions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_requests
    ADD CONSTRAINT print_requests_document_revision_id_document_revisions_id_fk FOREIGN KEY (document_revision_id) REFERENCES public.document_revisions(id);


--
-- Name: print_requests print_requests_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_requests
    ADD CONSTRAINT print_requests_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: print_requests print_requests_requesting_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_requests
    ADD CONSTRAINT print_requests_requesting_user_id_users_id_fk FOREIGN KEY (requesting_user_id) REFERENCES public.users(id);


--
-- Name: recall_items recall_items_controlled_copy_id_controlled_copies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recall_items
    ADD CONSTRAINT recall_items_controlled_copy_id_controlled_copies_id_fk FOREIGN KEY (controlled_copy_id) REFERENCES public.controlled_copies(id);


--
-- Name: recall_items recall_items_document_recall_id_document_recalls_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recall_items
    ADD CONSTRAINT recall_items_document_recall_id_document_recalls_id_fk FOREIGN KEY (document_recall_id) REFERENCES public.document_recalls(id);


--
-- Name: role_permissions role_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: role_permissions role_permissions_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: roles roles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sites sites_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: user_roles user_roles_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: user_roles user_roles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: users users_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: users users_site_id_sites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_site_id_sites_id_fk FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- PostgreSQL database dump complete
--

\unrestrict S4T24mvRpeqKHm8GZCWg58W7fibwqwEob3fFrP2yryLX9uv4gEUTf2uChS2u9kq

