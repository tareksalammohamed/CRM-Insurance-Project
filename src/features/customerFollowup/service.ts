import { supabase } from '../../lib/supabase';
import { dalRead, readStatusMessage } from '../../lib/dataAccessLayer';
import { fetchUserSubtreeIdsBranchAware } from '../../lib/branchHierarchy';
import { cairoToday, type FollowupRow } from './model';
export type FollowupFilter = 'due' | 'upcoming' | 'all';
export async function fetchFollowups(input: { userId: string; customerId?: string; branchId?: string | null; page: number; filter: FollowupFilter; policyId?: string; installmentId?: string }) {
  const result = await dalRead(`followups:v1:${JSON.stringify(input)}`, async () => {
    let query = supabase.from('customer_followup_status').select('*', { count: 'exact' });
    if (input.customerId) query = query.eq('customer_id', input.customerId);
    else if (input.branchId) {
      const owners = await fetchUserSubtreeIdsBranchAware('followups', input.userId, input.branchId);
      query = query.in('owner_id', owners).or(`branch_id.is.null,branch_id.eq.${input.branchId}`);
    }
    if (input.policyId) query = query.eq('policy_id', input.policyId);
    if (input.installmentId) query = query.eq('installment_id', input.installmentId);
    if (input.filter === 'due') query = query.is('closed_at', null).lte('next_date', cairoToday()).in('followup_status', ['today', 'overdue']);
    if (input.filter === 'upcoming') query = query.is('closed_at', null).gt('next_date', cairoToday()).eq('followup_status', 'upcoming');
    query = input.filter === 'all' ? query.order('created_at', { ascending: false }) : query.order('next_date');
    const { data, error, count } = await query.order('id').range((input.page - 1) * 10, input.page * 10 - 1);
    if (error) throw error;
    return { rows: (data || []) as FollowupRow[], total: count || 0 };
  }, { emptyValue: { rows: [] as FollowupRow[], total: 0 } });
  return { ...result.data, message: readStatusMessage(result), status: result.status };
}
export type FollowupInsert = {
  id: string; customer_id: string; kind: 'contact' | 'promise'; outcome: string; notes: string;
  next_action: string | null; next_date: string | null; policy_id: string | null;
  installment_id: string | null; payment_month: string | null;
};
export async function saveFollowup(row: FollowupInsert): Promise<void> {
  const { error } = await supabase.from('customer_followups').insert(row);
  if (!error) return;
  // A retry after a lost acknowledgement must not create a second record.
  const { data, error: readError } = await supabase.from('customer_followups').select('*').eq('id', row.id).maybeSingle();
  if (!readError && data && Object.entries(row).every(([key, value]) => data[key] === value)) return;
  if (error.code === '23505') {
    throw new Error('يوجد وعد مفتوح لهذا القسط أو شهر التحصيل. راجعه في السجل، وأغلقه مع توضيح السبب قبل تسجيل موعد جديد.');
  }
  throw error;
}
export async function closeFollowup(id: string, note: string): Promise<void> {
  if (!note.trim() || note.trim().length > 500) throw new Error('اكتب نتيجة المتابعة أو سبب إغلاق الوعد بحد أقصى ٥٠٠ حرف.');
  const { data, error } = await supabase.from('customer_followups').update({ close_note: note.trim() }).eq('id', id).is('closed_at', null).select('id');
  if (!error && data?.length) return;
  const existing = await supabase.from('customer_followups').select('closed_at,close_note').eq('id', id).maybeSingle();
  if (!existing.error && existing.data?.closed_at && existing.data.close_note === note.trim()) return;
  if (error) throw error;
  throw new Error('المتابعة أُغلقت بالفعل أو لم تعد لديك صلاحية تعديلها. حدّث السجل.');
}
