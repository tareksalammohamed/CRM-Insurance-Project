export type ReadSample = { area: string; durationMs: number; status: string };
const AREAS = new Set(['dashboard','customers','policies','collection','commissions','reports','monthlyClosing','followups','profile','dailyStats','year2','settings']);
let samples: readonly ReadSample[] = [];
const listeners = new Set<() => void>();
function publish() { for (const listener of listeners) { try { listener(); } catch { /* Diagnostics must not interrupt application reads. */ } } }
export function recordClientRead(key: string, durationMs: number, status: string) {
  const prefix = key.split(':', 1)[0];
  const sample = { area: AREAS.has(prefix) ? prefix : 'other', durationMs: Math.max(0, Math.round(durationMs)), status };
  samples = [...samples.slice(-79), sample]; publish();
}
export function clearClientDiagnostics() { samples = []; publish(); }
export function getClientDiagnostics() { return samples; }
export function subscribeClientDiagnostics(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function summarizeClientReads(rows: readonly ReadSample[]) {
  const sorted = rows.map(row => row.durationMs).sort((a, b) => a - b);
  return { count: rows.length, p95: sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : 0, degraded: rows.filter(row => row.status !== 'online').length };
}
