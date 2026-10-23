import { supabase } from '../../../lib/supabase';
import { dalRead, readStatusMessage } from '../../../lib/dataAccessLayer';
import { fetchUserSubtreeIds } from './reportsService';
import { computePerformanceTrend, trendMonths, type TrendPayment } from '../business/performanceTrend';

export async function fetchPerformanceTrend(userId: string, branchId: string | null, selectedUserId: string, now = new Date()) {
  const months = trendMonths(now);
  const start = `${months[0].month}-01`;
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;
  const result = await dalRead(`reports:trend:v1:${userId}:${branchId ?? 'none'}:${selectedUserId}:${start}`, async () => {
    const base = await fetchUserSubtreeIds(userId, branchId);
    const userIds = selectedUserId ? (await fetchUserSubtreeIds(selectedUserId, branchId)).filter(id => base.includes(id)) : base;
    const rows: TrendPayment[] = [];
    if (userIds.length) {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('payments')
          .select('id, amount, payment_month, installment:installment_id!inner(is_first, policy:policy_id!inner(owner_id))')
          .in('installment.policy.owner_id', userIds)
          .gte('payment_month', start).lt('payment_month', endKey)
          .eq('is_cancelled', false).order('id').range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data ?? []) as unknown as TrendPayment[]);
        if (!data || data.length < 500) break;
      }
    }
    return computePerformanceTrend(rows, userIds, now);
  }, { emptyValue: months });
  return { rows: result.data, status: result.status, message: readStatusMessage(result) };
}
