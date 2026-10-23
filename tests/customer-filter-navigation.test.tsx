import type { ReactNode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useCustomerFilters } from '../src/pages/Customers/hooks/useCustomerFilters';
afterEach(cleanup);
const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;
it('opens and clears the no-policy queue from URL navigation without losing the search', () => {
  const { result } = renderHook(() => ({ ...useCustomerFilters(), navigate: useNavigate() }), { wrapper });
  act(() => result.current.navigate('/customers?noPolicy=1&search=test'));
  expect(result.current.noPolicyOnly).toBe(true);
  act(() => result.current.handleToggleNoPolicyOnly());
  expect(result.current.noPolicyOnly).toBe(false);
  expect(result.current.searchQuery).toBe('test');
  act(() => result.current.navigate(-1));
  expect(result.current.noPolicyOnly).toBe(true);
});
it('switches between issuance and expired requests without intersecting the two queues', () => {
  const { result } = renderHook(() => ({ ...useCustomerFilters(), navigate: useNavigate() }), { wrapper });
  act(() => result.current.navigate('/customers?noPolicy=1'));
  act(() => result.current.setStatusDraft('expired'));
  act(() => result.current.handleApplyFilters());
  expect(result.current.noPolicyOnly).toBe(false);
  expect(result.current.statusFilter).toBe('expired');
  act(() => result.current.handleToggleNoPolicyOnly());
  expect(result.current.noPolicyOnly).toBe(true);
  expect(result.current.statusFilter).toBe('all');
});
