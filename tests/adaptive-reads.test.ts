import { afterEach, expect, it, vi } from 'vitest';
import { createReadQueue, readConcurrency } from '../src/lib/adaptiveReads';
const connection = Object.getOwnPropertyDescriptor(navigator, 'connection');
afterEach(() => { if (connection) Object.defineProperty(navigator, 'connection', connection); else Reflect.deleteProperty(navigator, 'connection'); });
const deferred = () => { let resolve!: () => void; return { promise: new Promise<void>(done => { resolve = done; }), finish: () => resolve() }; };
it('loads the primary section first and serializes secondary sections on a slow connection', async () => {
  const q = createReadQueue(() => 1); const main = deferred(); const stats = deferred(); const calls: string[] = [];
  const secondary = q.read(async () => { calls.push('stats'); await stats.promise; }, 1);
  const primary = q.read(async () => { calls.push('list'); await main.promise; }, 0);
  const extra = q.read(async () => { calls.push('delete'); }, 2);
  await vi.waitFor(() => expect(calls).toEqual(['list']));
  main.finish(); await primary;
  await vi.waitFor(() => expect(calls).toEqual(['list', 'stats']));
  stats.finish(); await secondary; await extra;
  expect(calls).toEqual(['list', 'stats', 'delete']);
});
it('uses parallel reads when fast, and reduces queued concurrency when the connection slows', async () => {
  let budget = 2; const q = createReadQueue(() => budget); const a = deferred(); const b = deferred(); const calls: string[] = [];
  const first = q.read(async () => { calls.push('a'); await a.promise; });
  const second = q.read(async () => { calls.push('b'); await b.promise; });
  const third = q.read(async () => { calls.push('c'); });
  await vi.waitFor(() => expect(calls).toEqual(['a','b']));
  budget = 1; a.finish(); await first;
  await Promise.resolve(); expect(calls).toEqual(['a','b']);
  b.finish(); await second; await third; expect(calls).toEqual(['a','b','c']);
});
it('cancels obsolete queued work without interrupting active reads or poisoning the queue', async () => {
  const q = createReadQueue(() => 1); const main = deferred(); const task = vi.fn();
  const active = q.read(() => main.promise, 0);
  const obsolete = q.read(task, 1).catch(error => error.name);
  await Promise.resolve(); await Promise.resolve(); q.cancelPending();
  expect(await obsolete).toBe('AbortError'); expect(task).not.toHaveBeenCalled();
  main.finish(); await active;
  expect(await q.read(async () => 'next visit')).toBe('next visit');
  await expect(q.read(task, 0, () => false)).rejects.toHaveProperty('name', 'AbortError');
  expect(task).not.toHaveBeenCalled();
});
it('uses slow/save-data hints and falls back safely where connection information is unsupported', () => {
  Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '2g' } }); expect(readConcurrency()).toBe(1);
  Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '4g', saveData: true } }); expect(readConcurrency()).toBe(1);
  Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '4g', rtt: 50, downlink: 10 } }); expect(readConcurrency()).toBe(4);
  Reflect.deleteProperty(navigator, 'connection'); expect(readConcurrency()).toBe(2);
});
it('releases the slot after a failed read so later sections can still load', async () => {
  const q = createReadQueue(() => 1);
  const failed = q.read(async () => { throw new Error('network'); }, 0).catch(error => error.message);
  const next = q.read(async () => 'secondary', 1);
  expect(await failed).toBe('network'); expect(await next).toBe('secondary');
});
