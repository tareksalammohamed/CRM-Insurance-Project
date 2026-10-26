const logoutGuard = vi.hoisted(() => ({ confirm: vi.fn(), error: vi.fn(), items: vi.fn(), clear: vi.fn() }));
vi.mock('../src/lib/notify', () => ({ useNotify: () => ({ confirm: logoutGuard.confirm, error: logoutGuard.error }) }));
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), profile: vi.fn(), clear: vi.fn(), stopSync: vi.fn(), signOut: vi.fn(), identity: vi.fn(), handler: null as null | ((event: AuthChangeEvent, session: Session | null) => void) }));
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getSession: mocks.getSession, onAuthStateChange: (callback: typeof mocks.handler) => { mocks.handler = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; }, signOut: mocks.signOut },
  rpc: mocks.profile, from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
}, WEBAUTHN_FUNCTIONS_URL: 'https://example.test' }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: async (_key: string, fetcher: () => Promise<unknown>) => ({ data: await fetcher(), status: 'online' }) }));
vi.mock('../src/lib/dataCache', () => ({ clearAllDataCache: vi.fn(), setDataCacheIdentity: mocks.identity }));
vi.mock('../src/lib/offlineQueue', () => ({ clearAllQueueItems: logoutGuard.clear, getQueueItems: logoutGuard.items }));
vi.mock('../src/lib/queryClient', () => ({ queryClient: { clear: mocks.clear } }));
vi.mock('../src/lib/offlineSync', () => ({ stopOfflineSync: mocks.stopSync }));
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const session = (id: string) => ({ user: { id }, access_token: 'test' }) as Session;
beforeEach(() => { vi.clearAllMocks(); logoutGuard.items.mockResolvedValue([]); logoutGuard.confirm.mockResolvedValue(false); mocks.getSession.mockResolvedValue({ data: { session: null } }); mocks.signOut.mockResolvedValue({ error: null }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('does not restore a slow profile after signing out', async () => {
  const { result } = renderHook(useAuth, { wrapper }); await waitFor(() => expect(result.current.loading).toBe(false));
  let resolve!: (value: unknown) => void; mocks.profile.mockReturnValue(new Promise((done) => { resolve = done; }));
  act(() => mocks.handler!('SIGNED_IN', session('a'))); await waitFor(() => expect(mocks.profile).toHaveBeenCalled());
  await act(async () => result.current.signOut()); await act(async () => resolve({ data: [{ id: 'a', role: 'agent' }], error: null }));
  expect(result.current.user).toBeNull(); expect(result.current.session).toBeNull(); expect(mocks.clear).toHaveBeenCalled();
});
it('does not allow bootstrap to overwrite a newer signed-out event', async () => {
  let resolve!: (value: unknown) => void; mocks.getSession.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result } = renderHook(useAuth, { wrapper });
  act(() => mocks.handler!('SIGNED_OUT', null));
  await act(async () => resolve({ data: { session: session('old') } }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.user).toBeNull(); expect(result.current.session).toBeNull(); expect(mocks.profile).not.toHaveBeenCalled();
});
it('preserves the current profile during token refresh without refetch', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: session('a') } }); mocks.profile.mockResolvedValue({ data: [{ id: 'a', role: 'agent' }], error: null });
  const { result } = renderHook(useAuth, { wrapper }); await waitFor(() => expect(result.current.user?.id).toBe('a'));
  const before = result.current.user; mocks.profile.mockClear();
  act(() => mocks.handler!('TOKEN_REFRESHED', session('a')));
  expect(result.current.user).toBe(before); expect(mocks.profile).not.toHaveBeenCalled();
});
it('ignores a profile from the account replaced by a newer sign-in', async () => {
  const { result } = renderHook(useAuth, { wrapper }); await waitFor(() => expect(result.current.loading).toBe(false));
  let resolveA!: (value: unknown) => void;
  mocks.profile.mockReturnValueOnce(new Promise((done) => { resolveA = done; })).mockResolvedValueOnce({ data: [{ id: 'b', role: 'agent' }], error: null });
  act(() => mocks.handler!('SIGNED_IN', session('a'))); await waitFor(() => expect(mocks.profile).toHaveBeenCalledTimes(1));
  act(() => mocks.handler!('SIGNED_IN', session('b'))); await waitFor(() => expect(result.current.user?.id).toBe('b'));
  await act(async () => resolveA({ data: [{ id: 'a', role: 'agent' }], error: null }));
  expect(result.current.user?.id).toBe('b'); expect(mocks.identity).toHaveBeenLastCalledWith('b');
});
it('shows a recoverable profile error and clears it on retry', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: session('a') } });
  mocks.profile.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [{ id: 'a', role: 'agent' }], error: null });
  const { result } = renderHook(useAuth, { wrapper }); await waitFor(() => expect(result.current.authError).toContain('تعذر تحميل'));
  expect(result.current.session?.user.id).toBe('a'); await act(async () => result.current.refreshUser());
  expect(result.current.user?.id).toBe('a'); expect(result.current.authError).toBeNull();
});

it('keeps the session and queued operations when the user cancels sign-out', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: session('a') } });
  mocks.profile.mockResolvedValue({ data: [{ id: 'a', role: 'agent' }], error: null });
  const { result } = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(result.current.user?.id).toBe('a'));
  logoutGuard.items.mockResolvedValue([{ userId: 'a' }]);
  await act(async () => result.current.signOut());
  expect(result.current.user?.id).toBe('a');
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(logoutGuard.clear).not.toHaveBeenCalled();
});
it('clears the session and local queue only after explicit discard confirmation', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: session('a') } });
  mocks.profile.mockResolvedValue({ data: [{ id: 'a', role: 'agent' }], error: null });
  const { result } = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(result.current.user?.id).toBe('a'));
  logoutGuard.items.mockResolvedValue([{ userId: 'a' }]);
  logoutGuard.confirm.mockResolvedValue(true);
  await act(async () => result.current.signOut());
  expect(result.current.user).toBeNull();
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(logoutGuard.clear).toHaveBeenCalledOnce();
});
it('does not restart dependent page loads when repeated sign-in returns an unchanged profile', async () => {
  const profile = { id: 'a', role: 'agent', name: 'Name' };
  mocks.getSession.mockResolvedValue({ data: { session: session('a') } });
  mocks.profile.mockImplementation(async () => ({ data: [{ ...profile }], error: null }));
  const { result } = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(result.current.user?.id).toBe('a'));
  const before = result.current.user; mocks.profile.mockClear();
  act(() => mocks.handler!('SIGNED_IN', session('a')));
  await waitFor(() => expect(mocks.profile).toHaveBeenCalledOnce());
  await act(async () => { await Promise.resolve(); });
  expect(result.current.user).toBe(before);
  mocks.profile.mockResolvedValue({ data: [{ ...profile, role: 'supervisor' }], error: null });
  act(() => mocks.handler!('USER_UPDATED', session('a')));
  await waitFor(() => expect(result.current.user?.role).toBe('supervisor'));
  expect(result.current.user).not.toBe(before);
});
