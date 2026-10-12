-- =============================================================================
-- Migration: 20261012000000_phase3_content_and_mobile.sql
-- Description:
-- Phase 3 Content & Mobile Entities:
-- 1. public.mobile_app_versions — App versioning and release gates (P3-S1)
-- 2. public.homework_tasks & public.homework_submissions — Offline homework (P3-S3)
-- 3. public.media_assets — Video & media asset hub with quota tracking (P3-S5, P3-S6)
-- 4. public.papers — Past Paper Hub with paired marking schemes (P3-S7)
-- 5. public.school_emergency_contacts & public.school_shelters — Disaster readiness (P3-S8)
-- =============================================================================

-- 1. Mobile App Versioning & Release Controls
CREATE TABLE IF NOT EXISTS public.mobile_app_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_version     TEXT NOT NULL DEFAULT '1.0.0',
    latest_version  TEXT NOT NULL DEFAULT '1.0.0',
    release_notes   TEXT NOT NULL DEFAULT 'EduLanka Phase 3 Mobile Release',
    force_update    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mobile_app_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobile_app_versions FROM anon, authenticated;
GRANT ALL ON public.mobile_app_versions TO service_role;

-- Seed initial mobile version record
INSERT INTO public.mobile_app_versions (id, min_version, latest_version, release_notes, force_update)
VALUES ('00000000-0000-0000-0000-000000000001', '1.0.0', '1.0.0', 'EduLanka Phase 3 Mobile Initial Release', false)
ON CONFLICT (id) DO NOTHING;


-- 2. Homework Tasks and Submissions
CREATE TABLE IF NOT EXISTS public.homework_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id        UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    due_date        TIMESTAMPTZ NOT NULL,
    attachments     JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homework_tasks_tenant_class ON public.homework_tasks (tenant_id, class_id);

ALTER TABLE public.homework_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.homework_tasks FROM anon, authenticated;
GRANT ALL ON public.homework_tasks TO service_role;

CREATE TABLE IF NOT EXISTS public.homework_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    homework_id     UUID NOT NULL REFERENCES public.homework_tasks(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content         TEXT,
    attachments     JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'GRADED', 'RESUBMIT_REQUESTED')),
    grade           TEXT,
    feedback        TEXT,
    client_uuid     TEXT UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_homework_submission UNIQUE (tenant_id, homework_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_tenant_student ON public.homework_submissions (tenant_id, student_id);

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.homework_submissions FROM anon, authenticated;
GRANT ALL ON public.homework_submissions TO service_role;


-- 3. Media Assets Hub (Cloudinary streaming & offline MP4)
CREATE TABLE IF NOT EXISTS public.media_assets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    uploaded_by             UUID NOT NULL REFERENCES public.users(id),
    title                   TEXT NOT NULL,
    description             TEXT,
    cloudinary_public_id    TEXT NOT NULL UNIQUE,
    cloudinary_secure_url   TEXT NOT NULL,
    hls_url                 TEXT,
    mp4_url                 TEXT,
    duration_seconds        INTEGER,
    file_size_bytes         BIGINT NOT NULL DEFAULT 0,
    status                  TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
    subject                 TEXT,
    grade_level             INTEGER CHECK (grade_level BETWEEN 1 AND 13),
    is_downloadable         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_tenant ON public.media_assets (tenant_id, status);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_assets FROM anon, authenticated;
GRANT ALL ON public.media_assets TO service_role;


-- 4. Paper Hub (National Exam & Term Test Papers + Paired Marking Schemes)
CREATE TABLE IF NOT EXISTS public.papers (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL = Global / National
    title                           TEXT NOT NULL,
    subject                         TEXT NOT NULL,
    grade_level                     INTEGER NOT NULL CHECK (grade_level BETWEEN 1 AND 13),
    exam_year                       INTEGER NOT NULL CHECK (exam_year BETWEEN 1990 AND 2040),
    exam_type                       TEXT NOT NULL CHECK (exam_type IN ('OL', 'AL', 'GRADE5_SCHOLARSHIP', 'TERM_TEST')),
    medium                          TEXT NOT NULL CHECK (medium IN ('sinhala', 'tamil', 'english')),
    paper_cloudinary_id             TEXT NOT NULL,
    paper_url                       TEXT NOT NULL,
    marking_scheme_cloudinary_id    TEXT,
    marking_scheme_url              TEXT,
    is_paired                       BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_by                     UUID REFERENCES public.users(id),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_papers_tenant_grade ON public.papers (tenant_id, grade_level, subject);
CREATE INDEX IF NOT EXISTS idx_papers_exam_year ON public.papers (exam_year, exam_type, medium);

ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.papers FROM anon, authenticated;
GRANT ALL ON public.papers TO service_role;


-- 5. School Emergency Contacts & Shelters (Disaster Readiness Pack)
CREATE TABLE IF NOT EXISTS public.school_emergency_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL,
    phone           TEXT NOT NULL,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_tenant ON public.school_emergency_contacts (tenant_id);

ALTER TABLE public.school_emergency_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_emergency_contacts FROM anon, authenticated;
GRANT ALL ON public.school_emergency_contacts TO service_role;

CREATE TABLE IF NOT EXISTS public.school_shelters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    address         TEXT NOT NULL,
    capacity        INTEGER,
    gps_lat         DECIMAL(9,6),
    gps_lng         DECIMAL(9,6),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shelters_tenant ON public.school_shelters (tenant_id);

ALTER TABLE public.school_shelters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_shelters FROM anon, authenticated;
GRANT ALL ON public.school_shelters TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
