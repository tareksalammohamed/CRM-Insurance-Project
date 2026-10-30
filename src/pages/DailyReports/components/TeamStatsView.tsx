import { LoadNotice } from '../../../components/feedback/LoadNotice';
import { useReconnectRefetch } from '../../../hooks/useReconnectRefetch';
import { useDailyRead } from '../hooks/useDailyRead';
import { useRef, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';

import { useBranchContext } from '../../../lib/branchContext';
import { printWithTitle } from '../../../lib/printWithTitle';
import { PeriodControls } from './PeriodControls';
import { StatsSummaryCard } from './StatsSummaryCard';
import { StatsTreeView } from './StatsTreeView';
import { NodeDetailPanel } from './NodeDetailPanel';
import { PrintTeamStats, flattenStatsTree } from './PrintTeamStats';
import { fetchStatsTree, mergeAggregates } from '../services/dailyStatsService';
import { defaultPeriodTypeForRole, defaultRangeForPeriodType, formatDateInput, periodRangeLabel } from '../utils';
import type { StatsPeriodType } from '../utils';
import type { StatsTreeNode } from '../types';
import { EMPTY_STATS_AGGREGATE } from '../types';

interface TeamStatsViewProps {
  userId: string;
  viewerName: string;
  viewerRoleLabel: string;
  roleLevel: number;
  branchId: string | null;
}

/** يجد عقدة بمعرّف معيّن داخل شجرة (بحث بالعمق) — تُستخدم لإعادة اختيار
 * نفس العقدة المختارة بعد إعادة تحميل الشجرة (تغيير الفترة مثلاً) */
function findNode(nodes: StatsTreeNode[], userId: string): StatsTreeNode | null {
  for (const n of nodes) {
    if (n.userId === userId) return n;
    const found = findNode(n.children, userId);
    if (found) return found;
  }
  return null;
}

export function TeamStatsView({ userId, viewerName, viewerRoleLabel, roleLevel, branchId }: TeamStatsViewProps) {
  const { branches } = useBranchContext();
  const [periodType, setPeriodType] = useState<StatsPeriodType>(() => defaultPeriodTypeForRole(roleLevel));
  const [range, setRange] = useState(() => defaultRangeForPeriodType(defaultPeriodTypeForRole(roleLevel)));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const startStr = formatDateInput(range.start);
  const endStr = formatDateInput(range.end);

  const read = useDailyRead(JSON.stringify([userId, branchId, startStr, endStr]),
    () => fetchStatsTree(userId, startStr, endStr, branchId), 'تعذّر تحميل إحصائيات الفريق. أعد المحاولة.');
  const { loading, loadError, ready, reload } = read;
  const tree = read.data ?? [];
  useReconnectRefetch(reload);

  function selectNode(node: StatsTreeNode) {
    setSelectedId(node.userId);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => {
        detailRef.current?.focus({ preventScroll: true });
        detailRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
    }
  }

  function handlePeriodTypeChange(type: StatsPeriodType) {
    setPeriodType(type);
    setRange(defaultRangeForPeriodType(type));
  }

  const selectedNode = selectedId ? findNode(tree, selectedId) : null;
  const overallAggregate = tree.length > 0 ? mergeAggregates(tree.map((n) => n.subtree)) : EMPTY_STATS_AGGREGATE;
  const branchName = branchId ? (branches.find((b) => b.branchId === branchId)?.branchName ?? null) : null;
  const periodLabel = periodRangeLabel(periodType, range.start, range.end);

  function handlePrint() {
    if (!ready || tree.length === 0) return;
    const isCurrent = read.capture();
    setTimeout(() => { if (isCurrent()) printWithTitle(`تقرير-إحصائيات-يومية-${startStr}-${endStr}`); }, 50);
  }

  return (
    <div className="space-y-4">
      <div className="daily-team-toolbar flex flex-col sm:flex-row sm:items-end gap-2">
        <PeriodControls
          periodType={periodType}
          onPeriodTypeChange={handlePeriodTypeChange}
          start={range.start}
          end={range.end}
          onRangeChange={(start, end) => setRange({ start, end })}
        />
        <button onClick={handlePrint} disabled={!ready || tree.length === 0} className="btn btn-outline btn-sm print:hidden shrink-0">
          <Printer className="w-4 h-4" /> طباعة التقرير
        </button>
      </div>

      <p className="text-xs text-secondary-500 print:hidden">{periodLabel}</p>

      <div className="print:hidden"><LoadNotice message={loadError} loading={loading} onRetry={() => void reload()} /></div>

      {loading ? (
        <div className="card text-center py-8 text-secondary-400 print:hidden">
          <Loader2 className="w-5 h-5 animate-spin inline-block ms-2" /> جارِ التحميل...
        </div>
      ) : ready ? (
        <>
          <div className="print:hidden space-y-4">
            <StatsSummaryCard aggregate={overallAggregate} title="الإجمالي الكلي" />

            <div className="grid lg:grid-cols-2 gap-4 items-start">
              <div ref={treeRef} tabIndex={-1} className="daily-team-selector min-w-0" aria-label="اختيار فرد أو فريق">
                <StatsTreeView nodes={tree} selectedId={selectedId} onSelect={selectNode} />
              </div>
              {selectedNode ? (
                <div ref={detailRef} tabIndex={-1} className="daily-selected-detail min-w-0 space-y-3" aria-label={`تفاصيل ${selectedNode.name}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-secondary-900">{selectedNode.name} <span className="text-xs font-normal text-secondary-500">· {selectedNode.roleLabel}</span></h3>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                      setSelectedId(null);
                      treeRef.current?.focus({ preventScroll: true });
                      if (window.matchMedia('(max-width: 1023px)').matches) treeRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
                    }}>إغلاق التفاصيل</button>
                  </div>
                  <NodeDetailPanel node={selectedNode} startDate={startStr} endDate={endStr} />
                </div>
              ) : (
                <div className="card text-center py-8 text-secondary-400">
                  اختر فرداً أو مجموعة من القائمة لعرض تفاصيلها
                </div>
              )}
            </div>
          </div>

          <PrintTeamStats
            viewerName={viewerName}
            viewerRoleLabel={viewerRoleLabel}
            branchName={branchName}
            periodLabel={periodLabel}
            overallAggregate={overallAggregate}
            rows={flattenStatsTree(tree)}
          />
        </>
      ) : null}
    </div>
  );
}
