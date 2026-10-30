import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TeamScopePicker } from '../src/pages/Reports/components/TeamScopePicker';
const members = [
  { id: 'leader', name: 'طارق سلام', roleLabel: 'رئيس مجموعة' },
  { id: 'agent', name: 'أحمد علي', roleLabel: 'مندوب' },
];
afterEach(cleanup);
it('searches names and roles locally and emits the original member ID only on selection', () => {
  const onSelect = vi.fn();
  render(<TeamScopePicker value="" members={members} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: 'نطاق الفريق نطاقي بالكامل' }));
  const input = screen.getByRole('searchbox');
  fireEvent.change(input, { target: { value: 'طارق' } });
  expect(screen.queryByText('أحمد علي')).toBeNull();
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'مندوب' } });
  expect(screen.queryByText('طارق سلام')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'أحمد علي مندوب' }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('agent');
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('keeps the full scope available with no matches and resets the ID to the existing empty-string scope', () => {
  const onSelect = vi.fn();
  render(<TeamScopePicker value="leader" members={members} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: 'نطاق الفريق طارق سلام' }));
  expect(screen.getByRole('button', { name: 'طارق سلام رئيس مجموعة' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
  expect(screen.getByText('لا توجد نتائج مطابقة للبحث')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'مسح البحث' }));
  expect(screen.getByText('أحمد علي')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'نطاقي بالكامل كل الفريق ضمن صلاحياتي' }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('');
});
it('dismisses with Escape without changing scope, restores focus, and clears search on reopening', async () => {
  const onSelect = vi.fn();
  render(<TeamScopePicker value="leader" members={members} onSelect={onSelect} />);
  const trigger = screen.getByRole('button', { name: 'نطاق الفريق طارق سلام' });
  trigger.focus(); fireEvent.click(trigger);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(trigger);
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
});
it('supports the full scope when the member list is empty', () => {
  render(<TeamScopePicker value="" members={[]} onSelect={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'نطاق الفريق نطاقي بالكامل' }));
  expect(screen.getByText('لا يوجد أعضاء متاحون في هذا النطاق')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'نطاقي بالكامل كل الفريق ضمن صلاحياتي' }).getAttribute('aria-pressed')).toBe('true');
});
