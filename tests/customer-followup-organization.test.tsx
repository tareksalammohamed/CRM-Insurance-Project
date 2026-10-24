import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('../src/lib/branchContext', () => ({ useBranchContext: () => ({ currentBranchId: null }) }));
vi.mock('../src/features/customerFollowup/FollowupList', () => ({ FollowupList: () => <p>سجل تجريبي</p> }));
vi.mock('../src/features/customerFollowup/service', () => ({ saveFollowup: vi.fn() }));
import { FollowupPanel } from '../src/features/customerFollowup/FollowupPanel';
afterEach(cleanup);
it('opens history first and preserves an unfinished note when switching sections or collapsing', () => {
  render(<FollowupPanel customerId="customer" />);
  expect(screen.queryByText('سجل تجريبي')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /سجل متابعة العميل/ }));
  expect(screen.getByText('سجل تجريبي')).toBeTruthy();
  expect(screen.queryByLabelText('ماذا حدث في التواصل؟')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'إضافة متابعة' }));
  fireEvent.change(screen.getByLabelText('ماذا حدث في التواصل؟'), { target: { value: 'متابعة لم تكتمل' } });
  fireEvent.click(screen.getByRole('button', { name: 'السجل والمتابعات' }));
  fireEvent.click(screen.getByRole('button', { name: 'إضافة متابعة' }));
  expect((screen.getByLabelText('ماذا حدث في التواصل؟') as HTMLTextAreaElement).value).toBe('متابعة لم تكتمل');
  fireEvent.click(screen.getByRole('button', { name: /سجل متابعة العميل/ }));
  fireEvent.click(screen.getByRole('button', { name: /سجل متابعة العميل/ }));
  expect((screen.getByLabelText('ماذا حدث في التواصل؟') as HTMLTextAreaElement).value).toBe('متابعة لم تكتمل');
});
it('opens the payment promise form directly without loading hidden history', () => {
  render(<FollowupPanel customerId="customer" context={{ policyId: 'p', policyNumber: '123', installmentId: 'i' }} initiallyOpen />);
  expect(screen.getByLabelText('تفاصيل الاتفاق مع العميل')).toBeTruthy();
  expect(screen.queryByText('سجل تجريبي')).toBeNull();
});
