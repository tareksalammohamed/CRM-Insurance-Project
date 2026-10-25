import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fail: false, failFollowups: false, followups: [] as Record<string, unknown>[], tables: [] as string[], ranges: [] as number[], write: vi.fn(), sheets: vi.fn(), online: vi.fn(() => true) }));
vi.mock('../src/lib/networkManager', () => ({ isOnline: mocks.online }));
vi.mock('xlsx', () => ({ utils: { book_new: () => ({}), json_to_sheet: mocks.sheets, aoa_to_sheet: () => ({}), book_append_sheet: vi.fn() }, writeFile: mocks.write }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: (table: string) => ({ select: () => ({ order: () => ({ range: async (start: number, end: number) => {
  mocks.tables.push(table);
  if (table === 'customer_followups') return mocks.failFollowups ? { data: null, error: new Error('network') } : { data: mocks.followups, error: null };
  if (table === 'customers') {
    mocks.ranges.push(start);
    if (mocks.fail && start === 500) return { data: null, error: new Error('failed to fetch') };
    return { data: Array.from({ length: Math.max(0, Math.min(end + 1, 1001) - start) }, (_, i) => ({ id: start + i })), error: null };
  }
  return { data: [], error: null };
} }) }) }) } }));
import { runDatabaseBackup } from '../src/pages/Settings/backupExport';
beforeEach(() => { mocks.fail = false; mocks.failFollowups = false; mocks.followups = []; mocks.tables.length = 0; mocks.ranges.length = 0; mocks.write.mockClear(); mocks.sheets.mockClear(); });
it('exports beyond 1000 rows using stable ordered pages', async () => {
  const result = await runDatabaseBackup();
  expect(result.totalRows).toBe(1001);
  expect(mocks.ranges).toEqual([0, 500, 1000]);
  expect(mocks.sheets.mock.calls[0][0]).toHaveLength(1001);
  expect(mocks.write).toHaveBeenCalledOnce();
});
it('never downloads a partial file if a later page fails', async () => {
  mocks.fail = true;
  await expect(runDatabaseBackup()).rejects.toThrow('تعذر تصدير');
  expect(mocks.write).not.toHaveBeenCalled();
});

it('includes customer follow-up records in the same scoped export', async () => {
  mocks.followups = [{ id: 'followup', customer_id: 'customer', notes: 'متابعة' }];
  const result = await runDatabaseBackup();
  expect(mocks.tables).toContain('customer_followups');
  expect(mocks.sheets).toHaveBeenCalledWith(mocks.followups);
  expect(result.totalRows).toBe(1002);
});
it('does not download an incomplete export when follow-up reading fails', async () => {
  mocks.failFollowups = true;
  await expect(runDatabaseBackup()).rejects.toThrow('تعذر تصدير');
  expect(mocks.write).not.toHaveBeenCalled();
});
