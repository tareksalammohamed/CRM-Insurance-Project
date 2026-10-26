import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { User } from '../src/lib/supabase';
const mocks = vi.hoisted(() => ({ customerDelete: vi.fn(), policyDelete: vi.fn() }));
vi.mock('../src/hooks/useReconnectRefetch', () => ({ useReconnectRefetch: vi.fn() }));
vi.mock('../src/pages/Customers/services/customersService', () => ({
  fetchCustomersPage: async () => ({ customers: [{ id: 'c' }], totalPages: 1, totalCount: 1 }),
  computeDeletableCustomerIds: mocks.customerDelete, fetchCustomerStats: async () => ({}), fetchAgentsForCurrentUser: async () => [],
}));
vi.mock('../src/pages/Policies/services/policiesService', () => ({
  fetchPoliciesPage: async () => ({ policies: [{ id: 'p' }], totalPages: 1, totalCount: 1 }),
  computeDeletablePolicyIds: mocks.policyDelete, fetchPolicyStats: async () => ({}),
}));
import { useCustomers } from '../src/pages/Customers/hooks/useCustomers';
import { usePolicies } from '../src/pages/Policies/hooks/usePolicies';
const user = { id: 'u', role: 'agent' } as User;
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });
it('finishes customer list loading before deletion checks while keeping delete unavailable', async () => {
  let finish!: (value: Set<string>) => void;
  mocks.customerDelete.mockReturnValue(new Promise<Set<string>>(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useCustomers(user, 1, '', 'all', 'all', 'all'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.customers[0].id).toBe('c'); expect(result.current.deletableIds.size).toBe(0);
  await act(async () => finish(new Set(['c'])));
  expect(result.current.deletableIds.has('c')).toBe(true);
});
it('finishes policy list loading before deletion checks while keeping delete unavailable', async () => {
  let finish!: (value: Set<string>) => void;
  mocks.policyDelete.mockReturnValue(new Promise<Set<string>>(resolve => { finish = resolve; }));
  const { result } = renderHook(() => usePolicies(user, 1, '', 'all', 'all', 'all'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.policies[0].id).toBe('p'); expect(result.current.deletableIds.size).toBe(0);
  await act(async () => finish(new Set(['p'])));
  expect(result.current.deletableIds.has('p')).toBe(true);
});
