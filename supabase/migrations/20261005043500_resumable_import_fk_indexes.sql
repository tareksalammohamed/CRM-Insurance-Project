CREATE INDEX IF NOT EXISTS idx_app_jobs_branch_id
  ON public.app_jobs(branch_id);

CREATE INDEX IF NOT EXISTS idx_import_job_checkpoints_branch_id
  ON public.import_job_checkpoints(branch_id);
