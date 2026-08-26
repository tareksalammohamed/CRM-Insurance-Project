import { useState } from 'react';
import { ChevronDown, ChevronLeft, Gauge, Target, TrendingUp, Users } from 'lucide-react';
import clsx from 'clsx';
import { formatCurrency } from '../business/reportsCalculator';
import type {
  SupervisoryPerformanceNode,
  SupervisoryPerformanceReport,
} from '../business/supervisoryPerformanceCalculator';
import { getSupervisoryPerformanceSummary } from '../business/supervisoryPerformanceCalculator';

function scoreColor(score: number) {
  if (score >= 90) return 'text-success-700';
  if (score >= 60) return 'text-amber-700';
  return 'text-error-700';
}

function progressColor(score: number) {
  if (score >= 90) return 'bg-success-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-error-500';
}

function NodeRow({ node, depth = 0 }: { node: SupervisoryPerformanceNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const activityText = node.activityScore === null ? 'لا توجد بيانات نشاط' : `نشاط ${node.activityScore}%`;

  return (
    <div className={clsx('border rounded-xl bg-white/80 overflow-hidden', depth === 0 ? 'border-primary-100 shadow-sm' : 'border-secondary-100')}>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded((value) => !value)}
        className={clsx('w-full text-right p-3 transition-colors', hasChildren && 'hover:bg-primary-50/40')}
        aria-expanded={hasChildren ? expanded : undefined}
      >
        <div className="flex items-start gap-3">
          <span className={clsx(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            node.role === 'agent' || node.role === 'premium_agent' ? 'bg-info-50 text-info-600' :
              node.role === 'group_leader' ? 'bg-primary-50 text-primary-700' : 'bg-success-50 text-success-700',
          )}>
            {hasChildren ? (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />) : <Users className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="block text-sm font-bold text-secondary-900">{node.name}</span>
                <span className="mt-0.5 block text-[11px] text-secondary-500">{node.roleLabel} · {node.agentCount} وكيل</span>
              </span>
              <span className="text-left">
                <span className={clsx('block text-lg font-black', scoreColor(node.finalScore))}>{node.finalScore}%</span>
                <span className="block text-[11px] text-secondary-400">{node.ratingLabel}</span>
              </span>
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-secondary-100">
              <span className={clsx('block h-full rounded-full transition-all', progressColor(node.finalScore))} style={{ width: `${Math.min(100, Math.max(0, node.finalScore))}%` }} />
            </span>
            <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-secondary-500">
              <span>مالي {node.financialRate}%</span>
              <span>{activityText}</span>
              <span>{formatCurrency(node.achieved)} محقق</span>
            </span>
          </span>
        </div>
      </button>
      {expanded && hasChildren && (
        <div className="space-y-2 border-t border-secondary-100 bg-secondary-50/30 p-2 sm:p-3">
          {node.children.map((child) => <NodeRow key={`${child.id}-${child.role}`} node={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export function SupervisoryPerformancePanel({ report }: { report: SupervisoryPerformanceReport }) {
  const summary = getSupervisoryPerformanceSummary(report);

  return (
    <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-white to-primary-50/40 p-3 sm:p-5 print:border-secondary-200 print:bg-white print:p-3">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><Gauge className="h-4 w-4" /></span>
            <div>
              <h3 className="text-base font-extrabold text-secondary-900">مراجعة أداء المراقبة</h3>
              <p className="mt-0.5 text-xs text-secondary-500">المراقبون ورؤساء المجموعات والوكلاء في نطاقك</p>
            </div>
          </div>
        </div>
        <span className="badge badge-success">حسابات نشطة فقط</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'المراقبون', value: report.totalSupervisors, icon: Users, color: 'text-success-700 bg-success-50' },
          { label: 'رؤساء المجموعات', value: report.totalGroupLeaders, icon: Users, color: 'text-primary-700 bg-primary-50' },
          { label: 'الوكلاء', value: report.totalAgents, icon: Users, color: 'text-info-700 bg-info-50' },
          { label: 'التحقيق العام', value: `${summary.overallRate}%`, icon: TrendingUp, color: 'text-warning-700 bg-warning-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-secondary-100 bg-white/80 p-3">
            <span className={clsx('mb-2 flex h-7 w-7 items-center justify-center rounded-lg', color)}><Icon className="h-3.5 w-3.5" /></span>
            <p className="text-[11px] text-secondary-500">{label}</p>
            <p className="mt-0.5 text-lg font-black text-secondary-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl bg-success-50/70 px-3 py-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold text-secondary-600"><TrendingUp className="h-4 w-4 text-success-600" /> إجمالي المحقق</span>
          <strong className="text-sm text-success-700">{formatCurrency(report.totalAchieved)}</strong>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-primary-50/70 px-3 py-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold text-secondary-600"><Target className="h-4 w-4 text-primary-600" /> إجمالي الأهداف</span>
          <strong className="text-sm text-primary-700">{formatCurrency(report.totalTarget)}</strong>
        </div>
      </div>

      {report.roots.length > 0 ? (
        <div className="space-y-2">
          {report.roots.map((root) => <NodeRow key={`${root.id}-${root.role}`} node={root} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-secondary-200 bg-white p-6 text-center text-sm text-secondary-500">لا توجد بيانات أداء ضمن النطاق المحدد.</div>
      )}
    </div>
  );
}
