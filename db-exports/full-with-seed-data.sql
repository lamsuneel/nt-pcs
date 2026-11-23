--
-- PostgreSQL database dump
--

\restrict lLTG2KDkgcGVtFL1IGdmEAeOxkO35LJmtcHcwm75cQhKXVI1TrbgVqv3njFuaAo

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
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: -
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	0f9cedbd096a4b7b6207b11946e7ffeeb02e4175b24ebe054a914dfc7cc10133	1795375143251
2	b3d91cff1f4bf560bd970608ef96cf61803bc71a21d417efad90e1b71854505b	1795375429710
\.


--
-- Data for Name: audit_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_events (id, organization_id, user_id, event_type, entity_type, entity_id, summary, reason_for_change, previous_value, new_value, corrects_audit_event_id, ip_address, created_at) FROM stdin;
7a056357-e969-4090-b514-3ec71ad41eee	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	8b32bf8b-306b-4275-a204-f59f075541db	Registered SOP-QA-001 — Document Control Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.384366+00
b7b14971-e40f-4130-a1b3-95a0418fc33a	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	2b645bbd-078f-4ca2-80c8-72b6be95f3e8	Registered SOP-QA-002 — Change Control Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.388713+00
047f475b-3666-4818-879c-b3269281c33c	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	a23443c5-2b83-4249-ad2d-765d3766335b	Registered SOP-QA-003 — Deviation Management Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.392184+00
524fb6af-8d6e-4b21-bdf3-d9cc20f0b5b5	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	7aa4e105-723f-4ed9-86bb-0d6dbd7f026d	Registered SOP-QA-004 — CAPA Management Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.395345+00
17c152cc-ec9d-4ad4-95ac-69aeb57e9a2e	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	37411c3e-a864-4cd5-b353-0209bb06a8e2	Registered SOP-PROD-001 — Equipment Cleaning Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.403274+00
e206abe6-ae3d-428a-8bb5-835556c78460	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	bc5da89d-44d1-45ef-9443-749288a01029	Registered SOP-PROD-002 — Dispensing Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.406995+00
6838c688-2c8c-4293-a5ac-a1fd71c0757f	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	4bcaa8d4-cdb2-4378-8426-931f6ad7b3d9	Registered SOP-PROD-003 — Granulation Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.410757+00
5f34a643-9759-4862-bc08-0898544842ec	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	0389d220-dcaf-4567-b8d5-6f960d5aa720	Registered SOP-PROD-004 — Compression Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.413845+00
1461e373-76d2-4375-9e9b-8d9999e597d9	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	02e252e5-1985-48fb-a8a5-0ddf58f2ca9e	Registered BMR-PROD-010 — Batch Manufacturing Record - Paracetamol 500mg	\N	\N	\N	\N	\N	2026-11-22 19:25:25.417574+00
b7e42682-2a2c-4da0-90f2-b7bdeb8cda47	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	83bfe0c7-0aeb-415f-8ea1-6a839f030505	Registered BPR-PKG-010 — Batch Packaging Record - Paracetamol 500mg	\N	\N	\N	\N	\N	2026-11-22 19:25:25.421504+00
e27cb660-50aa-42c4-9cec-4a906c9d587b	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	26f08fb3-1352-4f31-9c9d-150ebc1930aa	Registered SOP-QC-001 — Sample Management Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.428938+00
c682cfc9-3654-4491-94d9-df40a5b1aa55	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	f9ebb4e2-267b-476c-aed6-a958a55206b2	Registered SOP-QC-002 — HPLC Operation Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.432968+00
451a5370-b19f-4f6d-a425-15760734502a	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	01ac47a2-938e-47bb-920a-f070711abf15	Registered STP-QC-010 — Standard Test Procedure - Paracetamol Assay	\N	\N	\N	\N	\N	2026-11-22 19:25:25.44025+00
87967e65-612f-4d3e-b118-6229b84e9ef8	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	d75449ab-e4a3-4a3a-8e9b-1e8b5beeca2f	Registered SPEC-QC-010 — Specification - Paracetamol 500mg Tablets	\N	\N	\N	\N	\N	2026-11-22 19:25:25.445625+00
75309706-478c-4a94-8288-d8a4397c55e8	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	f9cb9f7f-bd17-49b6-9076-056f221e975b	Registered SOP-WH-001 — Raw Material Receipt Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.451781+00
05507713-e67d-4d5d-ade7-b2cfc9dde972	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	af8c0286-b618-43ba-8a4f-6e0b2c1d09cb	Registered SOP-WH-002 — Material Storage and Issuance Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.457088+00
1567367f-0271-4e95-a84c-e6a191ceefe8	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	b451c18e-b128-45f9-944c-5e933656e9cb	Registered SOP-ENG-001 — Equipment Calibration Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.462164+00
c53f4cc1-a6d7-4409-acb4-ea5386ad67af	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	bd7f9da6-6a42-427e-9e77-95038429ab08	Registered SOP-ENG-002 — Preventive Maintenance Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.46692+00
6bb74a7c-cb7e-4381-86fb-f970dc95a66d	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	dbfafb20-7a30-4ec0-b73c-5d54332107de	Registered SOP-SAF-001 — Personal Protective Equipment Procedure	\N	\N	\N	\N	\N	2026-11-22 19:25:25.47267+00
c2408f4e-b373-4510-8a64-23c54faa47e2	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	692b542f-830e-4491-8210-415e20fb108c	Registered QM-QA-001 — Quality Manual	\N	\N	\N	\N	\N	2026-11-22 19:25:25.47868+00
5d48780a-799c-495f-b325-3d086baeb19d	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	c9aa200a-b305-430c-ac5f-cb1593304a6e	Registered FMT-QA-010 — Line Clearance Checklist	\N	\N	\N	\N	\N	2026-11-22 19:25:25.482429+00
a63bd18c-2656-4a70-8a77-bdb356685bd7	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DOCUMENT_REGISTERED	document	6d7cf7f9-ff24-4a73-ab02-46014a8eabff	Registered WI-PKG-001 — Blister Packing Work Instruction	\N	\N	\N	\N	\N	2026-11-22 19:25:25.486344+00
5a85701f-3865-4d26-989d-2301dc46b4eb	49644282-b8cd-40df-a5fd-e1828b31799d	74571048-fddf-4af7-b6d8-2cf1d3f004c3	PRINT_REQUESTED	print_request	2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	Requested 5 controlled copies of SOP-PROD-001 rev 01	\N	\N	\N	\N	\N	2026-11-22 19:25:25.489851+00
10cc3079-bfc4-4888-8171-54a0f29d9445	49644282-b8cd-40df-a5fd-e1828b31799d	8b180e7f-7388-445a-bc04-5370185c1006	PRINT_APPROVED	print_request	2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	Print request approved by QA Manager	\N	\N	\N	\N	\N	2026-11-22 19:25:25.493754+00
94b19159-392c-49d9-b775-ec4b29c54872	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	PRINT_ISSUED	print_request	2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	5 controlled copies generated for SOP-PROD-001 rev 01	\N	\N	\N	\N	\N	2026-11-22 19:25:25.75644+00
ea8690e9-63d1-4bd9-a03d-5b8398381d13	49644282-b8cd-40df-a5fd-e1828b31799d	d61aed21-2a51-44ab-91c1-95a17e9932cb	QR_SCANNED	controlled_copy	577a3eee-09e0-4f93-9b85-1a5657d7dd3c	SOP-PROD-001-REV01-COPY-0001 scanned — verdict GREEN	\N	\N	\N	\N	\N	2026-11-22 19:25:25.765321+00
56c84928-3de4-4ea0-9b91-c3187e4d337e	49644282-b8cd-40df-a5fd-e1828b31799d	8b8667c6-1f1a-4d7f-b3b0-8b877957d75d	REVISION_REGISTERED	document_revision	160b7afd-faee-400c-84b1-5cdbf33c2c1c	Revision 02 of SOP-PROD-001 registered and approved	\N	\N	\N	\N	\N	2026-11-22 19:25:25.770839+00
021afbb4-6214-4c64-a3d9-8c666b5a5ccb	49644282-b8cd-40df-a5fd-e1828b31799d	8b8667c6-1f1a-4d7f-b3b0-8b877957d75d	RECALL_INITIATED	document_recall	62f55b21-60f3-42ba-b5b0-bb9f3e81416c	Recall initiated for 5 active copies of SOP-PROD-001 rev 01	\N	\N	\N	\N	\N	2026-11-22 19:25:25.784468+00
6dbf5db6-eb3b-41f6-9df0-4f1d9e603061	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DESTRUCTION_CONFIRMED	controlled_copy	577a3eee-09e0-4f93-9b85-1a5657d7dd3c	Destruction confirmed, witness: Arjun Reddy (QA Manager)	\N	\N	\N	\N	\N	2026-11-22 19:25:25.789881+00
dc21f490-1d09-4873-b798-845e34672e65	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DESTRUCTION_CONFIRMED	controlled_copy	62e4f8c3-86ab-4afd-aedc-a82c79c4ceaa	Destruction confirmed, witness: Arjun Reddy (QA Manager)	\N	\N	\N	\N	\N	2026-11-22 19:25:25.794693+00
65d2d166-db1e-41df-96e5-c8d7f7745e6f	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	DESTRUCTION_CONFIRMED	controlled_copy	5130b993-6838-4db9-b57c-d2979a050fc2	Destruction confirmed, witness: Arjun Reddy (QA Manager)	\N	\N	\N	\N	\N	2026-11-22 19:25:25.801024+00
ee13a2b2-7448-4752-a4fe-235cdec440b7	49644282-b8cd-40df-a5fd-e1828b31799d	8b8667c6-1f1a-4d7f-b3b0-8b877957d75d	RECALL_ITEM_ESCALATED	recall_item	5195f41b-3bfc-4b0c-ab2e-c1f34ff402ae	Recall item escalated as outstanding — reminder sent to Production Block A	\N	\N	\N	\N	\N	2026-11-22 19:25:25.802653+00
9c3086d0-528f-45ee-8e95-41bfcfe797e7	49644282-b8cd-40df-a5fd-e1828b31799d	8b8667c6-1f1a-4d7f-b3b0-8b877957d75d	RECALL_ITEM_ESCALATED	recall_item	57cc380e-dc72-45f5-9a9a-c837e344db16	Recall item escalated as outstanding — reminder sent to Production Block A	\N	\N	\N	\N	\N	2026-11-22 19:25:25.803628+00
0e4ea953-ad50-4b96-b487-3c0085ac6655	49644282-b8cd-40df-a5fd-e1828b31799d	8b8667c6-1f1a-4d7f-b3b0-8b877957d75d	USER_LOGIN	user	8b8667c6-1f1a-4d7f-b3b0-8b877957d75d	Dr. Lakshmi Narayan logged in	\N	\N	\N	\N	\N	2026-11-22 19:32:00.293194+00
fb8fdf3f-b46d-44f9-8026-7b1d51ba3765	49644282-b8cd-40df-a5fd-e1828b31799d	\N	QR_SCANNED	controlled_copy	62e4f8c3-86ab-4afd-aedc-a82c79c4ceaa	SOP-PROD-001-REV01-COPY-0002 scanned — verdict RED	\N	\N	\N	\N	\N	2026-11-22 19:32:21.188672+00
baa97c1a-22fb-4284-b2c0-b513e6dd95da	49644282-b8cd-40df-a5fd-e1828b31799d	74571048-fddf-4af7-b6d8-2cf1d3f004c3	USER_LOGIN	user	74571048-fddf-4af7-b6d8-2cf1d3f004c3	Deepa Varma logged in	\N	\N	\N	\N	\N	2026-11-22 19:32:31.441283+00
9bcfcbef-78fa-4764-9557-cdc450b3b836	49644282-b8cd-40df-a5fd-e1828b31799d	74571048-fddf-4af7-b6d8-2cf1d3f004c3	PRINT_REQUESTED	print_request	40f2949e-433b-4a01-be99-77617a57af85	Requested 2 controlled copies of SOP-QA-001 rev 01	\N	\N	\N	\N	\N	2026-11-22 19:32:31.50904+00
c8c03836-4800-406a-804f-b44ef4595d9f	49644282-b8cd-40df-a5fd-e1828b31799d	8b180e7f-7388-445a-bc04-5370185c1006	USER_LOGIN	user	8b180e7f-7388-445a-bc04-5370185c1006	Arjun Reddy logged in	\N	\N	\N	\N	\N	2026-11-22 19:32:31.642523+00
e019e58e-162e-4625-b963-6523e917931f	49644282-b8cd-40df-a5fd-e1828b31799d	8b180e7f-7388-445a-bc04-5370185c1006	PRINT_APPROVED	print_request	40f2949e-433b-4a01-be99-77617a57af85	Print request approved by Arjun Reddy	\N	\N	\N	\N	\N	2026-11-22 19:32:31.674708+00
d0ae709a-c364-4042-8d97-f037875f3cea	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	USER_LOGIN	user	26b94886-0384-4bf2-910f-c85236ac072d	Priya Menon logged in	\N	\N	\N	\N	\N	2026-11-22 19:32:31.777455+00
c7d5971d-93eb-41ed-aaf3-e9e68a876ab2	49644282-b8cd-40df-a5fd-e1828b31799d	26b94886-0384-4bf2-910f-c85236ac072d	PRINT_ISSUED	print_request	40f2949e-433b-4a01-be99-77617a57af85	2 controlled copies generated for SOP-QA-001 rev 01	\N	\N	{"copyIdentifiers": ["SOP-QA-001-REV01-COPY-0001", "SOP-QA-001-REV01-COPY-0002"]}	\N	\N	2026-11-22 19:32:32.056876+00
cc6054dc-d362-4762-a6ee-7cdff702cd46	49644282-b8cd-40df-a5fd-e1828b31799d	d61aed21-2a51-44ab-91c1-95a17e9932cb	USER_LOGIN	user	d61aed21-2a51-44ab-91c1-95a17e9932cb	Ravi Teja logged in	\N	\N	\N	\N	\N	2026-11-22 19:32:39.148156+00
\.


