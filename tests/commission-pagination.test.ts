import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ filters: [] as unknown[][], pages: [] as unknown[][], selects: [] as string[], keys: [] as string[] }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: async (key: string, load: () => Promise<unknown>) => { mocks.keys.push(key); return { data: await load(), status: 'online' }; }, readStatusMessage: () => null }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: (table: string) => {
  let start = 0;
  const builder = {
    select: (columns: string) => { mocks.selects.push(columns); return builder; },
    eq: (column: string, value: string) => { mocks.filters.push([table, column, value]); return builder; },
    gte: () => builder, lte: () => builder, order: () => builder,
    range: (offset: number, end: number) => { start = offset; mocks.pages.push([table, offset, end]); return builder; },
    then: (resolve: (result: unknown) => void) => resolve({ error: null, data: Array.from({ length: table === 'payments' ? Math.max(0, Math.min(500, 1001 - start)) : 0 }, (_, i) => ({ id: `${start + i}` })) }),
  };
  return builder;
} } }));
import { fetchCommissionSourceData } from '../src/pages/Commissions/services/commissionsService';
it('filters ownership and branch before paging through every matching payment', async () => {
  const result = await fetchCommissionSourceData('owner', new Date(2026, 10, 1), 'branch');
  expect(result.year1Payments).toHaveLength(1001);
  expect(mocks.selects.every(columns => columns.includes('start_date'))).toBe(true);
  expect(mocks.keys[0]).toContain('commissions:source:policy-issue-v2:');
  expect(mocks.filters).toContainEqual(['payments', 'installment.policy.owner_id', 'owner']);
  expect(mocks.filters).toContainEqual(['payments', 'installment.policy.branch_id', 'branch']);
  expect(mocks.filters).toContainEqual(['year2_payments', 'policy.owner_id', 'owner']);
  expect(mocks.pages.filter(p => p[0] === 'payments').map(p => p[1])).toEqual([0, 500, 1000]);
});
