import { expect, it, vi, beforeEach } from 'vitest';
const { from, insert, maybeSingle, update, selectResult } = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(), selectResult: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from } }));
vi.mock('../src/lib/dataAccessLayer', () => ({ dalRead: vi.fn(), readStatusMessage: vi.fn() }));
vi.mock('../src/lib/branchHierarchy', () => ({ fetchUserSubtreeIdsBranchAware: vi.fn() }));
import { saveFollowup, closeFollowup, type FollowupInsert } from '../src/features/customerFollowup/service';
const row: FollowupInsert = { id: 'operation', customer_id: 'customer', kind: 'contact', outcome: 'reached', notes: 'اتصال', next_action: null, next_date: null, policy_id: null, installment_id: null, payment_month: null };
beforeEach(() => {
  vi.resetAllMocks();
  const read = { eq: vi.fn().mockReturnThis(), maybeSingle };
  const write = { eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), select: selectResult };
  update.mockReturnValue(write);
  from.mockReturnValue({ insert, select: vi.fn(() => read), update });
});
it('recognizes a committed save after an acknowledgement failure without creating a second operation', async () => {
  insert.mockResolvedValue({ error: { code: 'P0001', message: 'القسط مسدد بالفعل؛ لا يحتاج وعد سداد' } });
  maybeSingle.mockResolvedValue({ data: { ...row, created_at: 'date' }, error: null });
  await expect(saveFollowup(row)).resolves.toBeUndefined();
  expect(insert).toHaveBeenCalledExactlyOnceWith(row);
  expect(from.mock.calls.every(([table]) => table === 'customer_followups')).toBe(true);
});
it('reports a different open promise instead of treating a unique conflict as success', async () => {
  insert.mockResolvedValue({ error: { code: '23505' } });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(saveFollowup(row)).rejects.toThrow('يوجد وعد مفتوح');
});
it('recognizes an already committed closure, without writing any settlement fields', async () => {
  selectResult.mockResolvedValue({ data: [], error: null });
  maybeSingle.mockResolvedValue({ data: { closed_at: 'date', close_note: 'تأجيل' }, error: null });
  await expect(closeFollowup('id', ' تأجيل ')).resolves.toBeUndefined();
  expect(update).toHaveBeenCalledExactlyOnceWith({ close_note: 'تأجيل' });
  expect(from.mock.calls.every(([table]) => table === 'customer_followups')).toBe(true);
});
