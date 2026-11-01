import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ source: vi.fn(), rates: vi.fn(), keys: [] as string[] }));
vi.mock('../src/pages/Commissions/services/commissionsService', () => ({ fetchCommissionSourceData: state.source }));
vi.mock('../src/features/commissionSettings/service', () => ({ fetchCommissionRates: state.rates }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: async (key: string, read: () => Promise<unknown>) => { state.keys.push(key); return { data: await read(), status: 'online' }; } }));
vi.mock('../src/lib/myBranches', () => ({ fetchMyBranches: async () => [] }));
vi.mock('../src/lib/branchHierarchy', () => ({ fetchUserSubtreeIdsBranchAware: async () => ['u'] }));
vi.mock('../src/lib/supabase', () => ({ supabaseUrl: '', supabaseAnonKey: '', supabase: {
  rpc: async () => ({ data: ['u'], error: null }),
  from: () => { const query = { select: () => query, in: () => query, eq: () => query, gte: () => query, lte: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve) }; return query; },
} }));
import { fetchProfilePerformanceStats } from '../src/pages/Profile/services/profileService';
import { computeCommissionRows, computeSummary } from '../src/pages/Commissions/business/commissionsCalculator';
const rates = [{ effective_from: '1900-01-01', year1_percent: 2.2, renewal_percent: 0.05 }, { effective_from: '2027-11-01', year1_percent: 3, renewal_percent: 0.1 }];
const policy = (start_date: string) => ({ id: start_date, policy_number: start_date, start_date, sum_assured: 100000, payment_method: 'annual', owner_id: 'u', branch_id: 'b', customer: { name: 'عميل' } });
beforeEach(() => { vi.resetAllMocks(); state.keys = []; vi.useFakeTimers(); vi.setSystemTime(new Date('2027-11-10T12:00:00Z')); state.rates.mockResolvedValue(rates); });
afterEach(() => vi.useRealTimers());
it('matches the commission page across old/new first-year cohorts and old renewal policies', async () => {
  const source = {
    year1Payments: ['2027-10-31', '2027-11-01'].map(date => ({ id: date, amount: 5000, paid_at: '2027-11-03T12:00:00Z', installment: { policy: policy(date) } })),
    year2Payments: [{ id: 'r', amount: 5000, payment_date: '2027-11-03', policy: policy('2026-10-31') }],
  };
  state.source.mockResolvedValue(source);
  const result = await fetchProfilePerformanceStats('u', 'agent');
  const expected = computeSummary(computeCommissionRows(source.year1Payments, source.year2Payments, '2027-11', rates).rows).totalMonth;
  expect(result.commissionsThisMonth).toBe(5250); expect(result.commissionsThisMonth).toBe(expected);
  expect(state.rates).toHaveBeenCalledOnce(); expect(state.keys[0]).toContain('commission-issue-v2');
});
it('retains the issue-date renewal percentage when a new cohort reaches its second year', async () => {
  vi.setSystemTime(new Date('2028-11-10T12:00:00Z'));
  state.source.mockResolvedValue({ year1Payments: [], year2Payments: [{ id: 'r', amount: 5000, payment_date: '2028-11-03', policy: policy('2027-11-01') }] });
  expect((await fetchProfilePerformanceStats('u', 'agent')).commissionsThisMonth).toBe(100);
});
it('does not manufacture a zero profile commission when schedule confirmation fails', async () => {
  state.source.mockResolvedValue({ year1Payments: [], year2Payments: [] }); state.rates.mockRejectedValue(new Error('offline'));
  await expect(fetchProfilePerformanceStats('u', 'agent')).rejects.toThrow();
});
