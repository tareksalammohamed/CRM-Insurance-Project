vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCustomerActions } from '../src/pages/Customers/hooks/useCustomerActions';
import { usePolicyActions } from '../src/pages/Policies/hooks/usePolicyActions';
import type { User } from '../src/lib/supabase';
vi.mock('../src/lib/notify', () => ({ useNotify: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock('../src/pages/Customers/services/customersService', () => ({ fetchCustomerById: async () => ({ id: 'c', name: 'عميل', policies: [] }) }));
vi.mock('../src/pages/Policies/services/policiesService', () => ({
  fetchPolicyById: async () => ({ id: 'p', customer_id: 'c', policy_number: '100001', policy_type: 'quadruple', start_date: '2026-01-01', payment_method: 'monthly', premium_amount: 100 }),
  fetchCustomerForPicker: async () => ({ id: 'c', name: 'عميل', owner_id: 'u', insurance_amount: 100000, payment_method: 'monthly' }),
}));
const user = { id: 'u', role: 'agent' } as User;
const reload = async () => {};
afterEach(cleanup);
function NavigationProbe() {
  const location = useLocation(), navigate = useNavigate();
  return <><output aria-label="current route">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>رجوع</button></>;
}
function CustomerIntent() {
  const [searchParams, setSearchParams] = useSearchParams();
  useCustomerActions({ user, searchParams, setSearchParams, loadCustomers: reload, loadStats: reload });
  return <NavigationProbe />;
}
function PolicyIntent() {
  const [searchParams, setSearchParams] = useSearchParams();
  usePolicyActions({ user, searchParams, setSearchParams, loadPolicies: reload, loadStats: reload });
  return <NavigationProbe />;
}
it.each([
  ['customer', '/customers?search=kept&open=c', '/customers?search=kept'],
  ['customer', '/customers?search=kept&new=1', '/customers?search=kept'],
  ['policy', '/policies?search=kept&edit=p', '/policies?search=kept'],
  ['policy', '/policies?search=kept&new_for_customer=c', '/policies?search=kept'],
])('consumes the %s intent %s without trapping Back or dropping the list filter', async (kind, destination, consumed) => {
  render(<MemoryRouter initialEntries={['/collection', destination]} initialIndex={1}>{kind === 'customer' ? <CustomerIntent /> : <PolicyIntent />}</MemoryRouter>);
  await waitFor(() => expect(screen.getByLabelText('current route').textContent).toBe(consumed));
  fireEvent.click(screen.getByRole('button', { name: 'رجوع' }));
  await waitFor(() => expect(screen.getByLabelText('current route').textContent).toBe('/collection'));
});
