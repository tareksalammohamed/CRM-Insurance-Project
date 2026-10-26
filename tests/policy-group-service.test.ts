import { expect, it, vi } from 'vitest';
import type { Policy } from '../src/lib/supabase';
const mocks = vi.hoisted(() => ({ filters: [] as unknown[][], inValues: [] as unknown[][], tables: [] as string[] }));
vi.mock('../src/lib/dataAccessLayer', () => ({ freshDalRead: async (_key: string, read: () => Promise<unknown>) => ({ data: await read() }) }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: (table: string) => {
  mocks.tables.push(table);
  const query = {
    select: () => query, order: () => query,
    eq: (...args: unknown[]) => { mocks.filters.push(args); return query; },
    in: (...args: unknown[]) => { mocks.inValues.push(args); return query; },
    range: async () => ({ data: table === 'policies' ? [{ id: 'a' }, { id: 'b' }] : [{ policy_id: 'a', amount: 111 }, { policy_id: 'b', amount: 222 }], error: null, count: 2 }),
  };
  return query;
} } }));
import { fetchPolicyGroup } from '../src/pages/Policies/services/policyGroupService';
it('loads all members by the existing group key within the chosen branch, then only their installments', async () => {
  const seed = { policy_type: 'protection_investment', customer_id: 'c', owner_id: 'u', start_date: '2026-01-01' } as Policy;
  const result = await fetchPolicyGroup(seed, 'branch');
  expect(mocks.filters).toEqual([['policy_type', 'protection_investment'], ['customer_id', 'c'], ['owner_id', 'u'], ['start_date', '2026-01-01'], ['branch_id', 'branch']]);
  expect(mocks.inValues).toEqual([['policy_id', ['a', 'b']]]);
  expect(mocks.tables).toEqual(['policies', 'installments']);
  expect(result.installments.map(row => row.amount)).toEqual([111, 222]);
  await expect(fetchPolicyGroup({ ...seed, customer_id: '' }, null)).rejects.toThrow('بيانات المجموعة غير مكتملة');
});
