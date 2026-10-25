import { beforeEach, expect, it, vi } from 'vitest';
const { insert, update, rpc, select } = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), rpc: vi.fn(), select: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: () => ({ insert, update }), rpc } }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: vi.fn() }));
vi.mock('../src/lib/branchHierarchy', () => ({ fetchUserSubtreeIdsBranchAware: vi.fn(), fetchBranchRoleMap: vi.fn() }));
import { closeMonth } from '../src/pages/MonthlyClosing/services/monthlyClosingService';
beforeEach(() => { vi.resetAllMocks(); insert.mockResolvedValue({ error: { code: '23505' } }); update.mockReturnValue({ eq: () => ({ select }) }); rpc.mockResolvedValue({ error: null }); });
it('rejects a failed re-closing update without logging a successful close', async () => {
  const error = { code: '42501', message: 'permission denied' }; select.mockResolvedValue({ data: null, error });
  await expect(closeMonth('2026-10-01', 'user')).rejects.toEqual(error); expect(rpc).not.toHaveBeenCalled();
});
it('rejects a silent zero-row update', async () => {
  select.mockResolvedValue({ data: [], error: null });
  await expect(closeMonth('2026-10-01', 'user')).rejects.toThrow('لم يتم تحديث الإقفال'); expect(rpc).not.toHaveBeenCalled();
});
it('keeps the existing close fields and logs only after acknowledgement', async () => {
  select.mockResolvedValue({ data: [{ id: 'closing' }], error: null });
  await closeMonth('2026-10-01', 'user');
  expect(update).toHaveBeenCalledWith({ is_open: false, opened_at: null, opened_by_user_id: null }); expect(rpc).toHaveBeenCalledOnce();
});
it('preserves the first-time close path', async () => {
  insert.mockResolvedValue({ error: null }); await closeMonth('2026-10-01', 'user'); expect(update).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledOnce();
});
