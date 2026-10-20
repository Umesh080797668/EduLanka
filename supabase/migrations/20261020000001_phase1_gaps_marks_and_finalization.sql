-- =============================================================================
-- Migration: 20261020000001_phase1_gaps_marks_and_finalization.sql
-- Description:
-- 1. Adds academic_year to public.student_marks and updates unique constraint
--    to (tenant_id, student_id, academic_year, term, subject).
-- 2. Creates public.term_finalizations table to store term finalization state,
--    locking marks edits once finalized until reopened by school admin.
-- 3. Adds min_plan column to public.tutorial_steps and seeds missing tutorials
--    for Phase 1 admin & system admin dashboard screens.
-- =============================================================================

-- 1. STUDENT MARKS ACADEMIC YEAR
ALTER TABLE public.student_marks
    ADD COLUMN IF NOT EXISTS academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

-- Drop old unique constraint if exists
ALTER TABLE public.student_marks
    DROP CONSTRAINT IF EXISTS student_marks_tenant_id_student_id_term_subject_key;

-- Add updated unique constraint including academic_year
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_marks_tenant_id_student_id_academic_year_term_subject_key'
    ) THEN
        ALTER TABLE public.student_marks
            ADD CONSTRAINT student_marks_tenant_id_student_id_academic_year_term_subject_key
            UNIQUE (tenant_id, student_id, academic_year, term, subject);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_marks_term_year_class
    ON public.student_marks (tenant_id, class_id, academic_year, term);

-- 2. TERM FINALIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.term_finalizations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id        UUID        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    academic_year   INTEGER     NOT NULL,
    term            INTEGER     NOT NULL,
    is_finalized    BOOLEAN     NOT NULL DEFAULT true,
    finalized_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_by    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reopened_at     TIMESTAMPTZ,
    reopened_by     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, class_id, academic_year, term)
);

ALTER TABLE public.term_finalizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_term_finalizations" ON public.term_finalizations;
CREATE POLICY "tenant_term_finalizations" ON public.term_finalizations
    USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));

CREATE INDEX IF NOT EXISTS idx_term_finalizations_lookup
    ON public.term_finalizations (tenant_id, class_id, academic_year, term);

-- 3. TUTORIAL STEPS MIN_PLAN
ALTER TABLE public.tutorial_steps
    ADD COLUMN IF NOT EXISTS min_plan TEXT DEFAULT 'COMMUNITY';

-- 4. SEED MISSING TUTORIALS FOR DASHBOARD SCREENS
INSERT INTO public.tutorials (id, role, screen_id)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'SCHOOL_ADMIN', 'admin_classes'),
    ('c0000000-0000-0000-0000-000000000002', 'SCHOOL_ADMIN', 'admin_classes_new'),
    ('c0000000-0000-0000-0000-000000000003', 'SCHOOL_ADMIN', 'admin_classes_detail'),
    ('c0000000-0000-0000-0000-000000000004', 'SCHOOL_ADMIN', 'admin_teachers'),
    ('c0000000-0000-0000-0000-000000000005', 'SCHOOL_ADMIN', 'admin_teachers_new'),
    ('c0000000-0000-0000-0000-000000000006', 'SCHOOL_ADMIN', 'admin_teachers_detail'),
    ('c0000000-0000-0000-0000-000000000007', 'SCHOOL_ADMIN', 'admin_parents'),
    ('c0000000-0000-0000-0000-000000000008', 'SCHOOL_ADMIN', 'admin_parents_new'),
    ('c0000000-0000-0000-0000-000000000009', 'SCHOOL_ADMIN', 'admin_parents_detail'),
    ('c0000000-0000-0000-0000-000000000010', 'SCHOOL_ADMIN', 'admin_students_new'),
    ('c0000000-0000-0000-0000-000000000011', 'SCHOOL_ADMIN', 'admin_students_detail'),
    ('c0000000-0000-0000-0000-000000000012', 'SCHOOL_ADMIN', 'admin_grades'),
    ('c0000000-0000-0000-0000-000000000013', 'SCHOOL_ADMIN', 'admin_inquiries'),
    ('c0000000-0000-0000-0000-000000000014', 'TEACHER', 'teacher_roster'),
    ('c0000000-0000-0000-0000-000000000015', 'TEACHER', 'profile'),
    ('c0000000-0000-0000-0000-000000000016', 'SUPER_ADMIN', 'sys_analytics'),
    ('c0000000-0000-0000-0000-000000000017', 'SUPER_ADMIN', 'sys_audit_logs'),
    ('c0000000-0000-0000-0000-000000000018', 'SUPER_ADMIN', 'sys_inquiries'),
    ('c0000000-0000-0000-0000-000000000019', 'SUPER_ADMIN', 'sys_maintenance'),
    ('c0000000-0000-0000-0000-000000000020', 'SUPER_ADMIN', 'sys_releases'),
    ('c0000000-0000-0000-0000-000000000021', 'SUPER_ADMIN', 'sys_sms'),
    ('c0000000-0000-0000-0000-000000000022', 'SUPER_ADMIN', 'sys_storage'),
    ('c0000000-0000-0000-0000-000000000023', 'SUPER_ADMIN', 'sys_tenants'),
    ('c0000000-0000-0000-0000-000000000024', 'SUPER_ADMIN', 'sys_tutorials'),
    ('c0000000-0000-0000-0000-000000000025', 'SUPER_ADMIN', 'sys_users'),
    ('c0000000-0000-0000-0000-000000000026', 'STUDENT', 'student_homework')
