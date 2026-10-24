vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
vi.mock('../src/lib/branchContext', () => ({ useBranchContext: () => ({ currentBranchId: null }) }));
vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-only-key'); });
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CustomerDetailsDialog } from '../src/pages/Customers/components/dialogs/CustomerDetailsDialog';
import { PolicyDetailsDialog } from '../src/pages/Customers/components/dialogs/PolicyDetailsDialog';
import { customerInputHints } from '../src/lib/inputGuidance';
import type { CustomerWithRelations, CustomerPolicySummary } from '../src/pages/Customers/types';
import type { Installment } from '../src/lib/supabase';
const policy: CustomerPolicySummary = { id: 'policy-a', policy_number: '100001', policy_type: 'protection_investment', status: 'active', premium_amount: 100, sum_assured: 50000, start_date: '2026-01-01', created_at: '2026-01-01' };
afterEach(cleanup);
it('opens installments for the selected policy and exact status instead of a general collection page', () => {
  const open = vi.fn();
  render(<CustomerDetailsDialog customer={{ id: 'customer-a', name: 'عميل', phone: '', policies: [policy] } as CustomerWithRelations} showExtraInfo={false} onToggleExtraInfo={vi.fn()} policySummaries={{ 'policy-a': { paid: 2, pending: 3, overdue: 1 } }} onClose={vi.fn()} onEdit={vi.fn()} onPrint={vi.fn()} onIssueNewPolicy={vi.fn()} onOpenPolicyDetails={open} />);
  fireEvent.click(screen.getByRole('button', { name: 'عرض الأقساط المتأخرة (1)' }));
  expect(open).toHaveBeenCalledWith(policy, 'overdue');
});
it('explains a birth date discrepancy without rewriting the input or treating invalid encoded dates as facts', () => {
  const data = { national_id: '٢٩٠٠١٠١١٢٣٤٥٦٧', birth_date: '1990-01-02' };
  expect(customerInputHints(data).some(hint => hint.includes('لا يطابق'))).toBe(true);
  expect(data.birth_date).toBe('1990-01-02');
  expect(customerInputHints({ ...data, birth_date: '1990-01-01' })).toEqual([]);
  expect(customerInputHints({ national_id: '29002311234567', birth_date: '1990-01-01' })).toEqual([]);
});
it('keeps policy details scoped while allowing the user to clear the status filter', () => {
  const installments = [
    { id: 'i1', installment_number: 1, status: 'paid', amount: 100, due_date: '2026-01-01', paid_at: '2026-01-01' },
    { id: 'i2', installment_number: 2, status: 'overdue', amount: 100, due_date: '2026-02-01' },
  ] as Installment[];
  render(<PolicyDetailsDialog openPolicySummary={policy} policyDetail={null} policyInstallments={installments} initialFilter="overdue" loadingPolicyDetail={false} onClose={vi.fn()} onPay={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'إلغاء سداد القسط رقم 1' })).toBeNull();
  fireEvent.change(screen.getByLabelText('أقساط هذه الوثيقة فقط'), { target: { value: 'all' } });
  expect(screen.getAllByRole('button', { name: 'إلغاء سداد القسط رقم 1' }).length).toBeGreaterThan(0);
});
