import { supabase } from '../../lib/supabase';

export type AppJobStatus =
  | 'queued'
  | 'running'
  | 'ready'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export type AppJob = {
  id: string;
  user_id: string;
  branch_id: string | null;
  job_type: string;
  title: string;
  status: AppJobStatus;
  stage: string | null;
  message: string | null;
  progress_current: number;
  progress_total: number;
  metadata: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function createAppJob(input: {
  userId: string;
  branchId?: string | null;
  jobType: string;
  title: string;
  stage?: string | null;
  message?: string | null;
  progressTotal?: number;
  metadata?: Record<string, unknown>;
}): Promise<AppJob> {
  const { data, error } = await supabase
    .from('app_jobs')
    .insert({
      user_id: input.userId,
      branch_id: input.branchId ?? null,
      job_type: input.jobType,
      title: input.title,
      status: 'running',
      stage: input.stage ?? null,
      message: input.message ?? null,
      progress_current: 0,
      progress_total: input.progressTotal ?? 0,
      metadata: input.metadata ?? {},
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AppJob;
}

export async function updateAppJob(
  jobId: string,
  patch: Partial<Pick<
    AppJob,
    'status' | 'stage' | 'message' | 'progress_current' | 'progress_total' | 'metadata'
  >>
): Promise<void> {
  const terminal = patch.status && ['completed', 'partial', 'failed', 'cancelled', 'interrupted'].includes(patch.status);
  const { error } = await supabase
    .from('app_jobs')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
      ...(terminal
        ? { completed_at: new Date().toISOString() }
        : patch.status
          ? { completed_at: null }
          : {}),
    })
    .eq('id', jobId);

  if (error) throw error;
}

export async function finishAppJob(
  jobId: string,
  status: Extract<AppJobStatus, 'completed' | 'partial' | 'failed' | 'cancelled' | 'interrupted'>,
  message?: string,
  progressCurrent?: number,
  progressTotal?: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await updateAppJob(jobId, {
    status,
    message: message ?? null,
    ...(progressCurrent !== undefined ? { progress_current: progressCurrent } : {}),
    ...(progressTotal !== undefined ? { progress_total: progressTotal } : {}),
    ...(metadata ? { metadata } : {}),
  });
}

export async function listAppJobs(limit = 100): Promise<AppJob[]> {
  await supabase.rpc('mark_stale_app_jobs_interrupted', { p_after_minutes: 15 });

  const { data, error } = await supabase
    .from('app_jobs')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as AppJob[];
}

export async function deleteAppJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('app_jobs')
    .delete()
    .eq('id', jobId)
    .in('status', ['completed', 'partial', 'failed', 'cancelled', 'interrupted']);
  if (error) throw error;
}
