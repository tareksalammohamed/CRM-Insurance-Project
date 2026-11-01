import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ImportColumnReview } from '../src/pages/DataImport/components/ImportColumnReview';
import { IMPORT_COLUMNS, type ImportColumnReview as Review } from '../src/pages/DataImport/types';
afterEach(cleanup);
const review: Review = { headers: IMPORT_COLUMNS.map(column => column.header), samples: [IMPORT_COLUMNS.map(column => column.key === 'premium_amount' ? '971' : column.key === 'sum_assured' ? '225000' : 'قيمة')], mapping: Object.fromEntries(IMPORT_COLUMNS.map((column, index) => [column.key, index])), sheetName: 'البيانات', headerRowNumber: 2, warnings: [], needsConfirmation: true };
it('shows destination labels and source samples, then explicitly approves the current mapping', () => {
  const apply = vi.fn(); render(<ImportColumnReview review={review} loading={false} onApply={apply} onDirty={vi.fn()} />);
  expect(screen.getByText('أمثلة من المصدر: 971')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'اعتماد التوزيع وإعادة فحص الصفوف' }));
  expect(apply).toHaveBeenCalledWith(review.mapping);
});
it('detects a dirty mapping and prevents confirming duplicate source columns', () => {
  const dirty = vi.fn(), apply = vi.fn(); render(<ImportColumnReview review={review} loading={false} onApply={apply} onDirty={dirty} />);
  fireEvent.click(screen.getByRole('button', { name: /قيمة القسط الصافي \*/ }));
  fireEvent.click(screen.getByRole('button', { name: `${Number(review.mapping.sum_assured) + 1}. مبلغ التأمين` }));
  expect(dirty).toHaveBeenCalledOnce();
  expect((screen.getByRole('button', { name: 'اعتماد التوزيع وإعادة فحص الصفوف' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('بأكثر من خانة'); expect(apply).not.toHaveBeenCalled();
});
