import { expect, it } from 'vitest';
import { fetchAllRows } from '../src/lib/fetchAllRows';

it('reads beyond a server cap smaller than the requested page without dropping rows', async () => {
  const rows = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const result = await fetchAllRows(async from => ({ data: rows.slice(from, from + 200), error: null, count: rows.length }));
  expect(result).toEqual(rows);
});
it('rejects a failed page, missing totals, or changing totals instead of publishing partial data', async () => {
  await expect(fetchAllRows(async () => ({ data: [], error: null, count: 2 }))).rejects.toThrow();
  await expect(fetchAllRows(async () => ({ data: [], error: null, count: null }))).rejects.toThrow();
  await expect(fetchAllRows(async from => ({ data: [{ id: from }], error: null, count: from ? 3 : 2 }))).rejects.toThrow();
  await expect(fetchAllRows(async from => ({ data: from ? null : [{ id: 1 }], error: from ? new Error('page failed') : null, count: 2 }))).rejects.toThrow('page failed');
});
it('accepts a genuinely empty successful read', async () => {
  expect(await fetchAllRows(async () => ({ data: [], error: null, count: 0 }))).toEqual([]);
});
