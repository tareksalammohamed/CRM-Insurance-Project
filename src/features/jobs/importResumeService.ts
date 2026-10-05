import { supabase } from '../../lib/supabase';
import type { ParsedRow } from '../../pages/DataImport/types';

const BUCKET = 'data-import-resume';

export type ImportCheckpointPhase =
  | 'uploaded'
  | 'extracting'
  | 'parsed'
  | 'importing'
  | 'completed'
  | 'partial'
  | 'failed';

export type ImportCheckpoint = {
  job_id: string;
  user_id: string;
  branch_id: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  file_fingerprint: string;
  document_kind: 'pdf' | 'image' | 'spreadsheet';
  phase: ImportCheckpointPhase;
  processed_pages: number;
  total_pages: number;
  parsed_rows: ParsedRow[];
  excluded_rows: number[];
  created_at: string;
  updated_at: string;
};

export async function fingerprintFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function safeExtension(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match?.[1] || 'bin';
}

export async function createImportCheckpoint(input: {
  jobId: string;
  userId: string;
  branchId: string | null;
  file: File;
  documentKind: 'pdf' | 'image' | 'spreadsheet';
}): Promise<ImportCheckpoint> {
  const fingerprint = await fingerprintFile(input.file);
  const ext = safeExtension(input.file.name);
  const filePath = `${input.userId}/${input.jobId}/source.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, input.file, {
      upsert: true,
      contentType: input.file.type || undefined,
      cacheControl: '3600',
    });
  if (uploadError) throw uploadError;

  const payload = {
    job_id: input.jobId,
    user_id: input.userId,
    branch_id: input.branchId,
    file_path: filePath,
    file_name: input.file.name,
    file_size: input.file.size,
    file_type: input.file.type || null,
    file_fingerprint: fingerprint,
    document_kind: input.documentKind,
    phase: 'uploaded',
    processed_pages: 0,
    total_pages: 0,
    parsed_rows: [],
    excluded_rows: [],
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('import_job_checkpoints')
    .upsert(payload, { onConflict: 'job_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as ImportCheckpoint;
}

export async function updateImportCheckpoint(
  jobId: string,
  patch: Partial<Pick<
    ImportCheckpoint,
    'phase' | 'processed_pages' | 'total_pages' | 'parsed_rows' | 'excluded_rows' | 'branch_id'
  >>
): Promise<void> {
  const { error } = await supabase
    .from('import_job_checkpoints')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId);
  if (error) throw error;
}

export async function getImportCheckpoint(jobId: string): Promise<ImportCheckpoint | null> {
  const { data, error } = await supabase
    .from('import_job_checkpoints')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();
  if (error) throw error;
  return data as ImportCheckpoint | null;
}

export async function downloadCheckpointFile(checkpoint: ImportCheckpoint): Promise<File> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(checkpoint.file_path);
  if (error) throw error;

  return new File([data], checkpoint.file_name, {
    type: checkpoint.file_type || data.type || 'application/octet-stream',
    lastModified: Date.now(),
  });
}

export async function getCompletedImportRowNumbers(jobId: string): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('import_job_completed_rows')
    .select('row_number')
    .eq('job_id', jobId);
  if (error) throw error;
  return new Set((data || []).map((row: { row_number: number }) => row.row_number));
}

export async function cleanupImportResumeData(jobId: string): Promise<void> {
  const checkpoint = await getImportCheckpoint(jobId);
  if (!checkpoint) return;

  // احذف الملف أولاً. لو الحذف فشل نُبقي الـCheckpoint كما هو حتى لا نفقد
  // القدرة على الاستكمال بينما يظل الملف موجوداً بلا مرجع.
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([checkpoint.file_path]);
  if (storageError) throw storageError;

  const { error: cleanupError } = await supabase.rpc('cleanup_import_resume_metadata', {
    p_job_id: jobId,
  });
  if (cleanupError) throw cleanupError;
}
