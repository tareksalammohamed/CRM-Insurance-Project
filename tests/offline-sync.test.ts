import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ queue: vi.fn(), remove: vi.fn(), failed: vi.fn(), notify: vi.fn(), pay: vi.fn(), cancel: vi.fn(), customer: vi.fn(), policy: vi.fn(), processed: vi.fn(), fresh: vi.fn() }));
vi.mock('../src/lib/offlineQueue', () => ({ getQueueItems: mocks.queue, removeQueueItem: mocks.remove, markQueueAttemptFailed: mocks.failed,
  notifySyncStarted: vi.fn(), notifySynced: mocks.notify, notifyConflict: vi.fn(), isOnline: () => true }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: (table: string) => {
  const query = { select: () => query, eq: () => query, maybeSingle: () => table === 'offline_operations' ? mocks.processed() : mocks.fresh(), insert: async () => ({ error: null }) };
  return query;
} } }));
vi.mock('../src/features/installments/installmentsService', () => ({ payInstallmentOnline: mocks.pay, cancelInstallmentPaymentOnline: mocks.cancel }));
vi.mock('../src/pages/Customers/services/customersService', () => ({ createCustomerOnline: mocks.customer }));
vi.mock('../src/pages/Policies/services/policiesService', () => ({ createPolicyOnline: mocks.policy }));
const item = { operationId: 'op1', userId: 'u1', type: 'pay_installment', createdAt: 1,
  payload: { installment: { id: 'i1' }, userId: 'u1', paymentDate: '2026-10-11' } };
async function setup() {
  const mod = await import('../src/lib/offlineSync');
  mocks.queue.mockResolvedValue([]); mod.initOfflineSync('u1');
  await vi.waitFor(() => expect(mocks.queue).toHaveBeenCalledOnce());
  await Promise.resolve(); mocks.queue.mockClear();
  return mod;
}
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.processed.mockResolvedValue({ data: null, error: null });
  mocks.fresh.mockResolvedValue({ data: { status: 'unpaid' }, error: null });
  mocks.pay.mockResolvedValue(undefined);
});
it('acquires the sync lock before reading IndexedDB', async () => {
  const mod = await setup(); let resolve!: (items: unknown[]) => void;
  mocks.queue.mockReturnValue(new Promise((done) => { resolve = done; }));
  const first = mod.processOfflineQueue(); const second = mod.processOfflineQueue();
  expect(mocks.queue).toHaveBeenCalledOnce(); resolve([item]); await Promise.all([first, second]);
  expect(mocks.pay).toHaveBeenCalledOnce(); expect(mocks.remove).toHaveBeenCalledOnce();
});
it('preserves a payment when reading its fresh status fails', async () => {
  const mod = await setup(); mocks.queue.mockResolvedValue([item]);
  mocks.fresh.mockResolvedValue({ data: null, error: { message: 'network unavailable' } });
  await mod.processOfflineQueue(); expect(mocks.pay).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.failed).toHaveBeenCalled();
});
it('preserves work when the duplicate-operation lookup fails', async () => {
  const mod = await setup(); mocks.queue.mockResolvedValue([item]); mocks.processed.mockResolvedValue({ data: null, error: { message: 'lookup failed' } });
  await mod.processOfflineQueue(); expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.failed).toHaveBeenCalled();
});
it('does not replay a queue captured before sign-out', async () => {
  const mod = await setup(); let resolve!: (items: unknown[]) => void;
  mocks.queue.mockReturnValue(new Promise((done) => { resolve = done; }));
  const running = mod.processOfflineQueue(); mod.stopOfflineSync(); resolve([item]); await running;
  expect(mocks.pay).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
});
it('stops dependent operations after a failed payment', async () => {
  const mod = await setup(); mocks.queue.mockResolvedValue([item, { ...item, operationId: 'op2', createdAt: 2 }]);
  mocks.pay.mockRejectedValue(new Error('request failed')); await mod.processOfflineQueue();
  expect(mocks.pay).toHaveBeenCalledOnce(); expect(mocks.remove).not.toHaveBeenCalled();
});
it('excludes another account from the queue', async () => {
  const mod = await setup(); mocks.queue.mockResolvedValue([{ ...item, userId: 'other' }]); await mod.processOfflineQueue();
  expect(mocks.pay).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
});