--
-- Data for Name: controlled_copies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.controlled_copies (id, organization_id, copy_identifier, print_request_id, document_id, document_revision_id, copy_sequence, marking, qr_token, pdf_file_key, page_count, status, issued_to_department_id, destination_location, printed_at, created_at, updated_at, print_outcome, print_outcome_note) FROM stdin;
cea6312e-9c80-4232-ba45-50eba7e42d2d	49644282-b8cd-40df-a5fd-e1828b31799d	SOP-PROD-001-REV01-COPY-0004	2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	37411c3e-a864-4cd5-b353-0209bb06a8e2	6abdd19a-3b4b-4088-9fd1-872862ad4e05	4	CONTROLLED_COPY	G1QcFoHAQT8eOVvB4UuzQXH0ghhCDxgfmLSJydlp	copies/49644282-b8cd-40df-a5fd-e1828b31799d/SOP-PROD-001-REV01-COPY-0004.pdf	\N	RECALL_PENDING	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - QC Station	2026-06-10 00:00:00+00	2026-11-22 19:25:25.729097+00	2026-11-22 19:25:25.729097+00	SUCCEEDED	\N
97dca5a3-bb13-4530-a3a2-1b709a48dcff	49644282-b8cd-40df-a5fd-e1828b31799d	SOP-PROD-001-REV01-COPY-0005	2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	37411c3e-a864-4cd5-b353-0209bb06a8e2	6abdd19a-3b4b-4088-9fd1-872862ad4e05	5	CONTROLLED_COPY	tIE3kt7pAOy9FLyotS5glROcIWtT2Me3wJGdxVQK	copies/49644282-b8cd-40df-a5fd-e1828b31799d/SOP-PROD-001-REV01-COPY-0005.pdf	\N	RECALL_PENDING	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - Supervisor Desk	2026-06-10 00:00:00+00	2026-11-22 19:25:25.752768+00	2026-11-22 19:25:25.752768+00	SUCCEEDED	\N
577a3eee-09e0-4f93-9b85-1a5657d7dd3c	49644282-b8cd-40df-a5fd-e1828b31799d	SOP-PROD-001-REV01-COPY-0001	2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	37411c3e-a864-4cd5-b353-0209bb06a8e2	6abdd19a-3b4b-4088-9fd1-872862ad4e05	1	CONTROLLED_COPY	MS9MLxfnAwBLCrqDdcjtORzNcHAnf58CxLWnX1Ui	copies/49644282-b8cd-40df-a5fd-e1828b31799d/SOP-PROD-001-REV01-COPY-0001.pdf	\N	DESTROYED	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - Line 1	2026-06-10 00:00:00+00	2026-11-22 19:25:25.608214+00	2026-11-22 19:25:25.608214+00	SUCCEEDED	\N
62e4f8c3-86ab-4afd-aedc-a82c79c4ceaa	49644282-b8cd-40df-a5fd-e1828b31799d	SOP-PROD-001-REV01-COPY-0002	2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	37411c3e-a864-4cd5-b353-0209bb06a8e2	6abdd19a-3b4b-4088-9fd1-872862ad4e05	2	CONTROLLED_COPY	bQMVxeg9wjC0PIieNh0qB0abzmZJhqb9CVGBs84A	copies/49644282-b8cd-40df-a5fd-e1828b31799d/SOP-PROD-001-REV01-COPY-0002.pdf	\N	DESTROYED	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - Line 2	2026-06-10 00:00:00+00	2026-11-22 19:25:25.658464+00	2026-11-22 19:25:25.658464+00	SUCCEEDED	\N
5130b993-6838-4db9-b57c-d2979a050fc2	49644282-b8cd-40df-a5fd-e1828b31799d	SOP-PROD-001-REV01-COPY-0003	2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	37411c3e-a864-4cd5-b353-0209bb06a8e2	6abdd19a-3b4b-4088-9fd1-872862ad4e05	3	CONTROLLED_COPY	wkXHMtRHVFlw67IGAUpIz38EcuAJ6srBE9wwTJuy	copies/49644282-b8cd-40df-a5fd-e1828b31799d/SOP-PROD-001-REV01-COPY-0003.pdf	\N	DESTROYED	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - Line 3	2026-06-10 00:00:00+00	2026-11-22 19:25:25.699733+00	2026-11-22 19:25:25.699733+00	SUCCEEDED	\N
10d589aa-a042-40f8-947a-763dcd8a0b27	49644282-b8cd-40df-a5fd-e1828b31799d	SOP-WH-001-REV01-COPY-0001	d6bf5207-0386-41a0-b8ed-60c101c7ea22	f9cb9f7f-bd17-49b6-9076-056f221e975b	66da6ef3-f8c5-4ad3-9b6d-f725c6f1ce74	1	CONTROLLED_COPY	HUkBZURMi6JTB9kTimbAeE5PdBxxM71rNgzQwYxs	\N	\N	LOST	b77410e6-c454-4d01-9c0f-9cd40ccf8a52	Warehouse Dock 2	2026-09-01 00:00:00+00	2026-11-22 19:25:25.834996+00	2026-11-22 19:25:25.834996+00	\N	\N
e546d269-b930-4344-b733-b649f342e037	49644282-b8cd-40df-a5fd-e1828b31799d	SOP-QA-001-REV01-COPY-0001	40f2949e-433b-4a01-be99-77617a57af85	8b32bf8b-306b-4275-a204-f59f075541db	c7a07816-c7ab-49e7-8b0e-dfe3e3c7c006	1	CONTROLLED_COPY	3YOfm9XAIO4PqAcWpjm3wVQzVHGcuushYlgUEy1y	copies/49644282-b8cd-40df-a5fd-e1828b31799d/SOP-QA-001-REV01-COPY-0001.pdf	\N	PRINTED	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	QA Office	2026-11-22 19:32:31.971+00	2026-11-22 19:32:31.972174+00	2026-11-22 19:32:31.972174+00	SUCCEEDED	\N
f98d1f1d-1f43-48e3-b398-aed31f24bb03	49644282-b8cd-40df-a5fd-e1828b31799d	SOP-QA-001-REV01-COPY-0002	40f2949e-433b-4a01-be99-77617a57af85	8b32bf8b-306b-4275-a204-f59f075541db	c7a07816-c7ab-49e7-8b0e-dfe3e3c7c006	2	CONTROLLED_COPY	EZKKs1fOyiXP0UUwNoCohnrLdnlmdeCUCCm5PTzN	copies/49644282-b8cd-40df-a5fd-e1828b31799d/SOP-QA-001-REV01-COPY-0002.pdf	\N	PRINTED	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	QA Office	2026-11-22 19:32:32.052+00	2026-11-22 19:32:32.053287+00	2026-11-22 19:32:32.053287+00	SUCCEEDED	\N
\.


