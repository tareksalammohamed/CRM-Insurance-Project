-- Persistent Job Center for user-visible long-running operations.
-- Browser-side jobs are truthful: stale running jobs become "interrupted"
-- instead of pretending to continue after the page/app was closed.

CREATE TABLE IF NOT EXISTS public.app_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','partial','failed','cancelled','interrupted')),
  stage text,
  message text,
  progress_current integer NOT NULL DEFAULT 0 CHECK (progress_current >= 0),
  progress_total integer NOT NULL DEFAULT 0 CHECK (progress_total >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_jobs_user_updated
  ON public.app_jobs(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_jobs_user_status
  ON public.app_jobs(user_id, status, updated_at DESC);

ALTER TABLE public.app_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_jobs_select_own ON public.app_jobs;
CREATE POLICY app_jobs_select_own
  ON public.app_jobs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS app_jobs_insert_own ON public.app_jobs;
CREATE POLICY app_jobs_insert_own
  ON public.app_jobs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS app_jobs_update_own ON public.app_jobs;
CREATE POLICY app_jobs_update_own
  ON public.app_jobs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS app_jobs_delete_own ON public.app_jobs;
CREATE POLICY app_jobs_delete_own
  ON public.app_jobs FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.app_jobs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_jobs TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_stale_app_jobs_interrupted(p_after_minutes integer DEFAULT 15)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.app_jobs
  SET
    status = 'interrupted',
    message = COALESCE(message, 'توقفت المهمة قبل اكتمالها. يمكنك الرجوع إلى الصفحة المرتبطة وإعادة المحاولة.'),
    completed_at = now(),
    updated_at = now()
  WHERE user_id = auth.uid()
    AND status IN ('queued','running')
    AND updated_at < now() - make_interval(mins => LEAST(GREATEST(COALESCE(p_after_minutes, 15), 5), 1440));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stale_app_jobs_interrupted(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_stale_app_jobs_interrupted(integer) TO authenticated, service_role;
