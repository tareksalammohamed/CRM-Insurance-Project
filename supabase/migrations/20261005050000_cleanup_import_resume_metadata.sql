CREATE OR REPLACE FUNCTION public.cleanup_import_resume_metadata(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_jobs
    WHERE id = p_job_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'مهمة الاستيراد غير موجودة أو غير مصرح بها';
  END IF;

  DELETE FROM public.import_job_completed_rows
  WHERE job_id = p_job_id;

  DELETE FROM public.import_job_checkpoints
  WHERE job_id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_import_resume_metadata(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_import_resume_metadata(uuid)
  TO authenticated, service_role;
