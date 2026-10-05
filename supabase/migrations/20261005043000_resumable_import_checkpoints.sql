-- Durable, resumable data-import checkpoints and private source files.

CREATE TABLE IF NOT EXISTS public.import_job_checkpoints (
  job_id uuid PRIMARY KEY REFERENCES public.app_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text,
  file_fingerprint text NOT NULL,
  document_kind text CHECK (document_kind IN ('pdf','image','spreadsheet')),
  phase text NOT NULL DEFAULT 'uploaded'
    CHECK (phase IN ('uploaded','extracting','parsed','importing','completed','partial','failed')),
  processed_pages integer NOT NULL DEFAULT 0 CHECK (processed_pages >= 0),
  total_pages integer NOT NULL DEFAULT 0 CHECK (total_pages >= 0),
  parsed_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_rows integer[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_job_checkpoints_user_updated
  ON public.import_job_checkpoints(user_id, updated_at DESC);

ALTER TABLE public.import_job_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_job_checkpoints_select_own ON public.import_job_checkpoints;
CREATE POLICY import_job_checkpoints_select_own
  ON public.import_job_checkpoints FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS import_job_checkpoints_insert_own ON public.import_job_checkpoints;
CREATE POLICY import_job_checkpoints_insert_own
  ON public.import_job_checkpoints FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS import_job_checkpoints_update_own ON public.import_job_checkpoints;
CREATE POLICY import_job_checkpoints_update_own
  ON public.import_job_checkpoints FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS import_job_checkpoints_delete_own ON public.import_job_checkpoints;
CREATE POLICY import_job_checkpoints_delete_own
  ON public.import_job_checkpoints FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.import_job_checkpoints FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.import_job_checkpoints TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.import_job_completed_rows (
  job_id uuid NOT NULL REFERENCES public.app_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  policy_number text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_import_job_completed_rows_job
  ON public.import_job_completed_rows(job_id, row_number);

ALTER TABLE public.import_job_completed_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_job_completed_rows_select_own ON public.import_job_completed_rows;
CREATE POLICY import_job_completed_rows_select_own
  ON public.import_job_completed_rows FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.app_jobs j
    WHERE j.id = job_id AND j.user_id = (SELECT auth.uid())
  ));

REVOKE ALL ON TABLE public.import_job_completed_rows FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.import_job_completed_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.import_job_completed_rows TO service_role;

-- Private bucket for original import files. Objects are scoped by first path
-- segment = auth.uid(), so one user cannot read another user's resumable file.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('data-import-resume', 'data-import-resume', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

DROP POLICY IF EXISTS import_resume_storage_select_own ON storage.objects;
CREATE POLICY import_resume_storage_select_own
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'data-import-resume'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS import_resume_storage_insert_own ON storage.objects;
CREATE POLICY import_resume_storage_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'data-import-resume'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS import_resume_storage_update_own ON storage.objects;
CREATE POLICY import_resume_storage_update_own
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'data-import-resume'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'data-import-resume'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS import_resume_storage_delete_own ON storage.objects;
CREATE POLICY import_resume_storage_delete_own
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'data-import-resume'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Atomic wrapper: successful policy import and durable "row completed" marker
-- happen in the same DB transaction.
CREATE OR REPLACE FUNCTION public.import_policy_row_resumable(
  p_job_id uuid,
  p_row_number integer,
  p_payload jsonb,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.app_jobs
    WHERE id = p_job_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'مهمة الاستيراد غير موجودة أو غير مصرح بها';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.import_job_completed_rows
    WHERE job_id = p_job_id AND row_number = p_row_number
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  SELECT public.import_policy_row_v2(
    p_customer_name   => p_payload->>'p_customer_name',
    p_national_id     => NULLIF(p_payload->>'p_national_id',''),
    p_phone           => NULLIF(p_payload->>'p_phone',''),
    p_address         => NULLIF(p_payload->>'p_address',''),
    p_birth_date      => NULLIF(p_payload->>'p_birth_date','')::date,
    p_occupation      => NULLIF(p_payload->>'p_occupation',''),
    p_marital_status  => NULLIF(p_payload->>'p_marital_status',''),
    p_agent_name      => p_payload->>'p_agent_name',
    p_agent_id        => NULLIF(p_payload->>'p_agent_id','')::uuid,
    p_policy_number   => p_payload->>'p_policy_number',
    p_policy_type     => p_payload->>'p_policy_type',
    p_sum_assured     => (p_payload->>'p_sum_assured')::numeric,
    p_premium_amount  => (p_payload->>'p_premium_amount')::numeric,
    p_payment_method  => p_payload->>'p_payment_method',
    p_start_date      => (p_payload->>'p_start_date')::date,
    p_notes           => NULLIF(p_payload->>'p_notes',''),
    p_branch_id       => p_branch_id
  ) INTO v_result;

  INSERT INTO public.import_job_completed_rows(job_id, row_number, policy_number)
  VALUES (p_job_id, p_row_number, p_payload->>'p_policy_number')
  ON CONFLICT (job_id, row_number) DO NOTHING;

  RETURN COALESCE(v_result, '{}'::jsonb) || jsonb_build_object('success', true, 'already_completed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.import_policy_row_resumable(uuid,integer,jsonb,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_policy_row_resumable(uuid,integer,jsonb,uuid)
  TO authenticated, service_role;
