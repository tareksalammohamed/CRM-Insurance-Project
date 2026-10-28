import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), fresh: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: mocks.read, freshDalRead: mocks.fresh }));
import { fetchUserSubtreeIdsBranchAware, fetchUserSubtreeReadBranchAware } from '../src/lib/branchHierarchy';
beforeEach(() => vi.resetAllMocks());
it('keeps the legacy array API while allowing the dashboard to inspect cached hierarchy state', async () => {
  const cached = { data: ['leader', 'agent'], status: 'offline-cache', cachedAt: 100, isStale: true };
  mocks.read.mockResolvedValue(cached);
  expect(await fetchUserSubtreeIdsBranchAware('test', 'leader', 'branch')).toEqual(cached.data);
  expect(await fetchUserSubtreeReadBranchAware('test', 'leader', 'branch')).toBe(cached);
  expect(mocks.read.mock.calls[0][0]).toBe('test:subtree:leader:branch');
});
it('preserves the verified read path used by existing financial reports', async () => {
  mocks.fresh.mockRejectedValue(new Error('unverified'));
  await expect(fetchUserSubtreeIdsBranchAware('closing', 'leader', 'branch', true)).rejects.toThrow('unverified');
  expect(mocks.read).not.toHaveBeenCalled();
});
