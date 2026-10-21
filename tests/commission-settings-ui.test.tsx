import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), invalidated: vi.fn(), saved: vi.fn().mockResolvedValue({ data: { effective_from: '2999-01-01' }, error: null }) }));
vi.mock('../src/features/commissionSettings/useCommissionRates', () => ({ useCommissionRates: () => ({ data: [{ effective_from: '1900-01-01', year1_percent: 2.2, renewal_percent: 0.05 }], isError: false, isLoading: false, refetch: vi.fn() }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidated }) }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: () => ({ upsert: (value: unknown) => { mocks.upsert(value); return { select: () => ({ single: mocks.saved }) }; } }) } }));
import { CommissionSettings } from '../src/features/commissionSettings/CommissionSettings';
afterEach(() => { cleanup(); mocks.upsert.mockClear(); mocks.invalidated.mockClear(); });
it('saves exactly the entered percentages and future effective date', async () => {
  render(<CommissionSettings />);
  fireEvent.change(screen.getByLabelText('السنة الأولى (%)'), { target: { value: '3.5' } });
  fireEvent.change(screen.getByLabelText('الثانية والثالثة (%)'), { target: { value: '0.1' } });
  fireEvent.change(screen.getByLabelText('يسري على السداد من'), { target: { value: '2999-01-01' } });
  fireEvent.submit(screen.getByRole('button', { name: 'حفظ نسب العمولات' }).closest('form')!);
  await waitFor(() => expect(mocks.invalidated).toHaveBeenCalled());
  expect(mocks.upsert).toHaveBeenCalledWith({ effective_from: '2999-01-01', year1_percent: 3.5, renewal_percent: 0.1 });
});
it('prevents historical rate changes before sending a request', async () => {
  render(<CommissionSettings />);
  fireEvent.change(screen.getByLabelText('يسري على السداد من'), { target: { value: '2020-01-01' } });
  fireEvent.submit(screen.getByRole('button', { name: 'حفظ نسب العمولات' }).closest('form')!);
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toContain('لحماية العمولات السابقة');
});
