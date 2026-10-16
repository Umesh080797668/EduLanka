-- =============================================================================
-- Migration: 20261016000001_phase3_period_and_blog_atomic_counts.sql
-- Description:
-- 1. Attendance Period Support:
--    - Adds `period` column (default 1) to `attendance` and `attendance_conflicts_log`.
--    - Upgrades uniqueness constraint from (tenant, class, student, date) to
--      (tenant, class, student, date, period) to prevent Period 2 from overwriting Period 1.
-- 2. Atomic Blog Comments Count:
--    - Database trigger and RPC to atomically update `comments_count` on `blogs`,
--      eliminating race-prone count-then-update queries in application logic.
-- =============================================================================

-- 1. Attendance Period Support
ALTER TABLE public.attendance
    ADD COLUMN IF NOT EXISTS period INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.attendance_conflicts_log
    ADD COLUMN IF NOT EXISTS period INTEGER NOT NULL DEFAULT 1;

-- Drop previous unique constraint if present
ALTER TABLE public.attendance
    DROP CONSTRAINT IF EXISTS uq_attendance_entry;

ALTER TABLE public.attendance
    DROP CONSTRAINT IF EXISTS uq_attendance_period_entry;

-- Add updated unique constraint including period
ALTER TABLE public.attendance
    ADD CONSTRAINT uq_attendance_period_entry
    UNIQUE (tenant_id, class_id, student_id, date, period);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date_period
    ON public.attendance (tenant_id, class_id, date, period)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_conflicts_period
    ON public.attendance_conflicts_log (tenant_id, conflict_date, period);


-- 2. Atomic Blog Comments Count (RPC + Trigger)
CREATE OR REPLACE FUNCTION public.increment_blog_comments_count(p_blog_id UUID, p_delta INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.blogs
    SET comments_count = GREATEST(0, comments_count + p_delta),
        updated_at = NOW()
    WHERE id = p_blog_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_blog_comments_count(UUID, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_sync_blog_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.deleted_at IS NULL THEN
            UPDATE public.blogs SET comments_count = comments_count + 1, updated_at = NOW() WHERE id = NEW.blog_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            UPDATE public.blogs SET comments_count = GREATEST(0, comments_count - 1), updated_at = NOW() WHERE id = NEW.blog_id;
        ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
            UPDATE public.blogs SET comments_count = comments_count + 1, updated_at = NOW() WHERE id = NEW.blog_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.deleted_at IS NULL THEN
            UPDATE public.blogs SET comments_count = GREATEST(0, comments_count - 1), updated_at = NOW() WHERE id = OLD.blog_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_blog_comments_count_sync ON public.blog_comments;
CREATE TRIGGER trg_blog_comments_count_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.blog_comments
    FOR EACH ROW EXECUTE FUNCTION public.trg_sync_blog_comments_count();

NOTIFY pgrst, 'reload schema';
