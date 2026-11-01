vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ filters: [] as [string, string, unknown][] }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: async (_key: string, read: () => Promise<unknown>) => ({ data: await read(), status: 'online' }), readStatusMessage: () => null }));
import { supabase } from '../src/lib/supabase';
import { fetchCollectionQuickStats } from '../src/pages/Collection/services/collectionService';
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); state.filters = []; });
it('holds first-year month totals while renewal and real daily receipts remain on the actual November calendar', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
  const policy = { status: 'active', branch_id: 'b', start_date: '2024-01-01' };
  const rows: Record<string, Record<string, unknown>[]> = {
    installments: [], policies: [],
    payments: [{ amount: 5, paid_at: '2026-11-01T10:00:00.000Z', is_cancelled: false, installment: { policy } }],
    closing_payments: [
      { amount: 100, accounting_month: '2026-10-01', is_cancelled: false, installment: { policy } },
      { amount: 20, accounting_month: '2026-11-01', is_cancelled: false, installment: { policy } },
    ],
    year2_payments: [
      { policy_id: 'a', amount: 300, payment_month: '2026-10-01', is_cancelled: false, policy },
      { policy_id: 'a', amount: 500, payment_month: '2026-11-01', is_cancelled: false, policy },
    ],
  };
  const read = (row: Record<string, unknown>, key: string): unknown => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], row);
  vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
    const checks: ((row: Record<string, unknown>) => boolean)[] = [];
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { state.filters.push([table, key, value]); checks.push(row => read(row, key) === value); return query; },
      gte: (key: string, value: string) => { state.filters.push([table, key, value]); checks.push(row => String(read(row, key)) >= value); return query; },
      lte: (key: string, value: string) => { state.filters.push([table, key, value]); checks.push(row => String(read(row, key)) <= value); return query; },
      then: (resolve: (value: object) => unknown) => Promise.resolve({ data: (rows[table] ?? []).filter(row => checks.every(check => check(row))), error: null }).then(resolve),
    }; return query as never;
  });
  const extended = await fetchCollectionQuickStats('b', '2026-10-01');
  expect(extended.collectedMonthAmount).toBe(100); expect(extended.collectedTodayAmount).toBe(5);
  expect(extended.year2CollectedMonthAmount).toBe(500); expect(extended.year2CollectedMonthCount).toBe(1);
  expect(state.filters).toContainEqual(['closing_payments', 'accounting_month', '2026-10-01']);
  expect(state.filters).toContainEqual(['payments', 'paid_at', '2026-11-01T00:00:00.000Z']);
  const ordinary = await fetchCollectionQuickStats('b');
  expect(ordinary.collectedMonthAmount).toBe(20);
  expect(ordinary.year2CollectedMonthAmount).toBe(extended.year2CollectedMonthAmount);
});
