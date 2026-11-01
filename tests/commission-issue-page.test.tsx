import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: { id: 'u' }, rates: [{ effective_from: '1900-01-01', year1_percent: 2.2, renewal_percent: 0.05 }] }));
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('../src/lib/branchContext', () => ({ useBranchContext: () => ({ currentBranchId: 'b' }) }));
vi.mock('../src/hooks/useReconnectRefetch', () => ({ useReconnectRefetch: vi.fn() }));
vi.mock('../src/features/commissionSettings/useCommissionRates', () => ({ useCommissionRates: () => ({ data: state.rates, isError: false, refetch: vi.fn() }) }));
vi.mock('../src/pages/Commissions/services/commissionsService', () => ({ fetchCommissionSourceData: async () => ({ year1Payments: [{ id: 'p', paid_at: new Date().toISOString(), installment: { policy: { policy_number: 'POL-1', start_date: '', payment_method: 'annual', sum_assured: 100000 } } }], year2Payments: [] }) }));
import { Commissions } from '../src/pages/Commissions';
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('explains an unconfirmed issue date instead of showing a zero or guessing from payment time', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2027-01-03T12:00:00Z'));
  render(<Commissions />);
  expect(await screen.findByText(/تعذر تحديد نسبة عمولة الوثيقة POL-1/)).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'ملخص العمولات' })).toBeNull();
  expect(screen.getByText(/الحساب متوقف/)).toBeTruthy();
});
