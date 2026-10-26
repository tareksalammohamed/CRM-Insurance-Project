vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ record: vi.fn(), payments: vi.fn(), close: vi.fn(), user: { id: 'u', name: 'مراقب', role: 'supervisor', target: 10000, manager_id: null } }));
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../src/lib/notify', () => ({ useNotify: () => ({ error: vi.fn() }) }));
vi.mock('../src/lib/branchContext', () => ({ useBranchContext: () => ({ currentBranchId: null }) }));
vi.mock('../src/hooks/useReconnectRefetch', () => ({ useReconnectRefetch: vi.fn() }));
vi.mock('../src/pages/MonthlyClosing/components/PrintReport', () => ({ PrintReport: ({ monthLabel }: { monthLabel: string }) => <div data-testid="print-report">{monthLabel}</div> }));
vi.mock('../src/pages/MonthlyClosing/services/monthlyClosingService', () => ({
  fetchClosingRecord: mocks.record, fetchMonthPayments: mocks.payments,
  fetchUserSubtreeIds: async () => ['u'], fetchUsersByIds: async () => [mocks.user],
  fetchBranchRoleMap: async () => new Map(), fetchFirstWorkMonthByOwnerIds: async () => new Map(),
  fetchBranchesForUserIds: async () => [], filterPaymentsByOwnerIds: (rows: unknown[]) => rows,
  closeMonth: mocks.close, openMonth: vi.fn(),
}));
import { MonthlyClosing } from '../src/pages/MonthlyClosing';
afterEach(cleanup);
beforeEach(() => { mocks.record.mockReset().mockResolvedValue(null); mocks.payments.mockReset().mockResolvedValue([]); });
it('blocks printing and approval after failed reads and allows a successful retry', async () => {
  mocks.record.mockRejectedValueOnce(new Error('offline'));
  render(<MonthlyClosing />);
  await screen.findByText('لم يتم تحميل تقرير موثوق لهذا الشهر.');
  expect(screen.getByRole('button', { name: 'طباعة التقرير' }).hasAttribute('disabled')).toBe(true);
  expect(screen.queryByTestId('print-report')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
  await screen.findByTestId('print-report');
  expect(screen.getByRole('button', { name: 'طباعة التقرير' }).hasAttribute('disabled')).toBe(false);
});
it('does not publish an older month response over the latest selection', async () => {
  let resolve!: (value: { is_open: boolean }) => void;
  mocks.record.mockReturnValueOnce(new Promise<{ is_open: boolean }>(done => { resolve = done; }));
  render(<MonthlyClosing />);
  await waitFor(() => expect(mocks.record).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'الشهر السابق' }));
  await screen.findByTestId('print-report');
  const latest = screen.getByTestId('print-report').textContent;
  await act(async () => resolve({ is_open: false }));
  expect(screen.getByTestId('print-report').textContent).toBe(latest);
  expect(screen.getByText('مفتوح — قيد المراجعة')).toBeTruthy();
  expect(mocks.payments).toHaveBeenCalledTimes(2);
});
it('starts monthly payments before the independent closing-record read completes', async () => {
  let finish!: (value: null) => void;
  mocks.record.mockReturnValueOnce(new Promise<null>(resolve => { finish = resolve; }));
  render(<MonthlyClosing />);
  await waitFor(() => expect(mocks.payments).toHaveBeenCalledOnce());
  expect(screen.queryByTestId('print-report')).toBeNull();
  await act(async () => finish(null));
  await screen.findByTestId('print-report');
});
