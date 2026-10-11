// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker({ cached, fetcher = vi.fn().mockResolvedValue(new Response('ok')) } = {}) {
  const handlers = {}; const put = vi.fn(); const deleteCache = vi.fn(); const skipWaiting = vi.fn();
  const context = {
    URL, Response, fetch: fetcher,
    caches: { open: async () => ({ addAll: vi.fn(), put }), match: async () => cached,
      keys: async () => ['unrelated-site-cache', 'crm-insurance-cache-v1', 'crm-insurance-cache-v4-brand-icon', 'crm-insurance-cache-v5-safe-updates'], delete: deleteCache },
    self: { location: { origin: 'https://crm.test' }, addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting, clients: { claim: vi.fn() } },
  };
  runInNewContext(source, context);
  async function fire(name, request) {
    let response; const waits = [];
    handlers[name]({ request, data: request, waitUntil: (promise) => waits.push(promise), respondWith: (promise) => { response = promise; } });
    const result = await response; await Promise.all(waits); return result;
  }
  return { fire, put, skipWaiting, deleteCache, fetcher };
}
const navigation = { method: 'GET', mode: 'navigate', url: 'https://crm.test/customers' };
it('waits for user activation while existing tabs are open', async () => {
  const w = worker(); await w.fire('install'); expect(w.skipWaiting).not.toHaveBeenCalled();
  await w.fire('message', 'SKIP_WAITING'); expect(w.skipWaiting).toHaveBeenCalledOnce();
});
it('preserves unrelated caches and the previous build', async () => {
  const w = worker(); await w.fire('activate'); expect(w.deleteCache.mock.calls).toEqual([['crm-insurance-cache-v1']]);
});
it('serves cached hashed chunks without any background request', async () => {
  const w = worker({ cached: new Response('cached chunk') });
  const response = await w.fire('fetch', { method: 'GET', url: 'https://crm.test/assets/page-hash.js', destination: 'script' });
  expect(await response.text()).toBe('cached chunk'); expect(w.fetcher).not.toHaveBeenCalled();
});
it('never replaces a good app shell with a server error', async () => {
  const w = worker({ cached: new Response('good shell'), fetcher: vi.fn().mockResolvedValue(new Response('failure', { status: 500 })) });
  expect(await (await w.fire('fetch', navigation)).text()).toBe('good shell'); expect(w.put).not.toHaveBeenCalled();
});
it('provides a real response for first-launch offline navigation', async () => {
  const w = worker({ fetcher: vi.fn().mockRejectedValue(new Error('offline')) });
  const response = await w.fire('fetch', navigation); expect(response.status).toBe(503); expect(await response.text()).toContain('لا يوجد اتصال');
});
it('does not intercept API or backend requests', async () => {
  const w = worker(); expect(await w.fire('fetch', { method: 'GET', url: 'https://crm.test/api/users', destination: '' })).toBeUndefined();
  expect(await w.fire('fetch', { method: 'GET', url: 'https://backend.test/data', destination: 'script' })).toBeUndefined();
  expect(w.fetcher).not.toHaveBeenCalled();
});
it('stores successful HTML navigation', async () => {
  const w = worker({ fetcher: vi.fn().mockResolvedValue(new Response('<html>fresh</html>', { headers: { 'content-type': 'text/html' } })) });
  expect((await w.fire('fetch', navigation)).status).toBe(200); expect(w.put).toHaveBeenCalledOnce();
});
