import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { Installment } from '../src/lib/supabase';
import { FirstYearSummary } from '../src/features/installments/FirstYearSummary';
import { firstYearScheduleSummary } from '../src/features/installments/firstYearSummaryModel';
const rows = [{ status: 'paid', amount: 100 }, { status: 'pending', amount: 200 }, { status: 'overdue', amount: 300 }, { status: 'pending', amount: 400 }] as Installment[];
afterEach(cleanup);
it('uses the actual schedule amounts and keeps overdue separate from pending', () => {
  const copy = structuredClone(rows);
  expect(firstYearScheduleSummary(rows)).toEqual({ total: 4, paid: 1, pending: 2, overdue: 1, amount: 1000, paidAmount: 100, pendingAmount: 600, overdueAmount: 300 });
  expect(rows).toEqual(copy);
  expect(firstYearScheduleSummary([{ status: 'pending', amount: 975 }])).toMatchObject({ total: 1, amount: 975 });
});
it('labels the year, units and overlap explicitly without treating an empty load as a zero debt', () => {
  const { rerender } = render(<FirstYearSummary installments={rows} />);
  expect(screen.getByRole('region', { name: 'ملخص أقساط السنة الأولى' })).toBeTruthy();
  expect(screen.getByText(/المتأخر جزء من المتبقي/)).toBeTruthy();
  expect(screen.getByText(/لا يشمل تحصيلات السنة الثانية/)).toBeTruthy();
  expect(screen.getAllByText('قسط')).toHaveLength(4);
  rerender(<FirstYearSummary installments={[]} loading />);
  expect(screen.getByRole('status').textContent).toContain('جاري تحميل');
  rerender(<FirstYearSummary installments={[]} />);
  expect(screen.getByText('لا توجد أقساط سنة أولى محمّلة لعرض مجموعها.')).toBeTruthy();
});
