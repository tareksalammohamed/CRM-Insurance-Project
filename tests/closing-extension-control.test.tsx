import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock('../src/features/closingExtensions/service', () => ({ fetchClosingExtension: mocks.fetch, saveClosingExtension: mocks.save }));
import { ClosingExtensionControl } from '../src/features/closingExtensions/ClosingExtensionControl';
import { extensionDateBounds, validateClosingExtension } from '../src/features/closingExtensions/model';
const props = { month: '2026-10-01', userId: 'u', canManage: true, closed: false, ready: true, onSaved: vi.fn(async () => {}) };
function show(overrides = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return Object.assign(render(<QueryClientProvider client={client}><ClosingExtensionControl {...props} {...overrides} /></QueryClientProvider>), { client });
}
beforeEach(() => { vi.resetAllMocks(); mocks.fetch.mockResolvedValue(null); mocks.save.mockResolvedValue({ assigned_count: 0 }); });
afterEach(cleanup);
it('saves a selected month/date/reason with no fixed explanatory paragraph', async () => {
  show(); const button = screen.getByRole('button', { name: 'تمديد فترة الإقفال' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button);
  expect(screen.getByLabelText('شهر الإقفال')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('احتساب المسددات حتى نهاية يوم'), { target: { value: '2026-11-01' } });
  fireEvent.change(screen.getByLabelText('سبب التمديد'), { target: { value: 'إجازة رسمية' } });
  expect(screen.queryByText(/دون تغيير قواعد العمولات/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التمديد' }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('2026-10-01','2026-11-01','إجازة رسمية',null));
  await waitFor(() => expect(props.onSaved).toHaveBeenCalledOnce());
});
it('uses the previous end date to prevent overwriting a concurrent company decision', async () => {
  mocks.fetch.mockResolvedValue({ id: 'e', month: props.month, extended_until: '2026-11-01', reason: 'إجازة' });
  mocks.save.mockRejectedValue({ message: 'تغيّرت إعدادات التمديد؛ حدّث الصفحة ثم أعد المحاولة' });
  show(); await screen.findByText(/ممتد حتى نهاية/);
  fireEvent.click(screen.getByRole('button', { name: 'تمديد فترة الإقفال' }));
  fireEvent.change(screen.getByLabelText('احتساب المسددات حتى نهاية يوم'), { target: { value: '2026-11-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التمديد' }));
  await screen.findByRole('alert'); expect(mocks.save).toHaveBeenCalledWith(props.month,'2026-11-02','إجازة','2026-11-01');
});
it('does not offer a write action to an unauthorized viewer or an approved month', async () => {
  const view = show({ canManage: false }); expect(screen.queryByRole('button', { name: 'تمديد فترة الإقفال' })).toBeNull(); view.unmount();
  show({ closed: true }); await waitFor(() => expect((screen.getByRole('button', { name: 'تمديد فترة الإقفال' }) as HTMLButtonElement).disabled).toBe(true));
});
it('supports any month including year-end and leap years, and rejects invalid dates', () => {
  expect(extensionDateBounds('2026-12-01')).toEqual({ min: '2027-01-01', max: '2027-01-31' });
  expect(extensionDateBounds('2028-01-01')).toEqual({ min: '2028-02-01', max: '2028-02-29' });
  expect(validateClosingExtension('2026-10-01','2026-11-01','عيد')).toBeNull();
  expect(validateClosingExtension('2026-10-01','2026-10-31','عيد')).not.toBeNull();
  expect(validateClosingExtension('2026-10-01','2026-12-01','عيد')).not.toBeNull();
  expect(validateClosingExtension('2026-10-01','2026-11-31','عيد')).not.toBeNull();
});

it('retains the decision version seen when the editor opened even if a background refetch occurs', async () => {
  mocks.fetch.mockResolvedValue({ id: 'e', month: props.month, extended_until: '2026-11-01', reason: 'إجازة' });
  const view = show(); await screen.findByText(/ممتد حتى نهاية/);
  fireEvent.click(screen.getByRole('button', { name: 'تمديد فترة الإقفال' }));
  mocks.fetch.mockResolvedValue({ id: 'e', month: props.month, extended_until: '2026-11-02', reason: 'قرار آخر' });
  await act(async () => { await view.client.invalidateQueries(); });
  fireEvent.change(screen.getByLabelText('احتساب المسددات حتى نهاية يوم'), { target: { value: '2026-11-03' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التمديد' }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(props.month,'2026-11-03','إجازة','2026-11-01'));
});
