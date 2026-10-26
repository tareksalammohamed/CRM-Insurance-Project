import { expect, it, vi, beforeEach } from 'vitest';
const queue = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/offlineQueue', () => ({ getQueueItems: queue }));
import { confirmQueuedSignOut } from '../src/lib/confirmQueuedSignOut';
beforeEach(() => { queue.mockReset(); });
it('does not prompt for another account’s operations', async () => {
  queue.mockResolvedValue([{ userId: 'other' }]);
  const confirm = vi.fn();
  expect(await confirmQueuedSignOut('me', confirm)).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
});
it('allows staying without deleting anything and explains pending/failed counts', async () => {
  const rows = [{ userId: 'me', lastError: 'error' }, { userId: 'me' }, { userId: 'other' }];
  queue.mockResolvedValue(rows);
  const confirm = vi.fn().mockResolvedValue(false);
  expect(await confirmQueuedSignOut('me', confirm)).toBe(false);
  expect(confirm.mock.calls[0][0].message).toContain('2');
  expect(confirm.mock.calls[0][0].message).toContain('1');
  expect(rows).toHaveLength(3);
});
it('requires explicit confirmation and propagates queue-read failures', async () => {
  queue.mockResolvedValue([{ userId: 'me' }]);
  expect(await confirmQueuedSignOut('me', vi.fn().mockResolvedValue(true))).toBe(true);
  queue.mockRejectedValue(new Error('storage unavailable'));
  await expect(confirmQueuedSignOut('me', vi.fn())).rejects.toThrow('storage unavailable');
});