--
-- Data for Name: copy_acknowledgements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.copy_acknowledgements (id, controlled_copy_id, acknowledged_by_user_id, acknowledgement_date, remarks) FROM stdin;
3e39d57a-7c4b-402e-bc8e-f149d90f4b58	577a3eee-09e0-4f93-9b85-1a5657d7dd3c	d61aed21-2a51-44ab-91c1-95a17e9932cb	2026-11-22 19:25:25.762733+00	\N
23e2f49b-6895-4cfb-b57e-92ad511b06d9	62e4f8c3-86ab-4afd-aedc-a82c79c4ceaa	d61aed21-2a51-44ab-91c1-95a17e9932cb	2026-11-22 19:25:25.765872+00	\N
9aa564e2-be06-473c-9ba4-d1850d36c7b3	5130b993-6838-4db9-b57c-d2979a050fc2	d61aed21-2a51-44ab-91c1-95a17e9932cb	2026-11-22 19:25:25.766728+00	\N
1ac66ec3-7000-47b5-b049-38e0ffedd5d3	cea6312e-9c80-4232-ba45-50eba7e42d2d	d61aed21-2a51-44ab-91c1-95a17e9932cb	2026-11-22 19:25:25.76787+00	\N
f3229502-cbaa-44eb-90b8-1d643a95d299	97dca5a3-bb13-4530-a3a2-1b709a48dcff	d61aed21-2a51-44ab-91c1-95a17e9932cb	2026-11-22 19:25:25.76884+00	\N
\.


--
-- Data for Name: copy_distributions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.copy_distributions (id, controlled_copy_id, issued_to_user_id, department_id, physical_location, equipment_or_line, issued_by_user_id, issue_date, return_date, remarks, created_at) FROM stdin;
cf567edd-8564-4ecd-ab5b-18e44cd44a54	577a3eee-09e0-4f93-9b85-1a5657d7dd3c	\N	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - Line 1	\N	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.757218+00	\N	\N	2026-11-22 19:25:25.757218+00
d9201cea-26c8-4036-b14d-2913927805ce	62e4f8c3-86ab-4afd-aedc-a82c79c4ceaa	\N	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - Line 2	\N	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.758471+00	\N	\N	2026-11-22 19:25:25.758471+00
b4f437c2-17c0-42a5-9fbf-cdfe706524ff	5130b993-6838-4db9-b57c-d2979a050fc2	\N	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - Line 3	\N	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.759133+00	\N	\N	2026-11-22 19:25:25.759133+00
c792c806-c15c-43ec-9419-dd0a1da15a68	cea6312e-9c80-4232-ba45-50eba7e42d2d	\N	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - QC Station	\N	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.759886+00	\N	\N	2026-11-22 19:25:25.759886+00
d144b703-673e-4466-a871-eb6ddabc946c	97dca5a3-bb13-4530-a3a2-1b709a48dcff	\N	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A - Supervisor Desk	\N	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.760524+00	\N	\N	2026-11-22 19:25:25.760524+00
\.


