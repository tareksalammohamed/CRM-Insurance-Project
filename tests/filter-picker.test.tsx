import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FilterPicker } from '../src/components/forms/FilterPicker';
const options = [
  { value: 'all', label: 'جميع العمليات' },
  ...Array.from({ length: 9 }, (_, index) => ({ value: `operation-${index}`, label: `عملية ${index}`, group: index < 4 ? 'الوثائق' : 'السداد' })),
];
afterEach(cleanup);
it('searches labels and group names without changing the selected value or mutating options', () => {
  const onChange = vi.fn(); const original = JSON.stringify(options);
  render(<FilterPicker label="نوع العملية" value="all" options={options} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'نوع العملية: جميع العمليات' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'السداد' } });
  expect(screen.queryByText('عملية 0')).toBeNull(); expect(screen.getByText('عملية 8')).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'عملية 8' }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith('operation-8');
  expect(screen.queryByRole('dialog')).toBeNull(); expect(JSON.stringify(options)).toBe(original);
});
it('clears search with Escape, then dismisses without committing and returns focus', async () => {
  const onChange = vi.fn();
  render(<FilterPicker label="نوع العملية" value="all" options={options} onChange={onChange} />);
  const trigger = screen.getByRole('button', { name: 'نوع العملية: جميع العمليات' });
  trigger.focus(); fireEvent.click(trigger);
  const input = screen.getByRole('searchbox'); input.focus();
  fireEvent.change(input, { target: { value: 'لا يوجد' } });
  expect(screen.getByText('لا توجد نتائج مطابقة للبحث')).toBeTruthy();
  fireEvent.keyDown(input, { key: 'Escape' });
  expect((input as HTMLInputElement).value).toBe(''); expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.keyDown(input, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(trigger); expect(onChange).not.toHaveBeenCalled();
});
it('marks the current option and does not refetch when it is reselected', () => {
  const onChange = vi.fn();
  render(<FilterPicker label="حالة الوثيقة" value="active" options={[{ value: 'active', label: 'نشط' }]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'حالة الوثيقة: نشط' }));
  expect(screen.queryByRole('searchbox')).toBeNull();
  const current = screen.getByRole('button', { name: 'نشط' }); expect(current.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(current); expect(onChange).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull();
});
it('is safe inside a form and respects disabled controls', () => {
  const submit = vi.fn(event => event.preventDefault());
  const view = render(<form onSubmit={submit}><FilterPicker label="الحالة" value="all" options={options} onChange={vi.fn()} /></form>);
  fireEvent.click(screen.getByRole('button', { name: 'الحالة: جميع العمليات' }));
  fireEvent.click(screen.getByRole('button', { name: 'عملية 2' }));
  expect(submit).not.toHaveBeenCalled();
  view.rerender(<FilterPicker label="الحالة" value="all" options={options} onChange={vi.fn()} disabled />);
  fireEvent.click(screen.getByRole('button', { name: 'الحالة: جميع العمليات' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
