import { ROLE_LABELS, getRoleLevel, type UserRole } from '../../../lib/supabase';
import { aggregateEntries } from '../../DailyReports/services/dailyStatsService';
import type { DailyAgentStatRow } from '../../DailyReports/types';
import {
  computeActivityScore,
  computeFinalScore,
  type ActivityTargets,
  type ActivityScoreResult,
} from './performanceScoreCalculator';

const formatCurrency = (amount: number) => new Intl.NumberFormat('ar-EG', {
  style: 'currency',
  currency: 'EGP',
  minimumFractionDigits: 0,
}).format(amount);

export interface SupervisoryPerformanceUser {
  id: string;
  name: string;
  role: UserRole;
  manager_id: string | null;
  target: number | null;
  is_active: boolean;
  deleted_at?: string | null;
}

export interface SupervisoryPerformanceNode {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  target: number;
  achieved: number;
  financialRate: number;
  finalScore: number;
  activityScore: number | null;
  financialOnly: boolean;
  ratingLabel: string;
  ratingColorClass: string;
  activity: ActivityScoreResult;
  agentCount: number;
  children: SupervisoryPerformanceNode[];
}

export interface SupervisoryPerformanceReport {
  roots: SupervisoryPerformanceNode[];
  totalSupervisors: number;
  totalGroupLeaders: number;
  totalAgents: number;
  totalAchieved: number;
  totalTarget: number;
}

const isAgent = (role: UserRole) => role === 'agent' || role === 'premium_agent';
const isGroupLeader = (role: UserRole) => role === 'group_leader';
const isSupervisor = (role: UserRole) => getRoleLevel(role) <= 4;

function resolveActiveManager(
  userId: string,
  allUsers: Map<string, SupervisoryPerformanceUser>,
  activeIds: Set<string>,
): string | null {
  const visited = new Set<string>();
  let managerId = allUsers.get(userId)?.manager_id ?? null;
  while (managerId && !visited.has(managerId)) {
    visited.add(managerId);
    if (activeIds.has(managerId)) return managerId;
    managerId = allUsers.get(managerId)?.manager_id ?? null;
  }
  return null;
}