--
-- Data for Name: copy_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.copy_verifications (id, controlled_copy_id, scanned_by_user_id, scan_verdict, scanned_offline, last_sync_at, location_at_scan, created_at) FROM stdin;
57ba4db7-27e6-4513-b164-3c5ad112da21	577a3eee-09e0-4f93-9b85-1a5657d7dd3c	d61aed21-2a51-44ab-91c1-95a17e9932cb	GREEN	f	\N	Production Block A - Line 1	2026-11-22 19:25:25.764308+00
e058d1e6-e3e7-4eaf-82fd-52b59ed27f9e	62e4f8c3-86ab-4afd-aedc-a82c79c4ceaa	\N	RED	f	2026-11-22 19:32:21.186+00	\N	2026-11-22 19:32:21.187146+00
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, organization_id, site_id, name, code, is_active, created_at, updated_at) FROM stdin;
de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	Quality Assurance	QA	t	2026-11-22 19:25:25.261861+00	2026-11-22 19:25:25.261861+00
2b58f69a-aadc-4eaf-ba65-43d4787e608c	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	Quality Control	QC	t	2026-11-22 19:25:25.261861+00	2026-11-22 19:25:25.261861+00
78e7ee0c-c7ad-4618-b245-6f9fe8475998	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	Production	PROD	t	2026-11-22 19:25:25.261861+00	2026-11-22 19:25:25.261861+00
842573d4-d35e-46b1-93ad-c226a1ef3a45	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	Engineering	ENG	t	2026-11-22 19:25:25.261861+00	2026-11-22 19:25:25.261861+00
b77410e6-c454-4d01-9c0f-9cd40ccf8a52	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	Warehouse	WH	t	2026-11-22 19:25:25.261861+00	2026-11-22 19:25:25.261861+00
ee3d43e7-af3b-4400-ab1e-1e29fbbca98b	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	Packaging	PKG	t	2026-11-22 19:25:25.261861+00	2026-11-22 19:25:25.261861+00
\.


--
-- Data for Name: destruction_confirmations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.destruction_confirmations (id, controlled_copy_id, recall_item_id, destruction_date, destruction_method, performed_by_user_id, witness_name, witness_user_id, remarks, created_at) FROM stdin;
c1cfe64d-9d66-4f95-961d-cd7a6015214d	577a3eee-09e0-4f93-9b85-1a5657d7dd3c	e60e5901-1658-48e4-bb41-e1d9136e9b3c	2026-11-22 19:25:25.787273+00	Shredding	26b94886-0384-4bf2-910f-c85236ac072d	Arjun Reddy (QA Manager)	8b180e7f-7388-445a-bc04-5370185c1006	Witnessed destruction per recall reconciliation.	2026-11-22 19:25:25.787273+00
ee871447-4324-481d-bb39-b80635d2c94e	62e4f8c3-86ab-4afd-aedc-a82c79c4ceaa	61ff755c-ced8-403b-83da-f0c8db062964	2026-11-22 19:25:25.792556+00	Shredding	26b94886-0384-4bf2-910f-c85236ac072d	Arjun Reddy (QA Manager)	8b180e7f-7388-445a-bc04-5370185c1006	Witnessed destruction per recall reconciliation.	2026-11-22 19:25:25.792556+00
58cd39ba-b186-4fd6-a92a-29bce6fb5683	5130b993-6838-4db9-b57c-d2979a050fc2	ccb8bf01-f028-4ef0-b499-ee7570522c2c	2026-11-22 19:25:25.798419+00	Shredding	26b94886-0384-4bf2-910f-c85236ac072d	Arjun Reddy (QA Manager)	8b180e7f-7388-445a-bc04-5370185c1006	Witnessed destruction per recall reconciliation.	2026-11-22 19:25:25.798419+00
\.


--
-- Data for Name: document_approval_references; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_approval_references (id, document_revision_id, source_record_type, approval_reference_number, approved_by_name, approved_date, notes, recorded_by_user_id, created_at) FROM stdin;
78bccf0a-4ccc-4db3-8977-9adf04eb8b98	c7a07816-c7ab-49e7-8b0e-dfe3e3c7c006	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-QA-001-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.382965+00
f95e3d46-2b24-4760-92bf-a7a60d936a09	19166748-ab00-48f3-99f5-da0e29f423bb	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-QA-002-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.388018+00
a8d75832-9d9b-4e1c-8c18-dd03ffae83f0	a1619cfb-c619-404b-9a53-51d2f1d7ba79	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-QA-003-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.391658+00
4e2b1968-519b-4ce5-9a93-f88240e9b7d6	261b0869-82b1-4f2b-b813-332e5ea75099	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-QA-004-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.394816+00
a163b99c-86c9-4fb3-9211-38658cf8ea08	6abdd19a-3b4b-4088-9fd1-872862ad4e05	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-PROD-001-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.402507+00
49754ebf-14b2-485b-80bb-2fc4a58e2bbe	f0f01098-109f-448c-ae15-ee4e785877d1	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-PROD-002-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.406447+00
6b052e95-65fa-40eb-bfb7-22291a7c8896	1bd1e255-24be-4120-a6f0-de8b5dfc02e2	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-PROD-003-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.410255+00
8fad9585-b695-439e-ae7c-ee3fc2813118	5605cb60-ef03-4e10-b68d-831aa4cfb37a	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-PROD-004-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.41332+00
5933e85a-617c-489d-ac6e-c00efda0a169	3db6c412-cdb8-4773-8f77-dc5cc34215ce	PAPER_APPROVAL_REFERENCE	QA-APPR-BMR-PROD-010-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.416684+00
8c117bdb-abcb-41bc-81b1-6860412c668d	9895cfc5-de74-49a4-b329-2a910d11cf3a	PAPER_APPROVAL_REFERENCE	QA-APPR-BPR-PKG-010-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.420864+00
2555440f-ccf0-4aca-becb-15337a8ee64b	de8eefe5-7384-44c6-bc18-8f78b18faa73	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-QC-001-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.427941+00
7ee84a42-d5ed-4da3-a46d-69966d20f42a	cd1d0e97-a631-4f26-982b-1d0544764153	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-QC-002-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.432343+00
fe5e77af-caf8-4881-8dfe-fb34c88cb698	3323c0bc-cd53-4913-9f6e-e229ddf53571	PAPER_APPROVAL_REFERENCE	QA-APPR-STP-QC-010-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.439634+00
cc1cca43-1ae4-401e-9f95-ccc362ad595b	b794e79c-40c8-4491-997b-18a3ff6e03cb	PAPER_APPROVAL_REFERENCE	QA-APPR-SPEC-QC-010-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.44483+00
e0cab095-fe5d-4fe9-9da9-cc24b4b88bf9	66da6ef3-f8c5-4ad3-9b6d-f725c6f1ce74	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-WH-001-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.450581+00
e194eade-3ab2-4ee1-ac26-1ee8ab0f4d2f	532fc1ca-82d1-446e-8101-fe7793c964c9	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-WH-002-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.45619+00
6f6f2212-26f1-4d26-af6b-0885389a9993	78ed117e-8867-4175-bace-dbac737930fd	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-ENG-001-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.461317+00
5d3bd84e-d17f-411a-b001-b11c9aa871b2	4f4f7d50-4a76-4be7-a424-56b574ce6cac	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-ENG-002-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.465988+00
10eec04a-d0ec-4e7f-b030-4ff9ef5fff6c	4271bf47-5fde-4fe4-b1e7-31812cee5605	PAPER_APPROVAL_REFERENCE	QA-APPR-SOP-SAF-001-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.471775+00
a44c9aa1-a52d-4867-8d46-72e84214850e	7df02dd3-4a9c-4530-b46d-33f058a7c2ea	PAPER_APPROVAL_REFERENCE	QA-APPR-QM-QA-001-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.477918+00
27fe8713-ac81-47d4-959e-efb994f85347	22f429bb-e166-4bf3-9afe-df59dacd6bc2	PAPER_APPROVAL_REFERENCE	QA-APPR-FMT-QA-010-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.481792+00
9f58881a-0df3-415e-95fe-d4b29ed38f4c	d02084c9-a324-4a87-94b8-60e214dbd36f	PAPER_APPROVAL_REFERENCE	QA-APPR-WI-PKG-001-01	Dr. Lakshmi Narayan	2026-05-28 00:00:00+00	Signed paper master retained in Document Control Room.	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.485646+00
\.


