import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ channel: vi.fn(), remove: vi.fn(), callback: null as null | ((status: string) => void) }));
vi.mock('../src/lib/supabase', () => ({ supabase: {
  channel: mocks.channel.mockImplementation(() => ({ subscribe: (callback: typeof mocks.callback) => { mocks.callback = callback; } })), removeChannel: mocks.remove,
} }));
vi.mock('../src/lib/offlineEvents', () => ({ emitOfflineEvent: vi.fn() }));
let cleanup: (() => void) | undefined;
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); mocks.channel.mockImplementation(() => ({ subscribe: (callback: typeof mocks.callback) => { mocks.callback = callback; } })); vi.useFakeTimers(); Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }); });
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
it('keeps one channel for multiple subscribers and cleans up at the last unsubscribe', async () => {
  const mod = await import('../src/lib/networkManager'); const first = mod.subscribeNetwork(vi.fn()); cleanup = mod.subscribeNetwork(vi.fn());
  expect(mocks.channel).toHaveBeenCalledOnce(); first(); expect(mocks.remove).not.toHaveBeenCalled(); cleanup(); cleanup = undefined; expect(mocks.remove).toHaveBeenCalledOnce();
});
it('does not create more channels after repeated socket errors', async () => {
  const mod = await import('../src/lib/networkManager'); cleanup = mod.subscribeNetwork(vi.fn());
  mocks.callback!('CHANNEL_ERROR'); mocks.callback!('CLOSED'); mocks.callback!('TIMED_OUT');
  await vi.advanceTimersByTimeAsync(20000); expect(mocks.channel).toHaveBeenCalledOnce(); expect(mod.isOnline()).toBe(true);
});
it('deduplicates simultaneous online, focus and polling probes', async () => {
  let resolve!: (value: { ok: boolean }) => void;
  const fetcher = vi.fn(() => new Promise((done) => { resolve = done; })); vi.stubGlobal('fetch', fetcher);
  const mod = await import('../src/lib/networkManager'); cleanup = mod.subscribeNetwork(vi.fn());
  window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus'));
  await vi.advanceTimersByTimeAsync(4000); expect(fetcher).toHaveBeenCalledOnce();
  resolve({ ok: true }); await vi.advanceTimersByTimeAsync(0); expect(mod.isOnline()).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
it('does not announce reconnected for a failed health endpoint', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  const mod = await import('../src/lib/networkManager'); cleanup = mod.subscribeNetwork(vi.fn());
  window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(0); expect(mod.isOnline()).toBe(false);
});
it('clears probe timeouts after a network rejection', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const mod = await import('../src/lib/networkManager'); cleanup = mod.subscribeNetwork(vi.fn());
  window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(1); cleanup(); cleanup = undefined; expect(vi.getTimerCount()).toBe(0);
});