ON CONFLICT (role, screen_id) DO NOTHING;

-- Seed steps for a selection of core screens
INSERT INTO public.tutorial_steps (tutorial_id, step_order, target_element, min_plan, title_en, title_si, title_ta, content_en, content_si, content_ta)
VALUES
    -- Admin Classes
    ('c0000000-0000-0000-0000-000000000001', 1, NULL, 'COMMUNITY',
     'Class Management', 'පන්ති කළමනාකරණය', 'வகுப்பு மேலாண்மை',
     'Manage grade divisions, assigned homeroom teachers, and student rosters.',
     'ශ්‍රේණි අංශ, පන්තිභාර ගුරුවරුන් සහ ශිෂ්‍ය නාමලේඛන කළමනාකරණය කරන්න.',
     'வகுப்புப் பிரிவுகள், வகுப்பு ஆசிரியர்கள் மற்றும் மாணவர் பட்டியலை நிர்வகிக்கவும்.'),
    -- Admin Teachers
    ('c0000000-0000-0000-0000-000000000004', 1, NULL, 'COMMUNITY',
     'Faculty Directory', 'ගුරු නාමාවලිය', 'ஆசிரியர் விபரம்',
     'View, onboard, and assign teachers to classrooms and curriculum subjects.',
     'ගුරුවරුන් බලන්න, ලියාපදිංචි කරන්න සහ පන්ති/විෂයයන් සඳහා අනුයුක්ත කරන්න.',
     'ஆசிரியர்களைப் பார்க்கவும், சேர்க்கவும் மற்றும் வகுப்புகளுக்கு ஒதுக்கவும்.'),
    -- Teacher Roster
    ('c0000000-0000-0000-0000-000000000014', 1, NULL, 'COMMUNITY',
     'Class Roster & Attendance', 'පන්ති නාමලේඛනය සහ පැමිණීම', 'வகுப்பு பட்டியல் மற்றும் வருகை',
     'View students enrolled in this class, parent contacts, and daily attendance roll.',
     'මෙම පන්තියේ ලියාපදිංචි සිසුන්, දෙමාපිය සම්බන්ධතා සහ දෛනික පැමිණීම පරීක්ෂා කරන්න.',
     'வகுப்பில் பதிவுசெய்த மாணவர்கள், பெற்றோர் தொடர்பு மற்றும் தினசரி வருகையைக் காண்க.'),
    -- System Admin Analytics (Growth+)
    ('c0000000-0000-0000-0000-000000000016', 1, NULL, 'GROWTH',
     'Platform Analytics [Growth+]', 'පද්ධති විශ්ලේෂණ [Growth+]', 'தள பகுப்பாய்வு [Growth+]',
     'Monitor nationwide system utilization, active DAU/MAU metrics, and plan distribution.',
     'දීපව්‍යාප්ත පද්ධති භාවිතය, සක්‍රීය පරිශීලක දත්ත සහ සැලසුම් ව්‍යාප්තිය නිරීක්ෂණය කරන්න.',
     'நாடு தழுவிய கணினி பயன்பாடு மற்றும் செயலில் உள்ள பயனர் அளவீடுகளை கண்காணிக்கவும்.'),
    -- Student Homework Screen
    ('c0000000-0000-0000-0000-000000000026', 1, '#student_homework_tabs', 'COMMUNITY',
     'Assignment Tracker', 'පැවරුම් නිරීක්ෂකය', 'பணி கண்காணிப்பாளர்',
     'Switch between pending assignments, submitted work, and all class tasks.',
     'ඉතිරි පැවරුම්, ඉදිරිපත් කළ වැඩ සහ සියලුම පන්ති කාර්යයන් අතර මාරු වන්න.',
     'நிலுவையில் உள்ள பணிகள், சமர்ப்பிக்கப்பட்ட பணிகள் மற்றும் அனைத்து வகுப்பு பணிகளுக்கும் இடையில் மாறவும்.'),
    ('c0000000-0000-0000-0000-000000000026', 2, '#student_homework_search', 'COMMUNITY',
     'Search & Filter', 'සෙවීම සහ පෙරීම', 'தேடல் மற்றும் வடிகட்டுதல்',
     'Quickly locate specific assignments by keyword or filter by academic subject.',
     'මූල පද හෝ විෂයයන් අනුව පහසුවෙන් පැවරුම් සොයා ගන්න.',
     'முக்கிய சொல் அல்லது பாடத்தின் அடிப்படையில் பணிகளை எளிதாகக் கண்டறியவும்.'),
    ('c0000000-0000-0000-0000-000000000026', 3, NULL, 'COMMUNITY',
     'Submissions & Grades', 'ඉදිරිපත් කිරීම් සහ ලකුණු', 'சமர்ப்பிப்புகள் மற்றும் மதிப்பெண்கள்',
     'Attach completed homework files or solution links, submit your work, and review teacher marks and feedback.',
     'සම්පූර්ණ කරන ලද ගොනු හෝ සබැඳි අමුණා, ඔබගේ වැඩ ඉදිරිපත් කර ගුරු ප්‍රතිපෝෂණ සහ ලකුණු බලන්න.',
     'முடிந்த பணிக் கோப்புகள் அல்லது இணைப்புகளை இணைத்து, சமர்ப்பித்து, ஆசிரியரின் மதிப்பெண்கள் மற்றும் கருத்துக்களைப் பார்க்கவும்.')
