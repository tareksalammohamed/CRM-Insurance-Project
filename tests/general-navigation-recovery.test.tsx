vi.mock('../src/lib/networkManager', () => ({ isOnline: () => true }));
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { Pagination } from '../src/components/ui/Pagination';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Page({ fail = false }: { fail?: boolean }) { if (fail) throw new Error('render failed'); return <p>صفحة سليمة</p>; }
it('recovers on a different route while retaining an error on the same route', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { rerender } = render(<ErrorBoundary boundaryName="/customers"><Page fail /></ErrorBoundary>);
  expect(screen.getByText('حدث خطأ غير متوقع')).toBeTruthy();
  rerender(<ErrorBoundary boundaryName="/customers"><Page /></ErrorBoundary>);
  expect(screen.queryByText('صفحة سليمة')).toBeNull();
  rerender(<ErrorBoundary boundaryName="/collection"><Page /></ErrorBoundary>);
  expect(screen.getByText('صفحة سليمة')).toBeTruthy();
});
it('supports an explicit retry on the same route', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { rerender } = render(<ErrorBoundary boundaryName="/customers"><Page fail /></ErrorBoundary>);
  rerender(<ErrorBoundary boundaryName="/customers"><Page /></ErrorBoundary>);
  fireEvent.click(screen.getByText('إعادة المحاولة'));
  expect(screen.getByText('صفحة سليمة')).toBeTruthy();
});
it('jumps directly to a valid page without generating thousands of controls', () => {
  const change = vi.fn(); render(<Pagination page={3} totalPages={10000} onPageChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: /الانتقال لرقم صفحة/ }));
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '8000' } });
  fireEvent.submit(input.closest('form')!);
  expect(change).toHaveBeenCalledOnce(); expect(change.mock.calls[0][0](3)).toBe(8000);
  expect(screen.queryByRole('spinbutton')).toBeNull();
});
it('rejects out-of-range and fractional pages and allows cancelling', () => {
  const change = vi.fn(); render(<Pagination page={3} totalPages={10} onPageChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: /الانتقال لرقم صفحة/ }));
  const input = screen.getByRole('spinbutton');
  for (const value of ['0', '11', '2.5', '']) { fireEvent.change(input, { target: { value } }); fireEvent.submit(input.closest('form')!); }
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('إلغاء')); expect(screen.queryByRole('spinbutton')).toBeNull();
});
