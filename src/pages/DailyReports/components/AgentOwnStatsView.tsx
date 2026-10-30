import { LoadNotice } from '../../../components/feedback/LoadNotice';
import { useReconnectRefetch } from '../../../hooks/useReconnectRefetch';
import { useDailyRead } from '../hooks/useDailyRead';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { PeriodControls } from './PeriodControls';
import { StatsSummaryCard } from './StatsSummaryCard';
import { EntriesTable } from './EntriesTable';
import { fetchAgentOwnEntries, aggregateEntries } from '../services/dailyStatsService';
import { defaultPeriodTypeForRole, defaultRangeForPeriodType, formatDateInput, periodRangeLabel } from '../utils';
import type { StatsPeriodType } from '../utils';

interface AgentOwnStatsViewProps {
  agentId: string;
  roleLevel: number;
}

export function AgentOwnStatsView({ agentId, roleLevel }: AgentOwnStatsViewProps) {
  const [periodType, setPeriodType] = useState<StatsPeriodType>(() => defaultPeriodTypeForRole(roleLevel));
  const [range, setRange] = useState(() => defaultRangeForPeriodType(defaultPeriodTypeForRole(roleLevel)));

  const startStr = formatDateInput(range.start);
  const endStr = formatDateInput(range.end);

  const { data: entries = [], loading, loadError, ready, reload } = useDailyRead(
    JSON.stringify([agentId, startStr, endStr]), () => fetchAgentOwnEntries(agentId, startStr, endStr),
    'تعذّر تحميل إحصائياتك. أعد المحاولة.');
  useReconnectRefetch(reload);

  function handlePeriodTypeChange(type: StatsPeriodType) {
    setPeriodType(type);
    setRange(defaultRangeForPeriodType(type));
  }

  return (
    <div className="space-y-4">
      <PeriodControls
        periodType={periodType}
        onPeriodTypeChange={handlePeriodTypeChange}
        start={range.start}
        end={range.end}
        onRangeChange={(start, end) => setRange({ start, end })}
      />

      <p className="text-sm text-secondary-500">{periodRangeLabel(periodType, range.start, range.end)}</p>

      <LoadNotice message={loadError} loading={loading} onRetry={() => void reload()} />

      {loading ? (
        <div className="card text-center py-8 text-secondary-400">
          <Loader2 className="w-5 h-5 animate-spin inline-block ms-2" /> جارِ التحميل...
        </div>
      ) : ready ? (
        <>
          <StatsSummaryCard aggregate={aggregateEntries(entries)} title="إحصائياتي" />
          <div className="card">
            <h3 className="font-bold text-secondary-900 mb-3">تفاصيل الأيام المسجّلة</h3>
            <EntriesTable entries={entries} />
          </div>
        </>
      ) : null}
    </div>
  );
}