ON CONFLICT (tutorial_id, step_order) DO NOTHING;

-- 5. STUDENT CAP ENFORCEMENT & ADVISORY LOCK (Eliminates Race Conditions & Reactivation Bypass)
CREATE OR REPLACE FUNCTION public.enforce_student_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_plan TEXT;
    v_active_count INTEGER;
BEGIN
    -- Per-tenant advisory xact lock to serialize concurrent student creations and prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext('student_cap_' || NEW.tenant_id::text));

    -- Lock the tenant row FOR NO KEY UPDATE so foreign key key-share locks are not blocked
    SELECT plan INTO v_plan 
    FROM public.tenants 
    WHERE id = NEW.tenant_id 
    FOR NO KEY UPDATE;

    -- Enforce student cap for COMMUNITY (75 active students per blueprint §7b)
    IF v_plan = 'COMMUNITY' THEN
        SELECT count(*) INTO v_active_count 
        FROM public.students s
        JOIN public.users u ON u.id = s.user_id
        WHERE s.tenant_id = NEW.tenant_id 
          AND u.is_active = TRUE 
          AND (TG_OP = 'INSERT' OR s.id != NEW.id);

        IF v_active_count >= 75 THEN
            RAISE EXCEPTION 'COMMUNITY tier limit exceeded: Maximum 75 active students allowed. Please upgrade to Starter.' 
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_cap_trigger ON public.students;
CREATE TRIGGER enforce_student_cap_trigger
    BEFORE INSERT OR UPDATE OF tenant_id, user_id ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_student_cap();

-- Trigger for user reactivation (users.is_active false -> true)
CREATE OR REPLACE FUNCTION public.enforce_user_reactivation_student_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_plan TEXT;
    v_active_count INTEGER;
BEGIN
    -- Only trigger when an inactive student user is being reactivated
    IF (OLD.is_active = FALSE AND NEW.is_active = TRUE AND NEW.role = 'STUDENT') THEN
        -- Take transaction advisory lock to serialize cap checks per tenant
        PERFORM pg_advisory_xact_lock(hashtext('student_cap_' || NEW.tenant_id::text));

        -- Lock the tenant row FOR NO KEY UPDATE so foreign key key-share locks are not blocked
        SELECT plan INTO v_plan 
        FROM public.tenants 
        WHERE id = NEW.tenant_id 
        FOR NO KEY UPDATE;

        IF v_plan = 'COMMUNITY' THEN
            SELECT count(*) INTO v_active_count 
            FROM public.students s
            JOIN public.users u ON u.id = s.user_id
            WHERE s.tenant_id = NEW.tenant_id 
              AND u.is_active = TRUE;

            IF v_active_count >= 75 THEN
                RAISE EXCEPTION 'COMMUNITY tier limit exceeded: Maximum 75 active students allowed. Please upgrade to Starter.' 
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_reactivation_student_cap ON public.users;
CREATE TRIGGER trg_user_reactivation_student_cap
    BEFORE UPDATE OF is_active ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_user_reactivation_student_cap();