--
-- Data for Name: document_exceptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_exceptions (id, organization_id, document_recall_id, recall_item_id, reason, requested_by_user_id, status, decided_by_user_id, decided_at, created_at) FROM stdin;
\.


--
-- Data for Name: document_recalls; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_recalls (id, organization_id, document_id, superseded_revision_id, new_revision_id, status, initiated_by_user_id, initiated_at, is_emergency_withdrawal, closed_at, closed_by_user_id) FROM stdin;
62f55b21-60f3-42ba-b5b0-bb9f3e81416c	49644282-b8cd-40df-a5fd-e1828b31799d	37411c3e-a864-4cd5-b353-0209bb06a8e2	6abdd19a-3b4b-4088-9fd1-872862ad4e05	160b7afd-faee-400c-84b1-5cdbf33c2c1c	PARTIALLY_RECONCILED	8b8667c6-1f1a-4d7f-b3b0-8b877957d75d	2026-11-22 19:25:25.772524+00	f	\N	\N
\.


--
-- Data for Name: document_revisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_revisions (id, document_id, revision_number, revision_label, approval_status, effective_date, review_due_date, superseded_revision_id, source_file_key, scanned_file_key, change_summary, created_by_user_id, created_at, updated_at) FROM stdin;
c7a07816-c7ab-49e7-8b0e-dfe3e3c7c006	8b32bf8b-306b-4275-a204-f59f075541db	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.380093+00	2026-11-22 19:25:25.380093+00
19166748-ab00-48f3-99f5-da0e29f423bb	2b645bbd-078f-4ca2-80c8-72b6be95f3e8	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.386653+00	2026-11-22 19:25:25.386653+00
a1619cfb-c619-404b-9a53-51d2f1d7ba79	a23443c5-2b83-4249-ad2d-765d3766335b	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.390313+00	2026-11-22 19:25:25.390313+00
261b0869-82b1-4f2b-b813-332e5ea75099	7aa4e105-723f-4ed9-86bb-0d6dbd7f026d	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.393715+00	2026-11-22 19:25:25.393715+00
6abdd19a-3b4b-4088-9fd1-872862ad4e05	37411c3e-a864-4cd5-b353-0209bb06a8e2	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.400383+00	2026-11-22 19:25:25.400383+00
f0f01098-109f-448c-ae15-ee4e785877d1	bc5da89d-44d1-45ef-9443-749288a01029	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.405044+00	2026-11-22 19:25:25.405044+00
1bd1e255-24be-4120-a6f0-de8b5dfc02e2	4bcaa8d4-cdb2-4378-8426-931f6ad7b3d9	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.408926+00	2026-11-22 19:25:25.408926+00
5605cb60-ef03-4e10-b68d-831aa4cfb37a	0389d220-dcaf-4567-b8d5-6f960d5aa720	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.412107+00	2026-11-22 19:25:25.412107+00
3db6c412-cdb8-4773-8f77-dc5cc34215ce	02e252e5-1985-48fb-a8a5-0ddf58f2ca9e	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.415123+00	2026-11-22 19:25:25.415123+00
9895cfc5-de74-49a4-b329-2a910d11cf3a	83bfe0c7-0aeb-415f-8ea1-6a839f030505	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.419331+00	2026-11-22 19:25:25.419331+00
de8eefe5-7384-44c6-bc18-8f78b18faa73	26f08fb3-1352-4f31-9c9d-150ebc1930aa	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.42623+00	2026-11-22 19:25:25.42623+00
cd1d0e97-a631-4f26-982b-1d0544764153	f9ebb4e2-267b-476c-aed6-a958a55206b2	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.431006+00	2026-11-22 19:25:25.431006+00
3323c0bc-cd53-4913-9f6e-e229ddf53571	01ac47a2-938e-47bb-920a-f070711abf15	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.437147+00	2026-11-22 19:25:25.437147+00
b794e79c-40c8-4491-997b-18a3ff6e03cb	d75449ab-e4a3-4a3a-8e9b-1e8b5beeca2f	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.442631+00	2026-11-22 19:25:25.442631+00
66da6ef3-f8c5-4ad3-9b6d-f725c6f1ce74	f9cb9f7f-bd17-49b6-9076-056f221e975b	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.449257+00	2026-11-22 19:25:25.449257+00
532fc1ca-82d1-446e-8101-fe7793c964c9	af8c0286-b618-43ba-8a4f-6e0b2c1d09cb	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.454405+00	2026-11-22 19:25:25.454405+00
78ed117e-8867-4175-bace-dbac737930fd	b451c18e-b128-45f9-944c-5e933656e9cb	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.459584+00	2026-11-22 19:25:25.459584+00
4f4f7d50-4a76-4be7-a424-56b574ce6cac	bd7f9da6-6a42-427e-9e77-95038429ab08	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.464173+00	2026-11-22 19:25:25.464173+00
4271bf47-5fde-4fe4-b1e7-31812cee5605	dbfafb20-7a30-4ec0-b73c-5d54332107de	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.469832+00	2026-11-22 19:25:25.469832+00
7df02dd3-4a9c-4530-b46d-33f058a7c2ea	692b542f-830e-4491-8210-415e20fb108c	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.475418+00	2026-11-22 19:25:25.475418+00
22f429bb-e166-4bf3-9afe-df59dacd6bc2	c9aa200a-b305-430c-ac5f-cb1593304a6e	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.480587+00	2026-11-22 19:25:25.480587+00
d02084c9-a324-4a87-94b8-60e214dbd36f	6d7cf7f9-ff24-4a73-ab02-46014a8eabff	1	01	APPROVED	2026-06-01 00:00:00+00	2027-06-01 00:00:00+00	\N	\N	\N	Initial registration (paper-first onboarding)	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.484026+00	2026-11-22 19:25:25.484026+00
160b7afd-faee-400c-84b1-5cdbf33c2c1c	37411c3e-a864-4cd5-b353-0209bb06a8e2	2	02	APPROVED	2026-11-01 00:00:00+00	2027-11-01 00:00:00+00	6abdd19a-3b4b-4088-9fd1-872862ad4e05	\N	\N	Updated cleaning validation hold-time per CAPA-2026-041	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.769777+00	2026-11-22 19:25:25.769777+00
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents (id, organization_id, site_id, document_number, title, document_type, department_id, process_category, owner_user_id, applicable_equipment, confidentiality, master_copy_location, source_file_key, scanned_file_key, has_no_file_yet, is_active, current_revision_id, created_by_user_id, created_at, updated_at) FROM stdin;
8b32bf8b-306b-4275-a204-f59f075541db	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-QA-001	Document Control Procedure	SOP	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	\N	\N	\N	PUBLIC_INTERNAL	QA Document Control Room, Rack 2	\N	\N	t	t	c7a07816-c7ab-49e7-8b0e-dfe3e3c7c006	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.377888+00	2026-11-22 19:25:25.377888+00
2b645bbd-078f-4ca2-80c8-72b6be95f3e8	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-QA-002	Change Control Procedure	SOP	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	\N	\N	\N	PUBLIC_INTERNAL	QA Document Control Room, Rack 4	\N	\N	t	t	19166748-ab00-48f3-99f5-da0e29f423bb	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.385823+00	2026-11-22 19:25:25.385823+00
a23443c5-2b83-4249-ad2d-765d3766335b	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-QA-003	Deviation Management Procedure	SOP	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	\N	\N	\N	PUBLIC_INTERNAL	QA Document Control Room, Rack 5	\N	\N	t	t	a1619cfb-c619-404b-9a53-51d2f1d7ba79	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.389473+00	2026-11-22 19:25:25.389473+00
7aa4e105-723f-4ed9-86bb-0d6dbd7f026d	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-QA-004	CAPA Management Procedure	SOP	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	\N	\N	\N	PUBLIC_INTERNAL	QA Document Control Room, Rack 5	\N	\N	t	t	261b0869-82b1-4f2b-b813-332e5ea75099	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.39286+00	2026-11-22 19:25:25.39286+00
bc5da89d-44d1-45ef-9443-749288a01029	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-PROD-002	Dispensing Procedure	SOP	78e7ee0c-c7ad-4618-b245-6f9fe8475998	\N	\N	\N	PUBLIC_INTERNAL	PROD Document Control Room, Rack 3	\N	\N	t	t	f0f01098-109f-448c-ae15-ee4e785877d1	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.404075+00	2026-11-22 19:25:25.404075+00
4bcaa8d4-cdb2-4378-8426-931f6ad7b3d9	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-PROD-003	Granulation Procedure	SOP	78e7ee0c-c7ad-4618-b245-6f9fe8475998	\N	\N	\N	PUBLIC_INTERNAL	PROD Document Control Room, Rack 5	\N	\N	t	t	1bd1e255-24be-4120-a6f0-de8b5dfc02e2	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.407777+00	2026-11-22 19:25:25.407777+00
0389d220-dcaf-4567-b8d5-6f960d5aa720	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-PROD-004	Compression Procedure	SOP	78e7ee0c-c7ad-4618-b245-6f9fe8475998	\N	\N	\N	PUBLIC_INTERNAL	PROD Document Control Room, Rack 4	\N	\N	t	t	5605cb60-ef03-4e10-b68d-831aa4cfb37a	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.411346+00	2026-11-22 19:25:25.411346+00
02e252e5-1985-48fb-a8a5-0ddf58f2ca9e	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	BMR-PROD-010	Batch Manufacturing Record - Paracetamol 500mg	BMR	78e7ee0c-c7ad-4618-b245-6f9fe8475998	\N	\N	\N	PUBLIC_INTERNAL	PROD Document Control Room, Rack 4	\N	\N	t	t	3db6c412-cdb8-4773-8f77-dc5cc34215ce	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.414411+00	2026-11-22 19:25:25.414411+00
83bfe0c7-0aeb-415f-8ea1-6a839f030505	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	BPR-PKG-010	Batch Packaging Record - Paracetamol 500mg	BPR	ee3d43e7-af3b-4400-ab1e-1e29fbbca98b	\N	\N	\N	PUBLIC_INTERNAL	PKG Document Control Room, Rack 1	\N	\N	t	t	9895cfc5-de74-49a4-b329-2a910d11cf3a	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.418507+00	2026-11-22 19:25:25.418507+00
26f08fb3-1352-4f31-9c9d-150ebc1930aa	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-QC-001	Sample Management Procedure	SOP	2b58f69a-aadc-4eaf-ba65-43d4787e608c	\N	\N	\N	PUBLIC_INTERNAL	QC Document Control Room, Rack 1	\N	\N	t	t	de8eefe5-7384-44c6-bc18-8f78b18faa73	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.424974+00	2026-11-22 19:25:25.424974+00
f9ebb4e2-267b-476c-aed6-a958a55206b2	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-QC-002	HPLC Operation Procedure	EQUIPMENT_SOP	2b58f69a-aadc-4eaf-ba65-43d4787e608c	\N	\N	\N	PUBLIC_INTERNAL	QC Document Control Room, Rack 4	\N	\N	t	t	cd1d0e97-a631-4f26-982b-1d0544764153	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.429798+00	2026-11-22 19:25:25.429798+00
01ac47a2-938e-47bb-920a-f070711abf15	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	STP-QC-010	Standard Test Procedure - Paracetamol Assay	STP	2b58f69a-aadc-4eaf-ba65-43d4787e608c	\N	\N	\N	PUBLIC_INTERNAL	QC Document Control Room, Rack 4	\N	\N	t	t	3323c0bc-cd53-4913-9f6e-e229ddf53571	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.434886+00	2026-11-22 19:25:25.434886+00
d75449ab-e4a3-4a3a-8e9b-1e8b5beeca2f	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SPEC-QC-010	Specification - Paracetamol 500mg Tablets	SPECIFICATION	2b58f69a-aadc-4eaf-ba65-43d4787e608c	\N	\N	\N	PUBLIC_INTERNAL	QC Document Control Room, Rack 2	\N	\N	t	t	b794e79c-40c8-4491-997b-18a3ff6e03cb	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.441427+00	2026-11-22 19:25:25.441427+00
f9cb9f7f-bd17-49b6-9076-056f221e975b	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-WH-001	Raw Material Receipt Procedure	SOP	b77410e6-c454-4d01-9c0f-9cd40ccf8a52	\N	\N	\N	PUBLIC_INTERNAL	WH Document Control Room, Rack 1	\N	\N	t	t	66da6ef3-f8c5-4ad3-9b6d-f725c6f1ce74	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.446353+00	2026-11-22 19:25:25.446353+00
af8c0286-b618-43ba-8a4f-6e0b2c1d09cb	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-WH-002	Material Storage and Issuance Procedure	SOP	b77410e6-c454-4d01-9c0f-9cd40ccf8a52	\N	\N	\N	PUBLIC_INTERNAL	WH Document Control Room, Rack 2	\N	\N	t	t	532fc1ca-82d1-446e-8101-fe7793c964c9	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.452841+00	2026-11-22 19:25:25.452841+00
b451c18e-b128-45f9-944c-5e933656e9cb	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-ENG-001	Equipment Calibration Procedure	CALIBRATION_PROCEDURE	842573d4-d35e-46b1-93ad-c226a1ef3a45	\N	\N	\N	PUBLIC_INTERNAL	ENG Document Control Room, Rack 5	\N	\N	t	t	78ed117e-8867-4175-bace-dbac737930fd	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.458268+00	2026-11-22 19:25:25.458268+00
bd7f9da6-6a42-427e-9e77-95038429ab08	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-ENG-002	Preventive Maintenance Procedure	SOP	842573d4-d35e-46b1-93ad-c226a1ef3a45	\N	\N	\N	PUBLIC_INTERNAL	ENG Document Control Room, Rack 2	\N	\N	t	t	4f4f7d50-4a76-4be7-a424-56b574ce6cac	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.463036+00	2026-11-22 19:25:25.463036+00
dbfafb20-7a30-4ec0-b73c-5d54332107de	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-SAF-001	Personal Protective Equipment Procedure	SAFETY_PROCEDURE	78e7ee0c-c7ad-4618-b245-6f9fe8475998	\N	\N	\N	PUBLIC_INTERNAL	PROD Document Control Room, Rack 3	\N	\N	t	t	4271bf47-5fde-4fe4-b1e7-31812cee5605	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.468402+00	2026-11-22 19:25:25.468402+00
692b542f-830e-4491-8210-415e20fb108c	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	QM-QA-001	Quality Manual	QUALITY_MANUAL	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	\N	\N	\N	PUBLIC_INTERNAL	QA Document Control Room, Rack 4	\N	\N	t	t	7df02dd3-4a9c-4530-b46d-33f058a7c2ea	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.473712+00	2026-11-22 19:25:25.473712+00
c9aa200a-b305-430c-ac5f-cb1593304a6e	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	FMT-QA-010	Line Clearance Checklist	FORMAT_CHECKLIST	78e7ee0c-c7ad-4618-b245-6f9fe8475998	\N	\N	\N	PUBLIC_INTERNAL	PROD Document Control Room, Rack 3	\N	\N	t	t	22f429bb-e166-4bf3-9afe-df59dacd6bc2	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.479612+00	2026-11-22 19:25:25.479612+00
6d7cf7f9-ff24-4a73-ab02-46014a8eabff	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	WI-PKG-001	Blister Packing Work Instruction	WI	ee3d43e7-af3b-4400-ab1e-1e29fbbca98b	\N	\N	\N	PUBLIC_INTERNAL	PKG Document Control Room, Rack 5	\N	\N	t	t	d02084c9-a324-4a87-94b8-60e214dbd36f	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.483175+00	2026-11-22 19:25:25.483175+00
37411c3e-a864-4cd5-b353-0209bb06a8e2	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	SOP-PROD-001	Equipment Cleaning Procedure	CLEANING_PROCEDURE	78e7ee0c-c7ad-4618-b245-6f9fe8475998	\N	\N	\N	PUBLIC_INTERNAL	PROD Document Control Room, Rack 1	\N	\N	t	t	160b7afd-faee-400c-84b1-5cdbf33c2c1c	26b94886-0384-4bf2-910f-c85236ac072d	2026-11-22 19:25:25.396092+00	2026-11-22 19:25:25.396092+00
\.


