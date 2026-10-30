import { createRoot } from 'react-dom/client';
import '../../../src/index.css';
import '../../../src/styles/workspace-polish.css';
import { PrintTeamStats, flattenStatsTree } from '../../../src/pages/DailyReports/components/PrintTeamStats';
import { aggregateEntries, mergeAggregates } from '../../../src/pages/DailyReports/services/dailyStatsService';
import type { DailyAgentStatRow, StatsTreeNode } from '../../../src/pages/DailyReports/types';

const entries: DailyAgentStatRow[] = [1000, 500, 37].map((calls, index) => ({
  id: String(index), agent_id: `agent-${index}`, entered_by: 'leader', report_date: '2026-10-30',
  punctuality_ok: true, calls_actual: calls, calls_to_appointments: 2, appointments_actual: 2,
  appointments_quality: 'excellent', new_clients: 1, is_outdoor: false,
  created_at: '2026-10-30T10:00:00Z', updated_at: '2026-10-30T10:00:00Z',
}));
const agents: StatsTreeNode[] = entries.map((entry, index) => ({
  userId: entry.agent_id, name: `وكيل تجريبي ${index + 1}`, role: 'agent', roleLabel: 'وكيل', roleLevel: 1,
  own: aggregateEntries([entry]), subtree: aggregateEntries([entry]), ownEntries: [entry], children: [],
}));
const aggregate = mergeAggregates(agents.map(agent => agent.subtree));
const tree: StatsTreeNode[] = [{ userId: 'leader', name: 'رئيس مجموعة تجريبي', role: 'group_leader', roleLabel: 'رئيس مجموعة', roleLevel: 2, own: null, subtree: aggregate, ownEntries: [], children: agents }];
if (new URLSearchParams(location.search).has('dark')) document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')!).render(
  <div className="app-shell min-h-screen min-h-[100dvh]">
    <header>واجهة التطبيق — لا تُطبع</header>
    <main className="app-main px-3 pt-14">
      <div className="app-content animate-pageEnter">
        <div className="workspace-page daily-reports-page space-y-4">
          <div className="print:hidden">إحصائيات الفريق — شاشة العرض</div>
          <PrintTeamStats viewerName="مراقب تجريبي" viewerRoleLabel="المراقب" branchName="فرع تجريبي"
            periodLabel="30/10/2026" overallAggregate={aggregate} rows={flattenStatsTree(tree)} />
        </div>
      </div>
    </main>
  </div>,
);
