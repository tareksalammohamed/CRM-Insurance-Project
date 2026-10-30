import { beforeEach, expect, it, vi } from 'vitest';
import type { DalStatus } from '../src/lib/dataAccessLayer';
import type { DailyAgentStatRow } from '../src/pages/DailyReports/types';
const state = vi.hoisted(() => ({ users: [] as Record<string, unknown>[], stats: [] as Record<string, unknown>[], ranges: [] as [string, number, number][], status: 'online' as string, failFrom: -1 }));
vi.mock('../src/lib/branchHierarchy', () => ({ fetchBranchRoleMap: async () => new Map() }));
vi.mock('../src/lib/dataAccessLayer', () => ({
  readStatusMessage: () => 'unavailable',
  dalRead: async (_key: string, read: () => Promise<unknown>, options: { emptyValue: unknown }) => {
    if (state.status !== 'online') return { data: state.status === 'offline-cache' ? state.stats : options.emptyValue, status: state.status };
    try { return { data: await read(), status: 'online' }; } catch { return { data: options.emptyValue, status: 'error' }; }
  },
}));
vi.mock('../src/lib/supabase', () => ({
  ROLE_LABELS: { agent: 'وكيل', group_leader: 'رئيس مجموعة' }, getRoleLevel: () => 1,
  supabase: {
    rpc: async () => ({ data: ['viewer', ...state.users.map(user => user.id)], error: null }),
    from: (table: string) => {
      const filters: ((row: Record<string, unknown>) => boolean)[] = []; const orders: [string, boolean][] = [];
      const query = {
        select: (_columns: string, options: { count?: string }) => { expect(options.count).toBe('exact'); return query; },
        in: (column: string, values: unknown[]) => { filters.push(row => values.includes(row[column])); return query; },
        eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return query; },
        gte: (column: string, value: string) => { filters.push(row => String(row[column]) >= value); return query; },
        lte: (column: string, value: string) => { filters.push(row => String(row[column]) <= value); return query; },
        order: (column: string, options: { ascending: boolean }) => { orders.push([column, options.ascending]); return query; },
        range: async (from: number, to: number) => {
          state.ranges.push([table, from, to]); expect(orders.some(([column]) => column === 'id')).toBe(true);
          const rows = (table === 'users' ? state.users : state.stats).filter(row => filters.every(filter => filter(row))).slice().sort((a, b) => {
            for (const [column, ascending] of orders) { const diff = String(a[column]).localeCompare(String(b[column])); if (diff) return ascending ? diff : -diff; } return 0;
          });
          return from === state.failFrom ? { data: null, count: rows.length, error: new Error('page failed') } : { data: rows.slice(from, to + 1), count: rows.length, error: null };
        },
      }; return query;
    },
  },
}));
import { fetchStatsTree, fetchAgentOwnEntries } from '../src/pages/DailyReports/services/dailyStatsService';
beforeEach(() => {
  state.status = 'online'; state.failFrom = -1; state.ranges = [];
  state.users = [{ id: 'leader', name: 'Leader', role: 'group_leader', manager_id: 'viewer', is_active: true, deleted_at: null }, ...Array.from({ length: 5 }, (_, index) => ({ id: `a${index}`, name: `Agent ${index}`, role: 'agent', manager_id: 'leader', is_active: true, deleted_at: null }))];
  state.stats = Array.from({ length: 1105 }, (_, index) => ({ id: String(index).padStart(5, '0'), agent_id: `a${index % 5}`, report_date: new Date(Date.UTC(2026, 0, Math.floor(index / 5) + 1)).toISOString().slice(0, 10), calls_actual: 1, calls_to_appointments: 0, appointments_actual: 0, new_clients: 0, is_outdoor: false, punctuality_ok: true, appointments_quality: null }));
});
it('loads all pages for the existing authorized scope before aggregating more than 1,000 reports', async () => {
  const result = await fetchStatsTree('viewer', '2026-01-01', '2026-12-31', 'branch');
  expect(result[0].subtree.entriesCount).toBe(1105); expect(result[0].subtree.callsActual).toBe(1105);
  expect(result[0].children).toHaveLength(5);
  expect(state.ranges.filter(([table]) => table === 'daily_agent_stats')).toEqual([['daily_agent_stats', 0, 499], ['daily_agent_stats', 500, 999], ['daily_agent_stats', 1000, 1499]]);
});
it('does not return a partial report if a later page fails', async () => {
  state.failFrom = 500;
  await expect(fetchStatsTree('viewer', '2026-01-01', '2026-12-31', 'branch')).rejects.toThrow('unavailable');
});
it.each(['error', 'offline-empty'] as DalStatus[])('does not present %s as zero agent activity', async status => {
  state.status = status;
  await expect(fetchAgentOwnEntries('a0', '2026-01-01', '2026-12-31')).rejects.toThrow();
});
it('retains the existing offline cache and accepts a genuinely empty online response', async () => {
  state.status = 'offline-cache';
  const cached = await fetchAgentOwnEntries('a0', '2026-01-01', '2026-12-31'); expect(cached).toBe(state.stats as unknown as DailyAgentStatRow[]);
  state.status = 'online'; state.stats = [];
  await expect(fetchAgentOwnEntries('a0', '2026-01-01', '2026-12-31')).resolves.toEqual([]);
});
