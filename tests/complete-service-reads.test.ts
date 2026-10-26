import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, ranges: [] as [string, number][], failTable: '', failFrom: -1 }));
vi.mock('../src/lib/dataAccessLayer', () => ({ freshDalRead: async (_key: string, read: () => Promise<unknown>) => ({ data: await read(), status: 'online' }), dalRead: async (_key: string, read: () => Promise<unknown>) => ({ data: await read(), status: 'online' }), readStatusMessage: () => null }));
vi.mock('../src/lib/branchHierarchy', () => ({ fetchUserSubtreeIdsBranchAware: async () => ['u'], fetchBranchRoleMap: async () => new Map() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: (table: string) => {
  const q = {
    select: (_fields: string, options: { count?: string }) => { expect(options?.count).toBe('exact'); return q; },
    in: () => q, eq: () => q, gte: () => q, lte: () => q, not: () => q, is: () => q, ilike: () => q, order: () => q,
    range: async (from: number, to: number) => {
      mocks.ranges.push([table, from]); const rows = mocks.rows[table] ?? [];
      return { data: rows.slice(from, Math.min(to + 1, from + 2)), count: rows.length, error: table === mocks.failTable && from === mocks.failFrom ? new Error('page failed') : null };
    },
  }; return q;
} } }));
import { fetchPoliciesForOwners, fetchPaymentsInRange, fetchAllInstallmentsWithPolicy } from '../src/pages/Reports/services/reportsService';
import { fetchAllCollectedInPeriod, fetchCancelledPoliciesInYear } from '../src/pages/Cancellations/services/cancellationService';
import { fetchPoliciesPage } from '../src/pages/Policies/services/policiesService';
import { fetchYear2EligiblePolicies } from '../src/pages/Collection/year2/year2CollectionService';
beforeEach(() => { mocks.rows = {}; mocks.ranges = []; mocks.failTable = ''; mocks.failFrom = -1; });
it('completes report policies, payments and installments when the server caps pages below the requested size', async () => {
  for (const table of ['policies', 'payments', 'installments']) mocks.rows[table] = [1, 2, 3].map(id => ({ id }));
  expect(await fetchPoliciesForOwners(['u'])).toHaveLength(3);
  expect(await fetchPaymentsInRange(new Date('2026-01-01'), new Date('2026-12-31'))).toHaveLength(3);
  expect(await fetchAllInstallmentsWithPolicy()).toHaveLength(3);
  expect(mocks.ranges).toEqual([['policies', 0], ['policies', 2], ['payments', 0], ['payments', 2], ['installments', 0], ['installments', 2]]);
});
it('never presents a report as complete after a later page fails', async () => {
  mocks.rows.payments = [1, 2, 3].map(id => ({ id })); mocks.failTable = 'payments'; mocks.failFrom = 2;
  await expect(fetchPaymentsInRange(new Date('2026-01-01'), new Date('2026-12-31'))).rejects.toThrow('page failed');
});
it('completes both cancellation collection sources and the cancelled document list', async () => {
  for (const table of ['policies', 'payments', 'year2_payments']) mocks.rows[table] = [1, 2, 3].map(id => ({ id, amount: id * 100 }));
  const collected = await fetchAllCollectedInPeriod('2026-01-01', '2026-12-31');
  expect(collected.year1Payments).toHaveLength(3); expect(collected.year2Payments).toHaveLength(3);
  expect(await fetchCancelledPoliciesInYear(['u'], new Date('2026-01-01'), new Date('2026-12-31'))).toHaveLength(3);
});
it('classifies renewal filters from every candidate and every payment page', async () => {
  const now = new Date(); const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  mocks.rows.policies = ['a', 'b', 'c'].map(id => ({ id, start_date: '2020-01-01' }));
  mocks.rows.year2_payments = ['a', 'b', 'c'].map((policy_id, i) => ({ id: i, policy_id, payment_month: month, amount: 100 }));
  const result = await fetchYear2EligiblePolicies({ page: 1, searchQuery: '', quickFilter: 'paid' });
  expect(result.totalCount).toBe(3); expect(result.policies.map(p => p.id)).toEqual(['a', 'b', 'c']);
  expect(result.policies.every(p => p.year2_total_paid === 100)).toBe(true);
});

it('keeps all grouped policy members together even when they cross server pages', async () => {
  mocks.rows.policies = ['a', 'b', 'c'].map(id => ({ id, policy_type: 'protection_investment', owner_id: 'u', customer_id: 'c', start_date: '2026-01-01' }));
  const result = await fetchPoliciesPage({ page: 1, searchQuery: '', statusFilter: 'all' });
  expect(result.totalCount).toBe(1); expect(result.policies.map(p => p.id)).toEqual(['a', 'b', 'c']);
});
