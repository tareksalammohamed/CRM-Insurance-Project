vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ raw: vi.fn(), scope: vi.fn(), team: vi.fn(), cancellations: vi.fn(), user: { id: 'u', role: 'agent', name: 'Test', target: 10000 } }));
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../src/lib/branchContext', () => ({ useBranchContext: () => ({ currentBranchId: null }) }));
vi.mock('../src/hooks/useReconnectRefetch', () => ({ useReconnectRefetch: vi.fn() }));
vi.mock('../src/pages/Dashboard/services/dashboardService', () => ({ fetchDashboardScope: mocks.scope, fetchDashboardRawData: mocks.raw, fetchTeamUsers: mocks.team, fetchDashboardBranchRoles: async () => new Map() }));
vi.mock('../src/pages/Cancellations/services/cancellationService', () => ({ loadCancellationSummary: mocks.cancellations }));
import { useDashboard } from '../src/pages/Dashboard/hooks/useDashboard';
const original = Object.getOwnPropertyDescriptor(navigator, 'connection');
const raw = { customersRes: { data: [], count: 0 }, policiesRes: { data: [] }, installmentsRes: { data: [] }, paymentsRes: { data: [] } };
beforeEach(() => { vi.resetAllMocks(); mocks.scope.mockResolvedValue({ data: ['u'], status: 'online', cachedAt: Date.now() }); mocks.cancellations.mockResolvedValue({ cancellationRate: 0, cancelledValue: 0 }); });
afterEach(() => { cleanup(); if (original) Object.defineProperty(navigator, 'connection', original); else Reflect.deleteProperty(navigator, 'connection'); });
it('publishes the main dashboard without waiting for team details on slow connections', async () => {
  Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '2g' } });
  let rawDone!: (value: typeof raw) => void; let teamDone!: (value: unknown[]) => void;
  mocks.raw.mockReturnValue(new Promise(done => { rawDone = done; })); mocks.team.mockReturnValue(new Promise(done => { teamDone = done; }));
  const { result } = renderHook(useDashboard);
  await waitFor(() => expect(mocks.raw).toHaveBeenCalledOnce()); expect(mocks.team).not.toHaveBeenCalled(); expect(mocks.cancellations).not.toHaveBeenCalled();
  await act(async () => rawDone(raw));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.stats).not.toBeNull(); expect(result.current.teamLoading).toBe(true);
  expect(result.current.cancellationLoading).toBe(true); expect(result.current.cancellationSummary).toBeNull();
  await act(async () => teamDone([]));
  await waitFor(() => expect(result.current.teamLoading).toBe(false));
  await waitFor(() => expect(result.current.cancellationLoading).toBe(false));
  expect(result.current.cancellationSummary?.cancellationRate).toBe(0);
});
it('starts team details before the main read finishes when the connection is fast', async () => {
  Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '4g', rtt: 30, downlink: 20 } });
  let rawDone!: (value: typeof raw) => void;
  mocks.raw.mockReturnValue(new Promise(done => { rawDone = done; })); mocks.team.mockResolvedValue([]);
  const { result } = renderHook(useDashboard);
  await waitFor(() => expect(mocks.team).toHaveBeenCalledOnce());
  expect(result.current.loading).toBe(true);
  await act(async () => rawDone(raw)); await waitFor(() => expect(result.current.teamLoading).toBe(false));
  expect(result.current.stats).not.toBeNull();
});
it('keeps the main dashboard usable if a later team read fails', async () => {
  Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '2g' } });
  mocks.raw.mockResolvedValue(raw); mocks.team.mockRejectedValue(new Error('team failed'));
  const { result } = renderHook(useDashboard);
  await waitFor(() => expect(result.current.teamError).toContain('تعذر تحميل تفاصيل الفريق'));
  expect(result.current.stats).not.toBeNull(); expect(result.current.dashboardError).toBeNull(); expect(result.current.loading).toBe(false);
});

it('rejects an unavailable summary instead of publishing fallback zeroes as a successful refresh', async () => {
  mocks.raw.mockResolvedValue({ ...raw, readStatus: 'offline-empty', cachedAt: null }); mocks.team.mockResolvedValue([]);
  const { result } = renderHook(useDashboard);
  await waitFor(() => expect(result.current.dashboardError).toContain('تعذر تحميل ملخص'));
  expect(result.current.stats).toBeNull(); expect(result.current.lastUpdated).toBeNull();
});
it('marks cached data with its real age, keeps it readable and clears the notice after recovery', async () => {
  const cachedAt = Date.now() - 600000;
  mocks.raw.mockResolvedValue({ ...raw, readStatus: 'offline-cache', cachedAt, loadMessage: 'المعروض نسخة محفوظة' }); mocks.team.mockResolvedValue([]);
  const { result } = renderHook(useDashboard);
  await waitFor(() => expect(result.current.dashboardNotice).toBe('المعروض نسخة محفوظة'));
  expect(result.current.stats).not.toBeNull(); expect(result.current.lastUpdated?.getTime()).toBe(cachedAt);
  expect(result.current.teamError).toContain('ملخص الفريق');
  mocks.raw.mockResolvedValue({ ...raw, readStatus: 'online', cachedAt: Date.now() });
  await act(async () => { await result.current.refresh(); });
  expect(result.current.dashboardNotice).toBeNull(); expect(result.current.dashboardError).toBeNull();
});
it('does not calculate a narrower self-only summary when the hierarchy was unavailable', async () => {
  mocks.scope.mockResolvedValue({ data: ['u'], status: 'offline-empty', cachedAt: null });
  const { result } = renderHook(useDashboard);
  await waitFor(() => expect(result.current.dashboardError).toContain('تعذر تحميل ملخص'));
  expect(mocks.raw).not.toHaveBeenCalled(); expect(result.current.stats).toBeNull();
});
it('marks a cached hierarchy even if its associated financial read is online', async () => {
  const cachedAt = Date.now() - 600000;
  mocks.scope.mockResolvedValue({ data: ['u'], status: 'error-cache', cachedAt });
  mocks.raw.mockResolvedValue({ ...raw, readStatus: 'online', cachedAt: Date.now() }); mocks.team.mockResolvedValue([]);
  const { result } = renderHook(useDashboard);
  await waitFor(() => expect(result.current.dashboardNotice).toContain('نطاق محفوظ'));
  expect(result.current.lastUpdated?.getTime()).toBe(cachedAt); expect(result.current.stats).not.toBeNull();
});

it('classifies a failed main summary calculation as a main failure, not a team-only error', async () => {
  mocks.raw.mockResolvedValue({ ...raw, policiesRes: { data: [null] } }); mocks.team.mockResolvedValue([]);
  const { result } = renderHook(useDashboard);
  await waitFor(() => expect(result.current.dashboardError).toContain('تعذر تحميل ملخص'));
  expect(result.current.stats).toBeNull(); expect(result.current.lastUpdated).toBeNull();
});
