import { isAbortedRead } from '../../../lib/adaptiveReads';
import { useAdaptiveReads } from '../../../hooks/useAdaptiveReads';
import { useCallback, useEffect, useState } from 'react';
import type { Policy, User } from '../../../lib/supabase';
import { fetchPoliciesPage, computeDeletablePolicyIds, fetchPolicyStats, type PolicyStats } from '../services/policiesService';
import { useReconnectRefetch } from '../../../hooks/useReconnectRefetch';
import { useRequestGuard } from '../../../hooks/useRequestGuard';
import { friendlyError } from '../../../lib/errorMessages';

export function usePolicies(user: User | null | undefined, page: number, searchQuery: string,
  statusFilter: string, typeFilter: string, monthFilter: string, branchId: string | null = null) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<PolicyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [deletableIds, setDeletableIds] = useState<Set<string>>(new Set());
  const read = useAdaptiveReads(`${user?.id}:${branchId}`);
  const listGuard = useRequestGuard();
  const statsGuard = useRequestGuard();
  const userId = user?.id;

  const loadPolicies = useCallback(async () => {
    if (!userId) return;
    const request = listGuard.start();
    setLoading(true);
    setDeletableIds(new Set());
    try {
      const result = await read(() => fetchPoliciesPage({ page, searchQuery, statusFilter, typeFilter, monthFilter, branchId }), 0, () => listGuard.isCurrent(request));
      if (!listGuard.isCurrent(request)) return;
      setPolicies(result.policies);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
      setLoadMessage(result.loadMessage ?? null);
      // The list is ready; deletion eligibility remains pessimistic until its separate check finishes.
      setLoading(false);
      try {
        const ids = await read(() => computeDeletablePolicyIds(result.policies), 2, () => listGuard.isCurrent(request));
        if (listGuard.isCurrent(request)) setDeletableIds(ids);
      } catch (error) {
      if (isAbortedRead(error)) return;
        console.error('Error checking deletable policies:', error);
      }
    } catch (error) {
      if (isAbortedRead(error)) return;
      if (listGuard.isCurrent(request)) setLoadMessage(friendlyError(error, 'تعذر تحميل الوثائق، أعد المحاولة'));
    } finally {
      if (listGuard.isCurrent(request)) setLoading(false);
    }
  }, [userId, page, searchQuery, statusFilter, typeFilter, monthFilter, branchId, listGuard, read]);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    const request = statsGuard.start();
    setStatsLoading(true);
    try {
      const result = await read(() => fetchPolicyStats(branchId), 1, () => statsGuard.isCurrent(request));
      if (statsGuard.isCurrent(request)) setStats(result);
    } catch (error) {
      if (isAbortedRead(error)) return; console.error('Error loading policy stats:', error); }
    finally { if (statsGuard.isCurrent(request)) setStatsLoading(false); }
  }, [userId, branchId, statsGuard, read]);

  useEffect(() => { setPolicies([]); setTotalCount(0); setTotalPages(1); setStats(null); }, [userId, branchId]);
  useEffect(() => { void loadPolicies(); return listGuard.invalidate; }, [loadPolicies, listGuard]);
  useEffect(() => { void loadStats(); return statsGuard.invalidate; }, [loadStats, statsGuard]);
  useReconnectRefetch(loadPolicies, loadStats);
  return { policies, loading, isInitialLoading: loading && policies.length === 0, loadMessage,
    totalCount, stats, statsLoading, totalPages, deletableIds, loadPolicies, loadStats };
}
