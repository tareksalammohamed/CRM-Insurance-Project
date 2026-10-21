import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { CommissionDetails } from '../src/pages/Commissions/components/CommissionDetails';
import type { CommissionRow } from '../src/pages/Commissions/types';

afterEach(cleanup);
const rows: CommissionRow[] = Array.from({ length: 30 }, (_, i) => ({ id: String(i), customerName: `عميل ${i}`, policyLast6: String(100000 + i), type: i === 29 ? 'renewal' : 'year1', amount: i + 10, dueDay: i === 29 ? 12 : 27, dueMonth: '2026-10' }));
it('bounds rendered details and finds a policy beyond the first page without changing source amounts', () => {
  const before = JSON.stringify(rows);
  render(<CommissionDetails rows={rows} />);
  expect(screen.queryByText('عميل 29')).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '100029' } });
  expect(screen.getAllByText('عميل 29')).toHaveLength(2);
  expect(screen.getByRole('status').textContent).toBe('1–1 من 1 عملية');
  expect(JSON.stringify(rows)).toBe(before);
});
it('combines type and due-day filters and restores results after reset', () => {
  render(<CommissionDetails rows={rows} />);
  fireEvent.change(screen.getByLabelText('نوع العمولة'), { target: { value: 'renewal' } });
  fireEvent.change(screen.getByLabelText('يوم الصرف'), { target: { value: '27' } });
  expect(screen.getByRole('status').textContent).toBe('لا توجد نتائج مطابقة');
  fireEvent.click(screen.getByRole('button', { name: 'مسح التصفية' }));
  expect(screen.getByRole('status').textContent).toBe('1–25 من 30 عملية');
  fireEvent.click(screen.getByRole('button', { name: 'الصفحة التالية' }));
  expect(screen.getByRole('status').textContent).toBe('26–30 من 30 عملية');
});
