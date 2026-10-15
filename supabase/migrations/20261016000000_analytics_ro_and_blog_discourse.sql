-- =============================================================================
-- Migration: 20261016000000_analytics_ro_and_blog_discourse.sql
-- Description:
-- 1. Fix analytics_ro permissions:
--    - Grant SELECT and RLS policy on public.tenant_storage_ledgers (enables security-invoker tenant_storage_usage).
--    - Revoke full-table SELECT on users and device_tokens, replace with least-privilege column grants.
-- 2. Educational Blog & Academic Discourse Engine (P3-S11):
--    - public.blogs: Class, School, and Platform wide educational articles.
--    - public.blog_comments: Threaded discussions and peer replies.
--    - public.blog_reactions: Academic reactions (Like, Helpful, Insightful, Heart).
-- =============================================================================

-- 1. Analytics Service Least Privilege & Storage Permissions
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'analytics_ro') THEN
        -- Grant on tenant_storage_ledgers for security-invoker view tenant_storage_usage
        GRANT SELECT ON public.tenant_storage_ledgers TO analytics_ro;

        -- Revoke broad full-table SELECT from analytics_ro on sensitive identity tables
        REVOKE SELECT ON public.users FROM analytics_ro;
        REVOKE SELECT ON public.device_tokens FROM analytics_ro;

        -- Apply column-level grants: strictly only fields required for student count & sync lag analytics
        GRANT SELECT (id, tenant_id, role, is_active) ON public.users TO analytics_ro;
        GRANT SELECT (id, tenant_id, last_seen_at, is_active) ON public.device_tokens TO analytics_ro;
    END IF;
END $$;

-- Explicit RLS policy on tenant_storage_ledgers for analytics_ro
DROP POLICY IF EXISTS "analytics_ro_select_tenant_storage_ledgers" ON public.tenant_storage_ledgers;
CREATE POLICY "analytics_ro_select_tenant_storage_ledgers" ON public.tenant_storage_ledgers
    FOR SELECT TO analytics_ro USING (true);

-- Vetted Master Teacher flag for Platform-Wide Educational Blogs (P3-S11)
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS is_master_teacher BOOLEAN NOT NULL DEFAULT FALSE;


