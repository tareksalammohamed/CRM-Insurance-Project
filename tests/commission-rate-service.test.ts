import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ source: vi.fn(), dal: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: state.source } }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: state.dal }));
import { fetchCommissionRates } from '../src/features/commissionSettings/service';
beforeEach(() => { vi.resetAllMocks(); state.dal.mockImplementation(async (_key, load) => ({ data: await load(), status: 'online' })); });
it('loads every schedule page for the page and profile', async () => {
  const ranges: number[] = [];
  state.source.mockImplementation(() => {
    let start = 0;
    const query = { select: () => query, order: () => query, range: (offset: number) => { start = offset; ranges.push(offset); return query; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: Array.from({ length: start === 0 ? 500 : 1 }, () => ({ effective_from: '2027-01-01', year1_percent: 3, renewal_percent: 0.1 })), error: null }).then(resolve) };
    return query;
  });
  expect(await fetchCommissionRates()).toHaveLength(501); expect(ranges).toEqual([0, 500]);
});
it.each(['offline-cache', 'error-cache', 'offline-empty', 'error'])('rejects an unconfirmed schedule rather than guessing percentages: %s', status => {
  state.dal.mockResolvedValue({ status, data: [{ effective_from: '1900-01-01', year1_percent: 2.2, renewal_percent: 0.05 }] });
  return expect(fetchCommissionRates()).rejects.toThrow('تعذر تأكيد');
});
it('rejects an empty schedule rather than quietly using baseline', async () => {
  state.dal.mockResolvedValue({ status: 'online', data: [] });
  await expect(fetchCommissionRates()).rejects.toThrow();
});
