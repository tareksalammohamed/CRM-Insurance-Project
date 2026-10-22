import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ customers: vi.fn(), collection: vi.fn(), branch: 'branch-a' }));
vi.mock('../src/lib/branchContext', () => ({ useBranchContext: () => ({ currentBranchId: mocks.branch }) }));
vi.mock('../src/pages/Customers/services/customersService', () => ({ fetchCustomerStats: mocks.customers }));
vi.mock('../src/pages/Collection/services/collectionService', () => ({ fetchCollectionQuickStats: mocks.collection }));
import { DashboardPriorities } from '../src/pages/Dashboard/components/DashboardPriorities';
import { useCustomerFilters } from '../src/pages/Customers/hooks/useCustomerFilters';
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.branch = 'branch-a';
  mocks.customers.mockReset().mockResolvedValue({ noPolicyCount: 7, readStatus: 'online' });
  mocks.collection.mockReset().mockResolvedValue({ readStatus: 'online', year2AttentionPoliciesCount: 12, year2OverduePoliciesCount: 4, collectedTodayAmount: 1000, collectedTodayCount: 2, year2CollectedMonthAmount: 3000, year2CollectedMonthCount: 6 });
});
afterEach(() => { cleanup(); client.clear(); });
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
it('uses scoped existing services and links to the intended queues', async () => {
  render(<DashboardPriorities userId="user-a" />, { wrapper });
  await waitFor(() => expect(screen.getByText('7')).toBeTruthy());
  expect(mocks.customers).toHaveBeenCalledWith('user-a', 'branch-a');
  expect(mocks.collection).toHaveBeenCalledWith('branch-a');
  expect(screen.getByRole('link', { name: /طلبات بدون وثائق/ }).getAttribute('href')).toBe('/customers?noPolicy=1');
  expect(screen.getByRole('link', { name: /تجديدات تحتاج/ }).getAttribute('href')).toBe('/collection?year=year2');
  expect(screen.getByText('مستقل عن التارجت والمحقق')).toBeTruthy();
});
it('does not turn unavailable reads into zero indicators', async () => {
  mocks.customers.mockResolvedValue({ noPolicyCount: 0, readStatus: 'offline-empty', loadMessage: 'تعذر الاتصال' });
  mocks.collection.mockResolvedValue({ readStatus: 'error', year2AttentionPoliciesCount: 0 });
  render(<DashboardPriorities userId="user-a" />, { wrapper });
  await waitFor(() => expect(screen.getAllByText('غير متاح')).toHaveLength(4));
  expect(screen.queryByText('0')).toBeNull();
  expect(screen.getByText('تعذر الاتصال')).toBeTruthy();
});
it('discards previous account and branch values while the new scope loads', async () => {
  const view = render(<DashboardPriorities userId="user-a" />, { wrapper });
  await waitFor(() => expect(screen.getByText('7')).toBeTruthy());
  mocks.branch = 'branch-b';
  mocks.customers.mockImplementation(() => new Promise(() => {}));
  mocks.collection.mockImplementation(() => new Promise(() => {}));
  view.rerender(<DashboardPriorities userId="user-b" />);
  expect(screen.queryByText('7')).toBeNull();
  await waitFor(() => expect(mocks.customers).toHaveBeenLastCalledWith('user-b', 'branch-b'));
});
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
