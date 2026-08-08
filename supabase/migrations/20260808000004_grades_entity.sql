-- =============================================================================
-- Migration: 20260808000004_grades_entity.sql
-- Description: Implement a dedicated grades relational table and upgrade classes 
--              to reference it instead of a static SMALLINT constraint.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_sprint3_2_to_tenant(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_schema TEXT;
BEGIN
    v_schema := 'tenant_' || p_slug;

    -- 1. Check if grades table already exists for idempotency
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = v_schema AND table_name = 'grades'
    ) THEN
        RAISE NOTICE 'Skipping sprint 3.2 migration for %, grades already initialized.', p_slug;
        RETURN;
    END IF;

    -- 2. Create grades table
    EXECUTE format('
        CREATE TABLE %I.grades (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            level           SMALLINT    NOT NULL UNIQUE CHECK (level BETWEEN 1 AND 15),
            name            TEXT        NOT NULL UNIQUE,
            curriculum_type TEXT        NOT NULL DEFAULT ''GENERAL'',
            is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', v_schema);

    -- RLS for grades
    EXECUTE format('ALTER TABLE %I.grades ENABLE ROW LEVEL SECURITY', v_schema);
    
    BEGIN
        EXECUTE format('CREATE POLICY "service_role_all" ON %I.grades USING (true) WITH CHECK (true)', v_schema);
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        EXECUTE format('CREATE POLICY "auth_users_read_grades" ON %I.grades FOR SELECT USING (auth.role() = ''authenticated'')', v_schema);
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        EXECUTE format('CREATE TRIGGER grades_updated_at BEFORE UPDATE ON %I.grades FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    -- Seed generic Sri Lankan national curriculum grades
    EXECUTE format('
        INSERT INTO %I.grades (level, name, curriculum_type) VALUES 
        (1, ''Grade 1'', ''PRIMARY''),
        (2, ''Grade 2'', ''PRIMARY''),
        (3, ''Grade 3'', ''PRIMARY''),
        (4, ''Grade 4'', ''PRIMARY''),
        (5, ''Grade 5'', ''PRIMARY''),
        (6, ''Grade 6'', ''JUNIOR_SECONDARY''),
        (7, ''Grade 7'', ''JUNIOR_SECONDARY''),
        (8, ''Grade 8'', ''JUNIOR_SECONDARY''),
        (9, ''Grade 9'', ''JUNIOR_SECONDARY''),
        (10, ''Grade 10'', ''O_LEVEL''),
        (11, ''Grade 11'', ''O_LEVEL''),
        (12, ''Grade 12'', ''A_LEVEL''),
        (13, ''Grade 13'', ''A_LEVEL'');
    ', v_schema);

    -- 3. Prepare classes table for the migration
    -- We add the new column grade_id, migrate data based on the old smallint `grade` column, then drop the old one.
    EXECUTE format('ALTER TABLE %I.classes ADD COLUMN grade_id UUID REFERENCES %I.grades(id) ON DELETE RESTRICT', v_schema, v_schema);

    -- Migrate old data: find the grade with the identical level as the old integer
    EXECUTE format('
        UPDATE %I.classes c
        SET grade_id = g.id
        FROM %I.grades g
        WHERE c.grade = g.level;
    ', v_schema, v_schema);

    -- Enforce standard constraints
    EXECUTE format('ALTER TABLE %I.classes ALTER COLUMN grade_id SET NOT NULL', v_schema);

    -- Drop the old column safely
    EXECUTE format('ALTER TABLE %I.classes DROP COLUMN grade', v_schema);
    
    -- Rename unique constraints involving grade (drop old, add new)
    -- Old constraint name: classes_school_year_grade_section_key or similar
    EXECUTE format('ALTER TABLE %I.classes DROP CONSTRAINT IF EXISTS classes_school_year_grade_section_key', v_schema);
    EXECUTE format('ALTER TABLE %I.classes DROP CONSTRAINT IF EXISTS classes_year_grade_section_key', v_schema);
    EXECUTE format('ALTER TABLE %I.classes DROP CONSTRAINT IF EXISTS classes_grade_section_year_key', v_schema);
    EXECUTE format('ALTER TABLE %I.classes ADD CONSTRAINT classes_year_gradeid_section_key UNIQUE (year, grade_id, section)', v_schema);
    
    -- Add indexes
    EXECUTE format('CREATE INDEX idx_classes_grade_id ON %I.classes(grade_id)', v_schema);

    RAISE NOTICE 'Sprint 3.2 schema (Grade Entity) applied to tenant %', p_slug;
END;
$$;

-- Apply to all existing tenants
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT slug FROM public.tenants WHERE status = 'ACTIVE'
    LOOP
        PERFORM public.apply_sprint3_2_to_tenant(t.slug);
    END LOOP;
END;
$$;