-- 2. Educational Blogs Table (P3-S11)
CREATE TABLE IF NOT EXISTS public.blogs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL for PLATFORM scope
    class_id            UUID REFERENCES public.classes(id) ON DELETE SET NULL, -- NULL for SCHOOL/PLATFORM scope
    scope               TEXT NOT NULL CHECK (scope IN ('CLASS', 'SCHOOL', 'PLATFORM')),
    author_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    author_name         TEXT NOT NULL,
    author_role         TEXT NOT NULL DEFAULT 'TEACHER',
    title               TEXT NOT NULL,
    content_markdown    TEXT NOT NULL,
    cover_image_url     TEXT,
    attachments         JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    is_published        BOOLEAN NOT NULL DEFAULT true,
    is_pinned           BOOLEAN NOT NULL DEFAULT false,
    likes_count         INTEGER NOT NULL DEFAULT 0,
    comments_count      INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_blogs_scope_tenant ON public.blogs (scope, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blogs_class ON public.blogs (class_id) WHERE class_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blogs_author ON public.blogs (author_id);
CREATE INDEX IF NOT EXISTS idx_blogs_published_created ON public.blogs (is_published, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blogs FROM anon, authenticated;
GRANT ALL ON public.blogs TO service_role;
GRANT SELECT ON public.blogs TO authenticated;


-- 3. Blog Comments & Threaded Replies Table (P3-S11)
CREATE TABLE IF NOT EXISTS public.blog_comments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    blog_id             UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
    parent_id           UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE, -- Hierarchical reply tree
    author_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    author_name         TEXT NOT NULL,
    author_role         TEXT NOT NULL,
    content             TEXT NOT NULL,
    is_pinned           BOOLEAN NOT NULL DEFAULT false,
    is_hidden           BOOLEAN NOT NULL DEFAULT false,
    likes_count         INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_blog_comments_blog ON public.blog_comments (blog_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent ON public.blog_comments (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_comments_author ON public.blog_comments (author_id);

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_comments FROM anon, authenticated;
GRANT ALL ON public.blog_comments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.blog_comments TO authenticated;


-- 4. Blog & Comment Academic Reactions Table (P3-S11)
CREATE TABLE IF NOT EXISTS public.blog_reactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    blog_id             UUID REFERENCES public.blogs(id) ON DELETE CASCADE,
    comment_id          UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reaction_type       TEXT NOT NULL CHECK (reaction_type IN ('LIKE', 'HELPFUL', 'INSIGHTFUL', 'HEART')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_reaction_target CHECK (
        (blog_id IS NOT NULL AND comment_id IS NULL) OR
        (blog_id IS NULL AND comment_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_blog_reactions_post ON public.blog_reactions (user_id, blog_id, reaction_type) WHERE blog_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_blog_reactions_comment ON public.blog_reactions (user_id, comment_id, reaction_type) WHERE comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blog_reactions_blog ON public.blog_reactions (blog_id) WHERE blog_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_reactions_comment ON public.blog_reactions (comment_id) WHERE comment_id IS NOT NULL;

ALTER TABLE public.blog_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_reactions FROM anon, authenticated;
GRANT ALL ON public.blog_reactions TO service_role;
GRANT SELECT, INSERT, DELETE ON public.blog_reactions TO authenticated;


-- 5. RLS Policies for Blogs
DROP POLICY IF EXISTS "authenticated_select_blogs" ON public.blogs;
CREATE POLICY "authenticated_select_blogs" ON public.blogs FOR SELECT TO authenticated
USING (
    deleted_at IS NULL AND is_published = true AND (
        scope = 'PLATFORM'
        OR (
            scope = 'SCHOOL' AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        )
        OR (
            scope = 'CLASS' AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()) AND (
                -- Class teachers
                EXISTS (
                    SELECT 1 FROM public.teachers t
                    JOIN public.class_teachers ct ON ct.teacher_id = t.id
                    WHERE t.user_id = auth.uid() AND ct.class_id = blogs.class_id
                )
                -- Enrolled students
                OR EXISTS (
                    SELECT 1 FROM public.students s
                    WHERE s.user_id = auth.uid() AND s.class_id = blogs.class_id
                )
                -- School / Platform Admins
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND u.role IN ('SCHOOL_ADMIN', 'SUPER_ADMIN')
                )
            )
        )
    )
);

-- Blog authoring: Only teachers and administrators can insert/update/delete blogs
DROP POLICY IF EXISTS "teachers_and_admins_manage_blogs" ON public.blogs;
CREATE POLICY "teachers_and_admins_manage_blogs" ON public.blogs FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role IN ('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role IN ('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
    )
);


-- 6. RLS Policies for Blog Comments
DROP POLICY IF EXISTS "authenticated_select_blog_comments" ON public.blog_comments;
CREATE POLICY "authenticated_select_blog_comments" ON public.blog_comments FOR SELECT TO authenticated
USING (
    deleted_at IS NULL AND (
        is_hidden = false
        OR author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
        )
    )
    -- Enforce that caller has SELECT permission on the parent blog
    AND EXISTS (
        SELECT 1 FROM public.blogs b
        WHERE b.id = blog_comments.blog_id
    )
);

DROP POLICY IF EXISTS "authenticated_insert_blog_comments" ON public.blog_comments;
CREATE POLICY "authenticated_insert_blog_comments" ON public.blog_comments FOR INSERT TO authenticated
WITH CHECK (
    author_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.blogs b
        WHERE b.id = blog_comments.blog_id
    )
);

DROP POLICY IF EXISTS "authors_and_mods_manage_blog_comments" ON public.blog_comments;
CREATE POLICY "authors_and_mods_manage_blog_comments" ON public.blog_comments FOR UPDATE TO authenticated
USING (
    author_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.blogs b
        WHERE b.id = blog_comments.blog_id AND (
            b.author_id = auth.uid()
            OR (
                b.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
                AND EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND u.role IN ('SCHOOL_ADMIN', 'SUPER_ADMIN')
                )
            )
        )
    )
);


-- 7. RLS Policies for Blog Reactions
DROP POLICY IF EXISTS "authenticated_select_blog_reactions" ON public.blog_reactions;
CREATE POLICY "authenticated_select_blog_reactions" ON public.blog_reactions FOR SELECT TO authenticated
USING (
    (blog_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.blogs b WHERE b.id = blog_reactions.blog_id))
    OR
    (comment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.blog_comments bc WHERE bc.id = blog_reactions.comment_id))
);

DROP POLICY IF EXISTS "authenticated_manage_blog_reactions" ON public.blog_reactions;
CREATE POLICY "authenticated_manage_blog_reactions" ON public.blog_reactions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
    user_id = auth.uid()
    AND (
        (blog_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.blogs b WHERE b.id = blog_reactions.blog_id))
        OR
        (comment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.blog_comments bc WHERE bc.id = blog_reactions.comment_id))
    )
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
