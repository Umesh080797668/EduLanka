-- =============================================================================
-- Migration: 20261017000000_platform_blog_safeguards_and_cleanup.sql
-- Description:
-- 1. Drops is_master_teacher from teachers (removes legacy vetted master teacher requirement)
-- 2. Adds school_name, reporting and takedown columns to blogs
-- 3. Backfills tenant_id and school_name on existing blogs from authors/tenants
-- 4. Creates blog_reports table for community reporting & administrative takedowns
-- =============================================================================

-- 1. Drop is_master_teacher from teachers
ALTER TABLE public.teachers DROP COLUMN IF EXISTS is_master_teacher;

-- 2. Add school_name, reporting and takedown columns to blogs
ALTER TABLE public.blogs
    ADD COLUMN IF NOT EXISTS school_name TEXT,
    ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_taken_down BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS taken_down_reason TEXT,
    ADD COLUMN IF NOT EXISTS taken_down_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Backfill tenant_id on existing blogs where tenant_id IS NULL
UPDATE public.blogs b
SET tenant_id = u.tenant_id
FROM public.users u
WHERE b.author_id = u.id AND b.tenant_id IS NULL AND u.tenant_id IS NOT NULL;

-- 4. Backfill school_name from tenants table
UPDATE public.blogs b
SET school_name = t.name
FROM public.tenants t
WHERE b.tenant_id = t.id AND (b.school_name IS NULL OR b.school_name = '');

-- 5. Create blog_reports table for reporting offensive content
CREATE TABLE IF NOT EXISTS public.blog_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blog_id     UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_reports_blog ON public.blog_reports (blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_reports_tenant ON public.blog_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_blogs_author_created ON public.blogs (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blogs_flagged_taken_down ON public.blogs (is_flagged, is_taken_down) WHERE deleted_at IS NULL;

ALTER TABLE public.blog_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_reports FROM anon, authenticated;
GRANT ALL ON public.blog_reports TO service_role;
GRANT SELECT, INSERT ON public.blog_reports TO authenticated;
