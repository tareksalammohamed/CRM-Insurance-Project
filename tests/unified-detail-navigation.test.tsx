vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MoreMenuDialog } from '../src/pages/Collection/components/dialogs/MoreMenuDialog';
import { CustomerReview } from '../src/pages/Customers/components/CustomerReview';
import { Year2CollectionCard } from '../src/pages/Collection/year2/components/Year2CollectionCard';
import type { InstallmentWithRelations } from '../src/pages/Collection/types';
import type { Year2EligiblePolicy } from '../src/pages/Collection/year2/types';
import type { CustomerWithRelations } from '../src/pages/Customers/types';
vi.mock('../src/features/customerFollowup/FollowupPanel', () => ({ PromiseDialog: () => null }));
afterEach(cleanup);
function CurrentRoute() { const location = useLocation(); return <output aria-label="current route">{location.pathname}{location.search}</output>; }
const policy = { id: 'policy-a', customer_id: 'customer-a', policy_number: '100001', policy_type: 'protection_investment', status: 'active', start_date: '2024-01-01', premium_amount: 100, customer: { name: 'عميل' }, owner: { name: 'وكيل' } };
const installment = { id: 'i', policy_id: 'policy-a', status: 'pending', policy } as InstallmentWithRelations;
it.each([['فتح ملف العميل', '/customers?open=customer-a'], ['تفاصيل الوثيقة', '/policies/policy-a']])('routes collection %s to the canonical entity and closes its menu', (name, path) => {
  const close = vi.fn(), history = vi.fn();
  render(<MemoryRouter initialEntries={['/collection']}><MoreMenuDialog installment={installment} onClose={close} onOpenPolicyHistory={history} onOpenCancel={vi.fn()} onOpenPayment={vi.fn()} onOpenPromise={vi.fn()} /><CurrentRoute /></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name }));
  expect(screen.getByLabelText('current route').textContent).toBe(path);
  expect(close).toHaveBeenCalledOnce(); expect(history).not.toHaveBeenCalled();
});
it('keeps first-year collection history as a separate scoped action', () => {
  const history = vi.fn();
  render(<MemoryRouter initialEntries={['/collection']}><MoreMenuDialog installment={installment} onClose={vi.fn()} onOpenPolicyHistory={history} onOpenCancel={vi.fn()} onOpenPayment={vi.fn()} onOpenPromise={vi.fn()} /><CurrentRoute /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'سجل أقساط السنة الأولى للوثيقة' }));
  expect(history).toHaveBeenCalledOnce(); expect(screen.getByLabelText('current route').textContent).toBe('/collection');
});
it('opens a document requiring correction on its full page rather than the installment dialog', () => {
  const close = vi.fn(), openInstallments = vi.fn();
  render(<MemoryRouter><CustomerReview customer={{ id: 'c', name: 'عميل', policies: [{ ...policy, sum_assured: null }] } as unknown as CustomerWithRelations} onEdit={vi.fn()} onNavigate={close} onOpenPolicy={openInstallments} /><CurrentRoute /></MemoryRouter>);
  fireEvent.click(screen.getByText('عرض الملاحظات وأسبابها'));
  fireEvent.click(screen.getByText('مراجعة هذه الوثيقة'));
  expect(screen.getByLabelText('current route').textContent).toBe('/policies/policy-a');
  expect(close).toHaveBeenCalledOnce(); expect(openInstallments).not.toHaveBeenCalled();
});
it.each([['فتح ملف العميل عميل', '/customers?open=customer-a'], ['تفاصيل الوثيقة 100001', '/policies/policy-a']])('offers the same %s destination from renewal collection', (name, path) => {
  render(<MemoryRouter initialEntries={['/collection?year=year2']}><Year2CollectionCard policy={{ ...policy, year2_total_paid: 100 } as Year2EligiblePolicy} formatCurrency={String} onHistory={vi.fn()} onAddPayment={vi.fn()} /><CurrentRoute /></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name }));
  expect(screen.getByLabelText('current route').textContent).toBe(path);
});
