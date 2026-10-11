import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ values: new Map<string, unknown>(), online: true }));
vi.mock('../src/lib/offlineDb', () => ({ DATA_CACHE_STORE: 'data', idbGet: async (_store: string, key: string) => mocks.values.get(key),
  idbPut: async (_store: string, entry: { key: string }) => { mocks.values.set(entry.key, entry); }, idbDelete: vi.fn(), idbClearStore: async () => mocks.values.clear() }));
vi.mock('../src/lib/networkManager', () => ({ isOnline: () => mocks.online }));
vi.mock('../src/lib/offlineEvents', () => ({ emitOfflineEvent: vi.fn() }));
import { dalRead, readStatusMessage } from '../src/lib/dataAccessLayer';
import { setDataCacheIdentity } from '../src/lib/dataCache';
beforeEach(() => { mocks.values.clear(); mocks.online = true; setDataCacheIdentity('a'); });
it('cannot show one account cached results to another', async () => {
  await dalRead('list', async () => ['private-a'], { emptyValue: [] });
  mocks.online = false; setDataCacheIdentity('b');
  const result = await dalRead('list', async () => [], { emptyValue: [] });
  expect(result.data).toEqual([]); expect(result.status).toBe('offline-empty');
});
it('restores cached reads for the same account', async () => {
  await dalRead('list', async () => ['cached'], { emptyValue: [] }); mocks.online = false;
  expect((await dalRead('list', async () => [], { emptyValue: [] })).data).toEqual(['cached']);
});
it('discards a read that completes after account switching', async () => {
  let resolve!: (value: string[]) => void;
  const pending = dalRead('list', () => new Promise<string[]>((done) => { resolve = done; }), { emptyValue: [] });
  setDataCacheIdentity('b'); resolve(['a-private']); expect((await pending).data).toEqual([]); expect(mocks.values.size).toBe(0);
});
it('discards a read even after switching away and back to the same user', async () => {
  let resolve!: (value: string[]) => void;
  const pending = dalRead('list', () => new Promise<string[]>((done) => { resolve = done; }), { emptyValue: [] });
  setDataCacheIdentity('b'); setDataCacheIdentity('a'); resolve(['old-session']);
  expect((await pending).data).toEqual([]); expect(mocks.values.size).toBe(0);
});
it('returns safe Arabic error text instead of database internals', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const result = await dalRead('secret', async () => { throw { code: '42501', message: 'permission denied for table secret_table' }; }, { emptyValue: [] });
  expect(result.errorMessage).toBe('ليس لديك صلاحية لتنفيذ هذا الإجراء'); expect(readStatusMessage(result)).toContain('تعذر تحميل');
});
it('times out once within the total deadline without duplicating a stalled query', async () => {
  vi.useFakeTimers(); vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const fetcher = vi.fn(() => new Promise<string[]>(() => undefined));
  const pending = dalRead('slow', fetcher, { emptyValue: [], timeoutMs: 100 });
  await vi.advanceTimersByTimeAsync(100);
  expect((await pending).status).toBe('offline-empty'); expect(fetcher).toHaveBeenCalledOnce(); vi.useRealTimers();
});
