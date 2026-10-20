-- =============================================================================
-- Migration: 20261020000003_independent_learners_and_sponsored_growth.sql
-- Description:
-- 1. Makes tenant_id nullable on public.users to support Independent Learners.
-- 2. Creates public.independent_learners table for out-of-school students,
--    private O/L & A/L candidates, with Free, Pro, and Premium plans.
-- 3. Creates public.sponsorship_pools, public.sponsored_grants, and
--    public.sponsored_grant_events to operationalize EduLanka Sponsored Growth.
-- =============================================================================

-- 1. Allow independent users without a school tenant_id
ALTER TABLE public.users ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. INDEPENDENT LEARNERS TABLE
CREATE TABLE IF NOT EXISTS public.independent_learners (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    learner_type        TEXT            NOT NULL DEFAULT 'OUT_OF_SCHOOL' CHECK (learner_type IN ('OUT_OF_SCHOOL', 'PRIVATE_CANDIDATE', 'GENERAL')),
    candidate_level     TEXT            CHECK (candidate_level IN ('OL', 'AL', 'OTHER')),
    exam_year           INTEGER,
    exam_index_number   TEXT,
    stream              TEXT,           -- 'SCIENCE', 'COMMERCE', 'ARTS', 'TECH', etc.
    plan                TEXT            NOT NULL DEFAULT 'FREE_INDIVIDUAL' CHECK (plan IN ('FREE_INDIVIDUAL', 'INDIVIDUAL_PRO', 'INDIVIDUAL_PREMIUM')),
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.independent_learners ENABLE ROW LEVEL SECURITY;

-- Learners can view & edit their own record
DROP POLICY IF EXISTS "independent_learners_owner" ON public.independent_learners;
CREATE POLICY "independent_learners_owner" ON public.independent_learners
    USING (user_id::TEXT = current_setting('request.jwt.claim.sub', true))
    WITH CHECK (user_id::TEXT = current_setting('request.jwt.claim.sub', true));

-- 3. SPONSORSHIP POOLS (tracks net profit pool allocations)
CREATE TABLE IF NOT EXISTS public.sponsorship_pools (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    period_month        DATE            NOT NULL,
    net_profit_lkr      NUMERIC(12,2)   NOT NULL DEFAULT 0,
    pool_fraction       NUMERIC(5,4)    NOT NULL DEFAULT 0.10,
    pool_amount_lkr     NUMERIC(12,2)   NOT NULL DEFAULT 0,
    remaining_lkr       NUMERIC(12,2)   NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sponsorship_pools ENABLE ROW LEVEL SECURITY;

-- 4. SPONSORED GRANTS (school-level and learner-level grants)
CREATE TABLE IF NOT EXISTS public.sponsored_grants (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id             UUID            REFERENCES public.sponsorship_pools(id) ON DELETE SET NULL,
    beneficiary_type    TEXT            NOT NULL CHECK (beneficiary_type IN ('SCHOOL', 'INDEPENDENT_LEARNER')),
    beneficiary_id      UUID            NOT NULL,
    from_plan           TEXT            NOT NULL,
    to_plan             TEXT            NOT NULL,
    granted_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ     NOT NULL,
    granted_by          UUID            REFERENCES public.users(id) ON DELETE SET NULL,
    estimated_cost_lkr  NUMERIC(12,2)   DEFAULT 0,
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    notes               TEXT
);

ALTER TABLE public.sponsored_grants ENABLE ROW LEVEL SECURITY;

-- Beneficiaries can check their own grant status
DROP POLICY IF EXISTS "beneficiary_read_grants" ON public.sponsored_grants;
CREATE POLICY "beneficiary_read_grants" ON public.sponsored_grants
    FOR SELECT
    USING (
        (beneficiary_type = 'SCHOOL' AND beneficiary_id::TEXT = current_setting('request.jwt.claim.tenantId', true))
        OR
        (beneficiary_type = 'INDEPENDENT_LEARNER' AND beneficiary_id IN (
            SELECT id FROM public.independent_learners WHERE user_id::TEXT = current_setting('request.jwt.claim.sub', true)
        ))
    );

-- 5. SPONSORED GRANT EVENTS (immutable audit log)
CREATE TABLE IF NOT EXISTS public.sponsored_grant_events (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id            UUID            NOT NULL REFERENCES public.sponsored_grants(id) ON DELETE CASCADE,
    event_type          TEXT            NOT NULL CHECK (event_type IN ('GRANTED', 'EXPIRY_WARNING', 'EXPIRED', 'MANUAL_REVOKED')),
    actor_id            UUID            REFERENCES public.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    metadata            JSONB           NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.sponsored_grant_events ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_independent_learners_user ON public.independent_learners(user_id);
CREATE INDEX IF NOT EXISTS idx_independent_learners_exam ON public.independent_learners(candidate_level, exam_year);
CREATE INDEX IF NOT EXISTS idx_sponsored_grants_beneficiary ON public.sponsored_grants(beneficiary_type, beneficiary_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sponsored_grants_expiry ON public.sponsored_grants(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sponsored_grant_events_grant ON public.sponsored_grant_events(grant_id);
