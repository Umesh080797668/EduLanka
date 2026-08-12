CREATE OR REPLACE FUNCTION public.get_global_tutorial_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_results JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'tutorialId', gt.id,
            'role', gt.role,
            'screenId', gt.screen_id,
            'completed', COALESCE(agg.completed_count, 0),
            'skipped', COALESCE(agg.skipped_count, 0),
            'eligible', COALESCE(agg.eligible_count, 0),
            'completionPercentage', CASE WHEN COALESCE(agg.eligible_count, 0) = 0 THEN 0 ELSE (COALESCE(agg.completed_count, 0)::FLOAT / agg.eligible_count * 100)::INT END
        )
    ) INTO v_results
    FROM public.tutorials gt
    LEFT JOIN (
        SELECT tutorial_id,
               COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_count,
               COUNT(*) FILTER (WHERE status = 'SKIPPED') as skipped_count,
               (SELECT COUNT(*) FROM public.users) as eligible_count
        FROM public.user_tutorials
        GROUP BY tutorial_id
    ) agg ON gt.id = agg.tutorial_id;

    RETURN COALESCE(v_results, '[]'::JSONB);
END;
$$;
NOTIFY pgrst, 'reload schema';
