import { MapPin } from 'lucide-react';
import { StatsSummaryCard } from './StatsSummaryCard';
import { EntriesTable } from './EntriesTable';
import { AgentAppointmentsReadOnly } from './AgentAppointmentsReadOnly';
import type { StatsTreeNode } from '../types';

interface NodeDetailPanelProps {
  node: StatsTreeNode;
  /** بداية/نهاية الفترة المختارة فوق (yyyy-MM-dd) — لجلب مواعيد الإيجنت
   * وحالة تسجيل الموقع خلال نفس الفترة */
  startDate: string;
  endDate: string;
}

export function NodeDetailPanel({ node, startDate, endDate }: NodeDetailPanelProps) {
  const isAgent = node.own !== null;

  return (
    <div className="space-y-4">
      <StatsSummaryCard
        aggregate={node.subtree}
        title={node.children.length > 0 ? `إجمالي ${node.name} وفريقه` : `إجمالي ${node.name}`}
      />

      {isAgent && (
        <>
          <div className="card">
            <h3 className="font-bold text-secondary-900 mb-3">تفاصيل الأيام المسجّلة</h3>
            <EntriesTable entries={node.ownEntries} />
          </div>

          <div className="card space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-secondary-500 uppercase tracking-wide">
              <MapPin className="w-3.5 h-3.5" /> المواعيد وتسجيل الموقع
            </div>
            <AgentAppointmentsReadOnly agentId={node.userId} startDate={startDate} endDate={endDate} />
          </div>
        </>
      )}
    </div>
  );
}