export function computeSupervisoryPerformanceReport(
  usersData: SupervisoryPerformanceUser[],
  payments: any[],
  dailyStats: DailyAgentStatRow[],
  activityTargets?: ActivityTargets,
): {
  data: { supervisoryPerformance: SupervisoryPerformanceReport; details: Record<string, unknown>[] };
  chartData: { name: string; value: number }[];
} {
  const activeUsers = usersData.filter((u) => u.is_active && !u.deleted_at);
  const allUsers = new Map(usersData.map((u) => [u.id, u]));
  const users = new Map(activeUsers.map((u) => [u.id, u]));
  const activeIds = new Set(activeUsers.map((u) => u.id));
  const childrenMap = new Map<string, string[]>();

  activeUsers.forEach((u) => {
    const managerId = resolveActiveManager(u.id, allUsers, activeIds);
    if (!managerId) return;
    const children = childrenMap.get(managerId) || [];
    children.push(u.id);
    childrenMap.set(managerId, children);
  });

  const directAchieved = new Map<string, number>();
  payments.forEach((payment: any) => {
    const ownerId = payment.installment?.policy?.owner_id;
    if (!ownerId || !activeIds.has(ownerId)) return;
    directAchieved.set(ownerId, (directAchieved.get(ownerId) || 0) + Number(payment.amount || 0));
  });

  const statsByAgent = new Map<string, DailyAgentStatRow[]>();
  dailyStats.forEach((row) => {
    if (!activeIds.has(row.agent_id)) return;
    const rows = statsByAgent.get(row.agent_id) || [];
    rows.push(row);
    statsByAgent.set(row.agent_id, rows);
  });

  const agentIdsCache = new Map<string, string[]>();
  const getAgentIdsUnder = (id: string): string[] => {
    if (agentIdsCache.has(id)) return agentIdsCache.get(id)!;
    const user = users.get(id);
    const ids = user && isAgent(user.role) ? [id] : [];
    (childrenMap.get(id) || []).forEach((childId) => ids.push(...getAgentIdsUnder(childId)));
    agentIdsCache.set(id, ids);
    return ids;
  };

  const achievedCache = new Map<string, number>();
  const getAchieved = (id: string): number => {
    if (achievedCache.has(id)) return achievedCache.get(id)!;
    const total = (directAchieved.get(id) || 0) + (childrenMap.get(id) || [])
      .reduce((sum, childId) => sum + getAchieved(childId), 0);
    achievedCache.set(id, total);
    return total;
  };

  const nodeCache = new Map<string, SupervisoryPerformanceNode>();
  const buildNode = (id: string): SupervisoryPerformanceNode => {
    if (nodeCache.has(id)) return nodeCache.get(id)!;
    const user = users.get(id)!;
    const agentIds = getAgentIdsUnder(id);
    const activity = computeActivityScore(
      aggregateEntries(agentIds.flatMap((agentId) => statsByAgent.get(agentId) || [])),
      activityTargets,
    );
    const achieved = getAchieved(id);
    const target = Number(user.target || 0);
    const financialRate = target > 0 ? Math.round((achieved / target) * 100) : 0;
    const score = computeFinalScore(financialRate, activity);
    const node: SupervisoryPerformanceNode = {
      id: user.id,
      name: user.name,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role] || user.role,
      target,
      achieved,
      financialRate: score.financialRate,
      finalScore: score.finalScore,
      activityScore: score.activityScore,
      financialOnly: score.financialOnly,
      ratingLabel: score.ratingLabel,
      ratingColorClass: score.ratingColorClass,
      activity,
      agentCount: agentIds.length,
      children: [],
    };
    nodeCache.set(id, node);
    node.children = (childrenMap.get(id) || [])
      .map((childId) => buildNode(childId))
      .sort((a, b) => b.finalScore - a.finalScore || a.name.localeCompare(b.name, 'ar'));
    return node;
  };

  const roots = activeUsers
    .filter((u) => !resolveActiveManager(u.id, allUsers, activeIds))
    .map((u) => buildNode(u.id))
    .sort((a, b) => b.finalScore - a.finalScore || a.name.localeCompare(b.name, 'ar'));

  const allNodes: SupervisoryPerformanceNode[] = [];
  const walk = (node: SupervisoryPerformanceNode) => {
    allNodes.push(node);
    node.children.forEach(walk);
  };
  roots.forEach(walk);

  const details: Record<string, unknown>[] = [];
  const appendDetails = (node: SupervisoryPerformanceNode, supervisorName: string, groupLeaderName: string) => {
    const nextSupervisor = isSupervisor(node.role) ? node.name : supervisorName;
    const nextGroupLeader = isGroupLeader(node.role) ? node.name : groupLeaderName;
    details.push({
      'المراقب': nextSupervisor || '-',
      'رئيس المجموعة': nextGroupLeader || '-',
      'الاسم': node.name,
      'المسمى الوظيفي': node.roleLabel,
      'عدد الوكلاء': node.agentCount,
      'المحقق': formatCurrency(node.achieved),
      'الهدف': formatCurrency(node.target),
      'نسبة التحقيق المالي': `${node.financialRate}%`,
      'درجة النشاط': node.activityScore !== null ? `${node.activityScore}%` : 'لا توجد بيانات',
      'التقييم النهائي': `${node.finalScore}%`,
      'التصنيف': node.ratingLabel,
      'الالتزام': node.activity.hasData ? `${node.activity.punctualityPct}%` : '-',
      'جودة المواعيد': node.activity.hasData && node.activity.appointmentsQualityScore !== null
        ? `${node.activity.appointmentsQualityScore}% (${node.activity.appointmentsQualityLabel})`
        : '-',
    });
    node.children.forEach((child) => appendDetails(child, nextSupervisor, nextGroupLeader));
  };
  roots.forEach((root) => appendDetails(root, '', ''));

  const report: SupervisoryPerformanceReport = {
    roots,
    totalSupervisors: allNodes.filter((node) => isSupervisor(node.role)).length,
    totalGroupLeaders: allNodes.filter((node) => isGroupLeader(node.role)).length,
    totalAgents: allNodes.filter((node) => isAgent(node.role)).length,
    totalAchieved: roots.reduce((sum, root) => sum + root.achieved, 0),
    totalTarget: roots.reduce((sum, root) => sum + root.target, 0),
  };

  return {
    data: { supervisoryPerformance: report, details },
    chartData: roots.map((root) => ({ name: root.name, value: root.finalScore })),
  };
}

export function getSupervisoryPerformanceSummary(report: SupervisoryPerformanceReport) {
  return {
    overallRate: report.totalTarget > 0 ? Math.round((report.totalAchieved / report.totalTarget) * 100) : 0,
    overallScore: report.roots.length > 0
      ? Math.round(report.roots.reduce((sum, root) => sum + root.finalScore, 0) / report.roots.length)
      : 0,
  };
}
