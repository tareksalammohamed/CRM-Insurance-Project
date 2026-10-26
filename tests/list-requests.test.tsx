import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../src/lib/supabase';
const mocks = vi.hoisted(() => ({ customers: vi.fn(), policies: vi.fn(), agents: vi.fn(), customerStats: vi.fn(), policyStats: vi.fn(), customerIds: vi.fn(), policyIds: vi.fn() }));
vi.mock('../src/pages/Customers/services/customersService', () => ({ fetchCustomersPage: mocks.customers, fetchAgentsForCurrentUser: mocks.agents, fetchCustomerStats: mocks.customerStats, computeDeletableCustomerIds: mocks.customerIds }));
vi.mock('../src/pages/Policies/services/policiesService', () => ({ fetchPoliciesPage: mocks.policies, fetchPolicyStats: mocks.policyStats, computeDeletablePolicyIds: mocks.policyIds }));
vi.mock('../src/hooks/useReconnectRefetch', () => ({ useReconnectRefetch: vi.fn() }));
import { useCustomers } from '../src/pages/Customers/hooks/useCustomers';
import { usePolicies } from '../src/pages/Policies/hooks/usePolicies';
const user = { id: 'u1', role: 'supervisor' } as User;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.agents.mockResolvedValue([]); mocks.customerStats.mockResolvedValue({ total: 2 }); mocks.policyStats.mockResolvedValue({ total: 2 });
  mocks.customerIds.mockResolvedValue(new Set()); mocks.policyIds.mockResolvedValue(new Set());
});
afterEach(cleanup);
describe('latest list results and independent lookups', () => {
  it('ignores a slow old customer search and does not reload agents', async () => {
    const first = deferred<unknown>(); const second = deferred<unknown>();
    mocks.customers.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ search }) => useCustomers(user, 1, search, 'all', 'all', 'all'), { initialProps: { search: 'old' } });
    await waitFor(() => expect(mocks.customers).toHaveBeenCalledTimes(1));
    rerender({ search: 'new' });
    await act(async () => second.resolve({ customers: [{ id: 'new' }], totalCount: 1, totalPages: 1 }));
    await act(async () => first.resolve({ customers: [{ id: 'old' }], totalCount: 99, totalPages: 10 }));
    expect(result.current.customers[0].id).toBe('new'); expect(result.current.totalCount).toBe(1);
    expect(mocks.agents).toHaveBeenCalledTimes(1); expect(mocks.customerStats).toHaveBeenCalledTimes(1);
  });
  it('ignores old policy results after changing branches', async () => {
    const first = deferred<unknown>(); const second = deferred<unknown>();
    mocks.policies.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ branch }) => usePolicies(user, 1, '', 'all', 'all', 'all', branch), { initialProps: { branch: 'a' } });
    await waitFor(() => expect(mocks.policies).toHaveBeenCalledTimes(1));
    rerender({ branch: 'b' });
    await act(async () => second.resolve({ policies: [{ id: 'b' }], totalCount: 1, totalPages: 1 }));
    await act(async () => first.resolve({ policies: [{ id: 'a' }], totalCount: 9, totalPages: 9 }));
    expect(result.current.policies[0].id).toBe('b'); expect(result.current.totalPages).toBe(1);
  });
  it('does not let an old permission lookup enable deletion in the new list', async () => {
    const permissions = deferred<Set<string>>();
    mocks.customerIds.mockReturnValueOnce(permissions.promise).mockResolvedValue(new Set(['new']));
    mocks.customers.mockResolvedValueOnce({ customers: [{ id: 'old' }], totalCount: 1, totalPages: 1 }).mockResolvedValueOnce({ customers: [{ id: 'new' }], totalCount: 1, totalPages: 1 });
    const { result, rerender } = renderHook(({ search }) => useCustomers(user, 1, search, 'all', 'all', 'all'), { initialProps: { search: 'old' } });
    await waitFor(() => expect(mocks.customerIds).toHaveBeenCalledTimes(1)); rerender({ search: 'new' });
    await waitFor(() => expect(result.current.deletableIds.has('new')).toBe(true));
    await act(async () => permissions.resolve(new Set(['old'])));
    expect(result.current.deletableIds).toEqual(new Set(['new']));
  });
  it('keeps cached-read messages visible and supports retry', async () => {
    mocks.policies.mockResolvedValueOnce({ policies: [], totalCount: 0, totalPages: 1, loadMessage: 'نسخة محفوظة' }).mockResolvedValueOnce({ policies: [], totalCount: 0, totalPages: 1, loadMessage: null });
    const { result } = renderHook(() => usePolicies(user, 1, '', 'all', 'all', 'all'));
    await waitFor(() => expect(result.current.loadMessage).toBe('نسخة محفوظة'));
    await act(async () => result.current.loadPolicies()); expect(result.current.loadMessage).toBeNull();
  });
  it('invalidates pending requests on unmount', async () => {
    const pending = deferred<unknown>(); mocks.policies.mockReturnValue(pending.promise);
    const { unmount } = renderHook(() => usePolicies(user, 1, '', 'all', 'all', 'all'));
    unmount(); await act(async () => pending.resolve({ policies: [{ id: 'late' }], totalPages: 1, totalCount: 1 }));
    expect(mocks.policyIds).not.toHaveBeenCalled();
  });
});
