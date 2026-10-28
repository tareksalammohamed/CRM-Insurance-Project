import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ result: { data: {}, status: 'online', cachedAt: 123 } as { data: unknown; status: string; cachedAt: number | null }, fresh: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: async () => mocks.result, freshDalRead: mocks.fresh, readStatusMessage: (result: { status: string }) => result.status === 'online' ? null : 'نسخة محفوظة' }));
vi.mock('../src/lib/branchHierarchy', () => ({ fetchUserSubtreeIdsBranchAware: async () => ['u'], fetchUserSubtreeReadBranchAware: async () => mocks.result, fetchBranchRoleMap: async () => new Map() }));
import { fetchDashboardRawData, fetchDashboardScope, fetchTeamUsers } from '../src/pages/Dashboard/services/dashboardService';
beforeEach(() => vi.clearAllMocks());
it('preserves cached summary status and timestamp instead of discarding them at the service boundary', async () => {
  const data = { customersRes: { data: [], count: 7 }, policiesRes: { data: [] }, installmentsRes: { data: [] }, paymentsRes: { data: [] } };
  mocks.result = { data, status: 'offline-cache', cachedAt: 123 };
  const result = await fetchDashboardRawData(['u'], '2026-01-01');
  expect(result.customersRes.count).toBe(7); expect(result.readStatus).toBe('offline-cache'); expect(result.cachedAt).toBe(123); expect(result.loadMessage).toBe('نسخة محفوظة');
});
it('preserves unavailable hierarchy status and requires a verified team read', async () => {
  mocks.result = { data: ['u'], status: 'offline-empty', cachedAt: null };
  expect((await fetchDashboardScope('u')).status).toBe('offline-empty');
  mocks.fresh.mockRejectedValueOnce(new Error('not verified'));
  await expect(fetchTeamUsers(['u'])).rejects.toThrow('not verified');
});
