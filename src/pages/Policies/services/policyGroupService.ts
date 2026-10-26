import { supabase, type Installment, type Policy } from '../../../lib/supabase';
import { freshDalRead } from '../../../lib/dataAccessLayer';
import { fetchAllRows } from '../../../lib/fetchAllRows';

export interface PolicyGroupData { policies: Policy[]; installments: Installment[] }

/** Same grouping key as policyGrouping; filters on the list do not truncate the workspace. */
export async function fetchPolicyGroup(seed: Policy, branchId: string | null): Promise<PolicyGroupData> {
  if (seed.policy_type !== 'protection_investment' || !seed.customer_id || !seed.owner_id || !seed.start_date) throw new Error('بيانات المجموعة غير مكتملة');
  const result = await freshDalRead(
    `policies:groupWorkspace:${seed.customer_id}:${seed.owner_id}:${seed.start_date}:${branchId ?? 'all'}`,
    async () => {
      const policies = await fetchAllRows((from, to) => {
        let query = supabase.from('policies').select('*, customer:customer_id(id,name,phone,national_id), owner:owner_id(id,name)', { count: 'exact' })
          .eq('policy_type', 'protection_investment').eq('customer_id', seed.customer_id)
          .eq('owner_id', seed.owner_id).eq('start_date', seed.start_date);
        if (branchId) query = query.eq('branch_id', branchId);
        return query.order('id').range(from, to);
      }) as Policy[];
      if (!policies.length) throw new Error('لم تعد وثائق المجموعة متاحة');
      const installments = await fetchAllRows((from, to) => supabase.from('installments').select('*', { count: 'exact' })
        .in('policy_id', policies.map(policy => policy.id)).order('id').range(from, to)) as Installment[];
      return { policies, installments };
    }, { emptyValue: { policies: [], installments: [] } },
  );
  return result.data;
}
