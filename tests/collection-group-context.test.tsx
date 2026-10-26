vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-only-key'); });
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CollectionGroupCard } from '../src/pages/Collection/components/CollectionGroupCard';
import type { InstallmentWithRelations } from '../src/pages/Collection/types';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CustomerStatsCards } from '../src/pages/Customers/components/CustomerStatsCards';

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="المسار الحالي">{location.pathname}{location.search}</output>;
}

afterEach(cleanup);
it('opens overdue follow-up from the customer overdue count, rather than current-month dues', () => {
  render(<MemoryRouter><CustomerStatsCards stats={{ total: 20, active: 10, withDueInstallments: 3, newThisMonth: 1, noPolicyCount: 0 }} statsLoading={false} /><CurrentLocation /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'فتح متابعة أقساط السنة الأولى المتأخرة' }));
  expect(screen.getByLabelText('المسار الحالي').textContent).toBe('/collection?quickFilter=overdue');
});
it('distinguishes a partially paid due-date group from its lifetime paid count and preserves payment targets', () => {
  const members = [
    { id: 'paid', status: 'paid', amount: 110, paid_installments_count: 4 },
    { id: 'unpaid', status: 'pending', amount: 230, paid_installments_count: 3 },
  ].map((row, index) => ({ ...row, due_date: '2026-10-01', policy: {
    policy_number: String(index), payment_method: 'monthly', customer: { name: 'عميل' }, owner: { name: 'وكيل' },
  } })) as InstallmentWithRelations[];
  const before = structuredClone(members);
  const pay = vi.fn();
  const cancel = vi.fn();
  render(<CollectionGroupCard members={members} onPayGroup={pay} onCancelGroup={cancel} />);
  expect(screen.getByText('مسدد جزئيًا — 1 وثيقة غير مسددة')).toBeTruthy();
  expect(screen.getByText('المسدد لكل المجموعة — سنة أولى')).toBeTruthy();
  expect(screen.getByText('7')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'تسجيل سداد كل الوثائق (1)' }));
  expect(pay).toHaveBeenCalledWith([members[1]]);
  fireEvent.click(screen.getByRole('button', { name: 'إلغاء سداد الكل' }));
  expect(cancel).toHaveBeenCalledWith([members[0]]);
  const expand = screen.getByRole('button', { name: 'عرض تفاصيل الوثائق (2)' });
  expect(expand.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(expand);
  expect(expand.getAttribute('aria-expanded')).toBe('true');
  expect(members).toEqual(before);
});
