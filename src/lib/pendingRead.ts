import { getDataCacheIdentity } from './dataCache';

// Only pending hierarchy reads are shared. No resolved results or cross-account reuse.
const reads = new WeakMap<ReturnType<typeof getDataCacheIdentity>, Map<string, Promise<unknown>>>();
export function pendingRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const identity = getDataCacheIdentity();
  let account = reads.get(identity);
  if (!account) { account = new Map(); reads.set(identity, account); }
  const existing = account.get(key);
  if (existing) return existing as Promise<T>;
  const promise = Promise.resolve().then(fetcher);
  account.set(key, promise);
  const clear = () => { if (account.get(key) === promise) account.delete(key); };
  void promise.then(clear, clear);
  return promise;
}
