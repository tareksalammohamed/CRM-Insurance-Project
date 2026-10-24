import { afterEach, expect, it, vi } from 'vitest';
import { clearClientDiagnostics, getClientDiagnostics, recordClientRead, subscribeClientDiagnostics, summarizeClientReads } from '../src/lib/clientDiagnostics';
import { setDataCacheIdentity } from '../src/lib/dataCache';
afterEach(() => { clearClientDiagnostics(); vi.restoreAllMocks(); });
it('keeps a bounded sample without search text, identifiers or unknown area names', () => {
  for (let i=0;i<100;i++) recordClientRead('customers:private-id:private-name', i, 'online');
  recordClientRead('private-name:123', 5, 'offline-cache');
  const rows = getClientDiagnostics(); expect(rows).toHaveLength(80);
  expect(JSON.stringify(rows)).not.toMatch(/private|123/);
  expect(rows.at(-1)?.area).toBe('other');
  expect(summarizeClientReads(rows).degraded).toBe(1);
});
it('computes a measured percentile and clears samples on account changes', () => {
  setDataCacheIdentity('account-a');
  for (let i=1;i<=20;i++) recordClientRead('reports:anything', i*10, 'online');
  expect(summarizeClientReads(getClientDiagnostics())).toMatchObject({ count: 20, p95: 190, degraded: 0 });
  setDataCacheIdentity('account-b'); expect(getClientDiagnostics()).toHaveLength(0);
});
it('cannot interrupt reads when a diagnostics subscriber throws', () => {
  const stop = subscribeClientDiagnostics(() => { throw new Error('subscriber'); });
  expect(() => recordClientRead('reports', 25, 'error-cache')).not.toThrow(); stop();
});
