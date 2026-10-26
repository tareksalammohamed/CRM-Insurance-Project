vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ customers: vi.fn(), print: vi.fn(), targets: vi.fn(), user: { id: 'u', name: 'Test', role: 'agent' } }));
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../src/lib/branchContext', () => ({ useBranchContext: () => ({ currentBranchId: 'branch' }) }));
vi.mock('../src/hooks/useReconnectRefetch', () => ({ useReconnectRefetch: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../src/lib/printWithTitle', () => ({ printWithTitle: mocks.print }));
vi.mock('../src/components/ui/SaveAsImageButton', () => ({ SaveAsImageButton: () => null }));
vi.mock('recharts', () => ({ BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null, ResponsiveContainer: () => null }));
vi.mock('../src/pages/Reports/services/activityTargetsService', () => ({ fetchActivityTargets: mocks.targets, fetchDailyStatsForUsers: async () => [] }));
vi.mock('../src/pages/Reports/services/reportsService', () => ({
  fetchUserSubtreeIds: async () => ['u'], fetchCustomerRequestsReport: mocks.customers,
  fetchUsersInSubtree: async () => [], fetchPoliciesForOwners: async () => [], fetchPaymentsInRange: async () => [], fetchAllInstallmentsWithPolicy: async () => [], fetchAgentsForReport: async () => [], fetchSimplePaymentsInRange: async () => [], fetchUsersByRole: async () => [], fetchLeadersPerformance: async () => [], fetchInstallmentsDueInRange: async () => [], fetchSupervisoryPerformanceUsers: async () => [],
}));
import { Reports } from '../src/pages/Reports';
const deferred = () => { let resolve!: (rows: unknown[]) => void; const promise = new Promise<unknown[]>(done => { resolve = done; }); return { promise, resolve }; };
const customer = (name: string) => ({ id: name, name, created_at: '2026-01-01', policies: [], insurance_amount: 500, owner: { name: 'Agent' } });
beforeEach(() => { vi.resetAllMocks(); mocks.targets.mockResolvedValue({ id: null, callsDailyTarget: 10, appointmentsDailyTarget: 2, newClientsWeeklyTarget: 3 }); });
afterEach(cleanup);
it('ignores the previous month response and disables print until the selected report completes', async () => {
  const old = deferred(); const next = deferred();
  mocks.customers.mockReturnValue(old.promise);
  const view = render(<Reports />);
  await waitFor(() => expect(mocks.customers).toHaveBeenCalled());
  expect((screen.getByTitle('طباعة التقرير') as HTMLButtonElement).disabled).toBe(true);
  mocks.customers.mockReturnValue(next.promise);
  fireEvent.change(view.container.querySelector('input[type="month"]')!, { target: { value: '2025-11' } });
  await waitFor(() => expect(mocks.customers.mock.calls.at(-1)?.[1].getFullYear()).toBe(2025));
  await act(async () => next.resolve([customer('CURRENT')]));
  await waitFor(() => expect((screen.getByTitle('طباعة التقرير') as HTMLButtonElement).disabled).toBe(false));
  await act(async () => old.resolve([customer('OBSOLETE')]));
  expect(screen.queryByText('OBSOLETE')).toBeNull(); expect(screen.getByText('CURRENT')).toBeTruthy();
  fireEvent.click(screen.getByTitle('طباعة التقرير')); expect(mocks.print).toHaveBeenCalledOnce();
});
it('shows retry and blocks export after a failed report read, then recovers', async () => {
  mocks.customers.mockRejectedValue(new Error('partial page failure'));
  render(<Reports />);
  await screen.findByText('تعذر تحميل التقرير كاملًا؛ أعد المحاولة.');
  expect((screen.getByTitle('طباعة التقرير') as HTMLButtonElement).disabled).toBe(true);
  mocks.customers.mockResolvedValue([customer('RECOVERED')]);
  fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
  await screen.findByText('RECOVERED');
  expect((screen.getByTitle('طباعة التقرير') as HTMLButtonElement).disabled).toBe(false);
});