--
-- Data for Name: integration_sync_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.integration_sync_logs (id, integration_id, started_at, finished_at, status, records_synced, error_message) FROM stdin;
\.


--
-- Data for Name: integrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.integrations (id, organization_id, provider_key, display_name, config_json, is_active, last_successful_sync_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, organization_id, user_id, kind, title, body, related_entity_type, related_entity_id, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (id, name, slug, created_at, updated_at) FROM stdin;
49644282-b8cd-40df-a5fd-e1828b31799d	Demo Pharma Laboratories Pvt Ltd	demo-pharma	2026-11-22 19:25:25.253622+00	2026-11-22 19:25:25.253622+00
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permissions (id, key, description) FROM stdin;
\.


--
-- Data for Name: print_approvals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.print_approvals (id, print_request_id, approver_user_id, decision, comments, decided_at) FROM stdin;
8bb7ee61-cc60-438d-bf97-4c64b4ea0a97	2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	8b180e7f-7388-445a-bc04-5370185c1006	APPROVED	Approved for Production Block A shift rollout.	2026-11-22 19:25:25.490979+00
1f6e9bb1-0d46-4fec-a54d-0efd3b8c2e4f	40f2949e-433b-4a01-be99-77617a57af85	8b180e7f-7388-445a-bc04-5370185c1006	APPROVED	\N	2026-11-22 19:32:31.671062+00
\.


--
-- Data for Name: print_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.print_requests (id, organization_id, document_id, document_revision_id, number_of_copies, requesting_user_id, department_id, destination_location, intended_purpose, reason_for_printing, printer, classification, review_due_date, status, requested_at, created_at, updated_at) FROM stdin;
2cfe2fe2-d617-4c88-a25f-1a848a92e2ab	49644282-b8cd-40df-a5fd-e1828b31799d	37411c3e-a864-4cd5-b353-0209bb06a8e2	6abdd19a-3b4b-4088-9fd1-872862ad4e05	5	74571048-fddf-4af7-b6d8-2cf1d3f004c3	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Production Block A	Line clearance and equipment cleaning reference	New shift copies required for Production Block A	QA-Printer-01	CONTROLLED	\N	ISSUED	2026-11-22 19:25:25.487539+00	2026-11-22 19:25:25.487539+00	2026-11-22 19:25:25.487539+00
e2337cfa-b403-47ac-9467-fec0f852dc2a	49644282-b8cd-40df-a5fd-e1828b31799d	f9ebb4e2-267b-476c-aed6-a958a55206b2	cd1d0e97-a631-4f26-982b-1d0544764153	2	74571048-fddf-4af7-b6d8-2cf1d3f004c3	2b58f69a-aadc-4eaf-ba65-43d4787e608c	QC Lab - HPLC Room	\N	New HPLC unit commissioning	\N	CONTROLLED	\N	REQUESTED	2026-11-22 19:25:25.804781+00	2026-11-22 19:25:25.804781+00	2026-11-22 19:25:25.804781+00
d6bf5207-0386-41a0-b8ed-60c101c7ea22	49644282-b8cd-40df-a5fd-e1828b31799d	f9cb9f7f-bd17-49b6-9076-056f221e975b	66da6ef3-f8c5-4ad3-9b6d-f725c6f1ce74	1	a4a130a1-eab1-431d-8360-252d6b93d4e9	b77410e6-c454-4d01-9c0f-9cd40ccf8a52	Warehouse Dock 2	\N	Dock reference copy	\N	CONTROLLED	\N	ISSUED	2026-11-22 19:25:25.806129+00	2026-11-22 19:25:25.806129+00	2026-11-22 19:25:25.806129+00
40f2949e-433b-4a01-be99-77617a57af85	49644282-b8cd-40df-a5fd-e1828b31799d	8b32bf8b-306b-4275-a204-f59f075541db	c7a07816-c7ab-49e7-8b0e-dfe3e3c7c006	2	74571048-fddf-4af7-b6d8-2cf1d3f004c3	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	QA Office	\N	API smoke test	\N	CONTROLLED	2027-06-01 00:00:00+00	ISSUED	2026-11-22 19:32:31.504872+00	2026-11-22 19:32:31.504872+00	2026-11-22 19:32:32.054+00
\.


--
-- Data for Name: recall_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recall_items (id, document_recall_id, controlled_copy_id, status, acknowledged_at, retrieved_at, escalated_at, notes, updated_at, destruction_due_at) FROM stdin;
e60e5901-1658-48e4-bb41-e1d9136e9b3c	62f55b21-60f3-42ba-b5b0-bb9f3e81416c	577a3eee-09e0-4f93-9b85-1a5657d7dd3c	DESTRUCTION_CONFIRMED	2026-11-22 19:25:25.785+00	2026-11-22 19:25:25.785+00	\N	\N	2026-11-22 19:25:25.77415+00	2026-11-29 19:25:25.773+00
61ff755c-ced8-403b-83da-f0c8db062964	62f55b21-60f3-42ba-b5b0-bb9f3e81416c	62e4f8c3-86ab-4afd-aedc-a82c79c4ceaa	DESTRUCTION_CONFIRMED	2026-11-22 19:25:25.79+00	2026-11-22 19:25:25.791+00	\N	\N	2026-11-22 19:25:25.776362+00	2026-11-29 19:25:25.773+00
ccb8bf01-f028-4ef0-b499-ee7570522c2c	62f55b21-60f3-42ba-b5b0-bb9f3e81416c	5130b993-6838-4db9-b57c-d2979a050fc2	DESTRUCTION_CONFIRMED	2026-11-22 19:25:25.795+00	2026-11-22 19:25:25.796+00	\N	\N	2026-11-22 19:25:25.778306+00	2026-11-29 19:25:25.773+00
5195f41b-3bfc-4b0c-ab2e-c1f34ff402ae	62f55b21-60f3-42ba-b5b0-bb9f3e81416c	cea6312e-9c80-4232-ba45-50eba7e42d2d	OUTSTANDING	\N	\N	2026-11-22 19:25:25.801+00	\N	2026-11-22 19:25:25.780322+00	2026-11-29 19:25:25.773+00
57cc380e-dc72-45f5-9a9a-c837e344db16	62f55b21-60f3-42ba-b5b0-bb9f3e81416c	97dca5a3-bb13-4530-a3a2-1b709a48dcff	OUTSTANDING	\N	\N	2026-11-22 19:25:25.803+00	\N	2026-11-22 19:25:25.782388+00	2026-11-29 19:25:25.773+00
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_permissions (id, role_id, permission_id) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, organization_id, name, description, created_at) FROM stdin;
4e6bfb2b-e0cf-405f-aa84-0fbbf87520a4	49644282-b8cd-40df-a5fd-e1828b31799d	SYSTEM_ADMIN	\N	2026-11-22 19:25:25.263918+00
ddb53825-94ff-404d-930f-b6eba650f233	49644282-b8cd-40df-a5fd-e1828b31799d	QA_HEAD	\N	2026-11-22 19:25:25.263918+00
4bfd77eb-8244-4b44-9cbf-baac717f735e	49644282-b8cd-40df-a5fd-e1828b31799d	DOCUMENT_CONTROLLER	\N	2026-11-22 19:25:25.263918+00
3fc92880-b104-4c3c-83df-dcf7c5909fa0	49644282-b8cd-40df-a5fd-e1828b31799d	QA_MANAGER	\N	2026-11-22 19:25:25.263918+00
6ec2213b-7909-4486-84b8-4127466c150d	49644282-b8cd-40df-a5fd-e1828b31799d	DEPARTMENT_HEAD	\N	2026-11-22 19:25:25.263918+00
6458d5b5-160a-49eb-bea3-6c72ab09ebbd	49644282-b8cd-40df-a5fd-e1828b31799d	EMPLOYEE	\N	2026-11-22 19:25:25.263918+00
a49dc51b-054f-4be4-add1-99119ca8024d	49644282-b8cd-40df-a5fd-e1828b31799d	AUDITOR	\N	2026-11-22 19:25:25.263918+00
\.


