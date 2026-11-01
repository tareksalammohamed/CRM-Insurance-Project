import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ filters: [] as [string, string, unknown][], commissions: vi.fn() }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: async (_key: string, read: () => Promise<unknown>) => ({ data: await read(), status: 'online' }) }));
vi.mock('../src/features/commissionSettings/service', () => ({ fetchCommissionRates: async () => [{ effective_from: '1900-01-01', year1_percent: 2.2, renewal_percent: 0.05 }] }));
vi.mock('../src/lib/myBranches', () => ({ fetchMyBranches: async () => [] }));
vi.mock('../src/lib/branchHierarchy', () => ({ fetchUserSubtreeIdsBranchAware: async () => ['u'] }));
vi.mock('../src/pages/Commissions/services/commissionsService', () => ({ fetchCommissionSourceData: state.commissions }));
vi.mock('../src/lib/supabase', () => ({ supabaseUrl: '', supabaseAnonKey: '', supabase: {
  rpc: async () => ({ data: ['u'], error: null }),
  from: (table: string) => {
    const query = {
      select: () => query, in: () => query,
      eq: (key: string, value: unknown) => { state.filters.push([table, key, value]); return query; },
      gte: (key: string, value: unknown) => { state.filters.push([table, key, value]); return query; },
      lte: (key: string, value: unknown) => { state.filters.push([table, key, value]); return query; },
      then: (resolve: (value: object) => unknown) => Promise.resolve({ error: null, count: 0, data: table === 'closing_payments' ? [
        { amount: 100, payment_month: '2026-12-01', installment: { policy: { owner_id: 'u' } } },
        { amount: 20, payment_month: '2027-01-01', installment: { policy: { owner_id: 'u' } } },
      ] : [] }).then(resolve),
    }; return query;
  },
} }));
import { fetchProfilePerformanceStats } from '../src/pages/Profile/services/profileService';
afterEach(() => { vi.useRealTimers(); state.filters = []; vi.clearAllMocks(); });
it('shows an extended December first-year total in January while keeping year totals, issuance dates and commissions on their real calendar', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2027-01-01T12:00:00Z'));
  state.commissions.mockResolvedValue({ year1Payments: [], year2Payments: [] });
  const result = await fetchProfilePerformanceStats('u', 'agent', '2026-12-01');
  expect(result.monthTotalPaid).toBe(100); expect(result.yearTotalPaid).toBe(20);
  expect(state.filters).toContainEqual(['closing_payments', 'accounting_month', '2026-12-01']);
  expect(state.filters).toContainEqual(['policies', 'start_date', '2027-01-01']);
  expect(state.commissions.mock.calls[0][1].getFullYear()).toBe(2027);
  expect(state.commissions.mock.calls[0][1].getMonth()).toBe(0);
});
it('retains ordinary calendar month totals without an extension', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2027-01-01T12:00:00Z'));
  state.commissions.mockResolvedValue({ year1Payments: [], year2Payments: [] });
  const result = await fetchProfilePerformanceStats('u', 'agent');
  expect(result.monthTotalPaid).toBe(20); expect(result.yearTotalPaid).toBe(20);
});
