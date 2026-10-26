import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ calls: [] as { table: string; select: string; filters: unknown[][] }[] }));
vi.mock('../src/lib/dataAccessLayer', () => ({
  dalRead: async (_key: string, read: () => Promise<unknown>) => ({ data: await read() }),
  freshDalRead: async (_key: string, read: () => Promise<unknown>) => ({ data: await read() }),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: (table: string) => {
  const call = { table, select: '', filters: [] as unknown[][] };
  mocks.calls.push(call);
  const query = {
    select: (text: string) => { call.select = text; return query; },
    in: (...args: unknown[]) => { call.filters.push(args); return query; },
    eq: () => query, order: () => query,
    range: async () => ({ data: table === 'payments' ? [
      { payment_month: '2026-03-01', installment: { policy: { owner_id: 'u' } } },
      { payment_month: '2026-01-01', installment: { policy: { owner_id: 'u' } } },
    ] : [], error: null, count: table === 'payments' ? 2 : 0 }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
  }; return query;
} } }));
import { fetchFirstWorkMonthByOwnerIds } from '../src/pages/MonthlyClosing/services/monthlyClosingService';
import { fetchDashboardRawData } from '../src/pages/Dashboard/services/dashboardService';
beforeEach(() => { mocks.calls.length = 0; });
it('keeps the earliest work month while restricting historical reads to the relevant owners', async () => {
  const result = await fetchFirstWorkMonthByOwnerIds(['u']);
  expect(result.get('u')).toBe('2026-01-01');
  expect(mocks.calls.find(call => call.table === 'payments')?.filters).toContainEqual(['installment.policy.owner_id', ['u']]);
  expect(mocks.calls.find(call => call.table === 'year2_payments')?.filters).toContainEqual(['policy.owner_id', ['u']]);
});
it('restricts dashboard installments and payments to its existing owner scope before transferring rows', async () => {
  await fetchDashboardRawData(['u'], '2026-10-01');
  const installments = mocks.calls.find(call => call.table === 'installments')!;
  const payments = mocks.calls.find(call => call.table === 'payments')!;
  expect(installments.select).toContain('policy_id!inner');
  expect(installments.filters).toContainEqual(['policy.owner_id', ['u']]);
  expect(payments.select).toContain('installment_id!inner');
  expect(payments.filters).toContainEqual(['installment.policy.owner_id', ['u']]);
});
