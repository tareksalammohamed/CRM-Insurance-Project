vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
vi.mock('../src/lib/branchContext', () => ({ useBranchContext: () => ({ currentBranchId: null }) }));
vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-only-key'); });
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CustomerDetailsDialog } from '../src/pages/Customers/components/dialogs/CustomerDetailsDialog';
import { PolicyDetailsDialog } from '../src/pages/Customers/components/dialogs/PolicyDetailsDialog';
import { customerInputHints } from '../src/lib/inputGuidance';
import type { CustomerWithRelations, CustomerPolicySummary } from '../src/pages/Customers/types';
import type { Installment } from '../src/lib/supabase';
const policy: CustomerPolicySummary = { id: 'policy-a', policy_number: '100001', policy_type: 'protection_investment', status: 'active', premium_amount: 100, sum_assured: 50000, start_date: '2026-01-01', created_at: '2026-01-01' };
afterEach(cleanup);
it('opens installments for the selected policy and exact status instead of a general collection page', () => {
  const open = vi.fn();
  render(<MemoryRouter><CustomerDetailsDialog customer={{ id: 'customer-a', name: 'عميل', phone: '', policies: [policy] } as CustomerWithRelations} showExtraInfo={false} onToggleExtraInfo={vi.fn()} policySummaries={{ 'policy-a': { paid: 2, pending: 3, overdue: 1 } }} onClose={vi.fn()} onEdit={vi.fn()} onPrint={vi.fn()} onIssueNewPolicy={vi.fn()} onOpenPolicyDetails={open} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'الوثائق والأقساط (1)' }));
  fireEvent.click(screen.getByRole('button', { name: 'عرض أقساط السنة الأولى المتأخرة (1)' }));
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
  fireEvent.change(screen.getByLabelText('تصفية أقساط السنة الأولى لهذه الوثيقة'), { target: { value: 'all' } });
  expect(screen.getAllByRole('button', { name: 'إلغاء سداد القسط رقم 1' }).length).toBeGreaterThan(0);
});
it('organizes customer information separately from policy rendering', () => {
  render(<MemoryRouter><CustomerDetailsDialog customer={{ id: 'customer-a', name: 'عميل', phone: '01012345678', policies: [policy] } as CustomerWithRelations} showExtraInfo={false} onToggleExtraInfo={vi.fn()} policySummaries={{}} onClose={vi.fn()} onEdit={vi.fn()} onPrint={vi.fn()} onIssueNewPolicy={vi.fn()} onOpenPolicyDetails={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'البيانات والمراجعة' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByText('100001')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'الوثائق والأقساط (1)' }));
  expect(screen.getByText('100001')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'وثيقة جديدة' })).toBeTruthy();
});
it('explains overdue attention from the loaded summary and opens the exact policy filter', () => {
  const open = vi.fn();
  render(<MemoryRouter><CustomerDetailsDialog customer={{ id: 'customer-a', name: 'عميل', phone: '01012345678', policies: [policy] } as CustomerWithRelations} showExtraInfo={false} onToggleExtraInfo={vi.fn()} policySummaries={{ 'policy-a': { paid: 1, pending: 2, overdue: 3 } }} onClose={vi.fn()} onEdit={vi.fn()} onPrint={vi.fn()} onIssueNewPolicy={vi.fn()} onOpenPolicyDetails={open} /></MemoryRouter>);
  fireEvent.click(screen.getByText('عرض الملاحظات وأسبابها'));
  fireEvent.click(screen.getByText('فتح الوثيقة والأقساط'));
  expect(open).toHaveBeenCalledWith(policy, 'overdue');
});

function CurrentPath() {
  const location = useLocation();
  return <output aria-label="current route">{location.pathname}</output>;
}

it('opens the chosen customer document on the canonical policy page and closes the customer workspace', () => {
  const close = vi.fn();
  const openInstallments = vi.fn();
  const anotherPolicy = { ...policy, id: 'policy-b', policy_number: '100002' };
  render(<MemoryRouter initialEntries={['/customers?search=client']}>
    <CustomerDetailsDialog
      customer={{ id: 'customer-a', name: 'عميل', phone: '01012345678', policies: [policy, anotherPolicy] } as CustomerWithRelations}
      showExtraInfo={false} onToggleExtraInfo={vi.fn()} policySummaries={{}}
      onClose={close} onEdit={vi.fn()} onPrint={vi.fn()} onIssueNewPolicy={vi.fn()}
      onOpenPolicyDetails={openInstallments}
    />
    <CurrentPath />
  </MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'الوثائق والأقساط (2)' }));
  const links = screen.getAllByRole('link', { name: 'عرض التفاصيل' });
  expect(links.map(link => link.getAttribute('href')).sort()).toEqual(['/policies/policy-a', '/policies/policy-b']);
  fireEvent.click(links.find(link => link.getAttribute('href') === '/policies/policy-b')!);
  expect(screen.getByLabelText('current route').textContent).toBe('/policies/policy-b');
  expect(close).toHaveBeenCalledOnce();
  expect(openInstallments).not.toHaveBeenCalled();
});
