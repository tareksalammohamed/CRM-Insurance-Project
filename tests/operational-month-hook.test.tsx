vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: async (_key: string, read: () => Promise<unknown>) => ({ data: await read(), status: 'online', cachedAt: Date.now() }) }));
import { useOperationalMonth } from '../src/features/closingExtensions/useOperationalMonth';
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const clock = (month: string, until: string | null = '2026-11-01', expiry = '2026-11-01T22:00:00Z') => ({ data: [{ reporting_month: month, calendar_month: '2026-11-01', cairo_date: until ? '2026-11-01' : '2026-11-02', extended_until: until, server_now: new Date().toISOString(), valid_until: expiry }], error: null });
const flush = async (ms = 20) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T21:59:59Z')); vi.resetAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); });
afterEach(() => { cleanup(); client.clear(); vi.useRealTimers(); });
it('holds the extended month and rolls automatically at Cairo midnight while the device UTC date is still November 1', async () => {
  mocks.rpc.mockImplementation(async () => Date.now() < Date.parse('2026-11-01T22:00:00Z') ? clock('2026-10-01') : clock('2026-11-01', null, '2026-11-02T22:00:00Z'));
  const { result } = renderHook(() => useOperationalMonth('user'), { wrapper });
  expect(result.current.ready).toBe(false); await flush();
  expect(result.current.automaticKey).toBe('2026-10-01'); expect(result.current.ready).toBe(true);
  await flush(1100);
  expect(result.current.automaticKey).toBe('2026-11-01'); expect(result.current.ready).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledTimes(2);
});
it('preserves explicit historical choices across rollover and returns to the operational current month on reset', async () => {
  mocks.rpc.mockImplementation(async () => Date.now() < Date.parse('2026-11-01T22:00:00Z') ? clock('2026-10-01') : clock('2026-11-01', null, '2026-11-02T22:00:00Z'));
  const { result } = renderHook(() => useOperationalMonth('user'), { wrapper }); await flush();
  act(() => result.current.setSelectedMonth(new Date(2026, 8, 1))); await flush(1100);
  expect(result.current.selectedKey).toBe('2026-09-01'); expect(result.current.isCurrentMonth).toBe(false);
  act(() => result.current.resetMonth()); expect(result.current.selectedKey).toBe('2026-11-01');
});
it('does not guess a new month when the clock read fails after expiry', async () => {
  mocks.rpc.mockResolvedValueOnce(clock('2026-10-01')).mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useOperationalMonth('user'), { wrapper }); await flush(); await flush(1100);
  expect(result.current.ready).toBe(false); expect(result.current.error).toContain('تعذر تحديد شهر العمل');
});
it('deduplicates callers and keeps the selected Date stable on same-month refreshes', async () => {
  mocks.rpc.mockResolvedValue(clock('2026-10-01'));
  const { result } = renderHook(() => ({ first: useOperationalMonth('user'), second: useOperationalMonth('user') }), { wrapper }); await flush();
  expect(mocks.rpc).toHaveBeenCalledTimes(1); const date = result.current.first.selectedMonth;
  mocks.rpc.mockResolvedValue(clock('2026-10-01'));
  await act(async () => { await client.invalidateQueries(); }); await flush();
  expect(result.current.first.selectedMonth).toBe(date);
});
it('keeps ordinary months unchanged and does not carry manual state to another account', async () => {
  mocks.rpc.mockResolvedValue(clock('2026-11-01', null));
  const { result, rerender } = renderHook(({ user }) => useOperationalMonth(user), { initialProps: { user: 'a' }, wrapper }); await flush();
  expect(result.current.automaticKey).toBe('2026-11-01');
  act(() => result.current.setSelectedMonth(new Date(2026, 7, 1))); rerender({ user: 'b' });
  expect(result.current.ready).toBe(false); await flush();
  expect(result.current.selectedKey).toBe('2026-11-01');
});
it('returns to automatic rollover when the manually selected month becomes the newly extended current month', async () => {
  let extended = false;
  mocks.rpc.mockImplementation(async () => {
    if (Date.now() >= Date.parse('2026-11-01T22:00:00Z')) return clock('2026-11-01', null, '2026-11-02T22:00:00Z');
    return extended ? clock('2026-10-01') : clock('2026-11-01', null);
  });
  const { result } = renderHook(() => useOperationalMonth('user'), { wrapper }); await flush();
  act(() => result.current.setSelectedMonth(new Date(2026, 9, 1)));
  extended = true;
  await act(async () => { await client.invalidateQueries(); }); await flush();
  expect(result.current.selectedKey).toBe('2026-10-01'); expect(result.current.isCurrentMonth).toBe(true);
  await flush(1100);
  expect(result.current.selectedKey).toBe('2026-11-01');
});
it('immediately refreshes an expired Cairo day even when React Query considers the cached response fresh', async () => {
  vi.setSystemTime(new Date('2026-11-01T22:00:10Z'));
  client.setQueryData(['operational-month', 'user'], { ...clock('2026-10-01').data[0], expiresAt: Date.now() - 1000 });
  mocks.rpc.mockResolvedValue(clock('2026-11-01', null, '2026-11-02T22:00:00Z'));
  const { result } = renderHook(() => useOperationalMonth('user'), { wrapper });
  expect(result.current.ready).toBe(false); await flush();
  expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(result.current.selectedKey).toBe('2026-11-01'); expect(result.current.ready).toBe(true);
});