--
-- Data for Name: sites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sites (id, organization_id, name, code, address, is_active, created_at, updated_at) FROM stdin;
1c6432d1-2a75-4480-aa06-5761abe5b287	49644282-b8cd-40df-a5fd-e1828b31799d	Unit 1 - Visakhapatnam	UNIT1	\N	t	2026-11-22 19:25:25.259153+00	2026-11-22 19:25:25.259153+00
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role_id, created_at) FROM stdin;
3f60aaed-3532-4baf-82f9-cf9913a8910e	e5d2d1e1-10f1-41fe-812c-ece9e7cbe7b7	4e6bfb2b-e0cf-405f-aa84-0fbbf87520a4	2026-11-22 19:25:25.364495+00
4437565b-7d18-4a53-bd62-ddb7ba020f61	8b8667c6-1f1a-4d7f-b3b0-8b877957d75d	ddb53825-94ff-404d-930f-b6eba650f233	2026-11-22 19:25:25.367868+00
1c0e7311-e4a0-4120-adda-2543fecffba1	26b94886-0384-4bf2-910f-c85236ac072d	4bfd77eb-8244-4b44-9cbf-baac717f735e	2026-11-22 19:25:25.370431+00
c2491b84-c0c6-4279-a9a8-64ceeb1727b3	8b180e7f-7388-445a-bc04-5370185c1006	3fc92880-b104-4c3c-83df-dcf7c5909fa0	2026-11-22 19:25:25.371953+00
15c39210-e74a-451f-a1e9-a672a83d141a	a4a130a1-eab1-431d-8360-252d6b93d4e9	6ec2213b-7909-4486-84b8-4127466c150d	2026-11-22 19:25:25.373386+00
aed46299-077e-42e7-b432-cdf3dd385ea4	74571048-fddf-4af7-b6d8-2cf1d3f004c3	6458d5b5-160a-49eb-bea3-6c72ab09ebbd	2026-11-22 19:25:25.374728+00
150b636a-d8ed-49f5-975f-f7610ac1c815	d61aed21-2a51-44ab-91c1-95a17e9932cb	6458d5b5-160a-49eb-bea3-6c72ab09ebbd	2026-11-22 19:25:25.375958+00
5af8ae8b-4709-415b-b031-a346a9222fad	c44b70f8-d616-4247-9326-36e8d1d12de4	a49dc51b-054f-4be4-add1-99119ca8024d	2026-11-22 19:25:25.377217+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, organization_id, site_id, department_id, full_name, email, password_hash, employee_code, is_active, created_at, updated_at) FROM stdin;
e5d2d1e1-10f1-41fe-812c-ece9e7cbe7b7	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	\N	Sanjay Rao	admin@demo-pharma.local	$2a$10$t8X5IWMqWI5z70/Wb9dUueN8C9OSg0x3m3YaNrB1tZRezdH8q4Hpq	\N	t	2026-11-22 19:25:25.361363+00	2026-11-22 19:25:25.361363+00
8b8667c6-1f1a-4d7f-b3b0-8b877957d75d	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	Dr. Lakshmi Narayan	qa.head@demo-pharma.local	$2a$10$t8X5IWMqWI5z70/Wb9dUueN8C9OSg0x3m3YaNrB1tZRezdH8q4Hpq	\N	t	2026-11-22 19:25:25.366517+00	2026-11-22 19:25:25.366517+00
26b94886-0384-4bf2-910f-c85236ac072d	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	Priya Menon	doc.controller@demo-pharma.local	$2a$10$t8X5IWMqWI5z70/Wb9dUueN8C9OSg0x3m3YaNrB1tZRezdH8q4Hpq	\N	t	2026-11-22 19:25:25.369246+00	2026-11-22 19:25:25.369246+00
8b180e7f-7388-445a-bc04-5370185c1006	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	Arjun Reddy	qa.manager@demo-pharma.local	$2a$10$t8X5IWMqWI5z70/Wb9dUueN8C9OSg0x3m3YaNrB1tZRezdH8q4Hpq	\N	t	2026-11-22 19:25:25.371253+00	2026-11-22 19:25:25.371253+00
a4a130a1-eab1-431d-8360-252d6b93d4e9	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Suresh Kumar	production.head@demo-pharma.local	$2a$10$t8X5IWMqWI5z70/Wb9dUueN8C9OSg0x3m3YaNrB1tZRezdH8q4Hpq	\N	t	2026-11-22 19:25:25.372599+00	2026-11-22 19:25:25.372599+00
74571048-fddf-4af7-b6d8-2cf1d3f004c3	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	de6e13e3-145f-41ab-8fed-aaa3c93f7e6e	Deepa Varma	qa.executive@demo-pharma.local	$2a$10$t8X5IWMqWI5z70/Wb9dUueN8C9OSg0x3m3YaNrB1tZRezdH8q4Hpq	\N	t	2026-11-22 19:25:25.374072+00	2026-11-22 19:25:25.374072+00
d61aed21-2a51-44ab-91c1-95a17e9932cb	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	78e7ee0c-c7ad-4618-b245-6f9fe8475998	Ravi Teja	production.employee@demo-pharma.local	$2a$10$t8X5IWMqWI5z70/Wb9dUueN8C9OSg0x3m3YaNrB1tZRezdH8q4Hpq	\N	t	2026-11-22 19:25:25.375329+00	2026-11-22 19:25:25.375329+00
c44b70f8-d616-4247-9326-36e8d1d12de4	49644282-b8cd-40df-a5fd-e1828b31799d	1c6432d1-2a75-4480-aa06-5761abe5b287	\N	Nandini Iyer	auditor@demo-pharma.local	$2a$10$t8X5IWMqWI5z70/Wb9dUueN8C9OSg0x3m3YaNrB1tZRezdH8q4Hpq	\N	t	2026-11-22 19:25:25.376597+00	2026-11-22 19:25:25.376597+00
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: -
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 2, true);


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

\unrestrict lLTG2KDkgcGVtFL1IGdmEAeOxkO35LJmtcHcwm75cQhKXVI1TrbgVqv3njFuaAo

