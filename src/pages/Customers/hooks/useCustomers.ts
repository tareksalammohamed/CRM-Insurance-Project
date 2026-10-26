import { isAbortedRead } from '../../../lib/adaptiveReads';
import { useAdaptiveReads } from '../../../hooks/useAdaptiveReads';
import { REQUEST_EXPIRY_MS } from '../../../lib/customerRequestStatus';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../../../lib/supabase';
import { fetchAgentsForCurrentUser, fetchCustomersPage, computeDeletableCustomerIds,
  fetchCustomerStats, type CustomerStats } from '../services/customersService';
import type { CustomerWithRelations } from '../types';
import { useReconnectRefetch } from '../../../hooks/useReconnectRefetch';
import { useRequestGuard } from '../../../hooks/useRequestGuard';
import { friendlyError } from '../../../lib/errorMessages';

type AgentOption = { id: string; name: string; role: string };
export function useCustomers(user: User | null | undefined, page: number, searchQuery: string,
  statusFilter: string, agentFilter: string, monthFilter: string,
  noPolicyOnly = false, branchId: string | null = null) {
  const [customers, setCustomers] = useState<CustomerWithRelations[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [deletableIds, setDeletableIds] = useState<Set<string>>(new Set());
  const read = useAdaptiveReads(`${user?.id}:${branchId}`);
  const listGuard = useRequestGuard();
  const statsGuard = useRequestGuard();
  const agentsGuard = useRequestGuard();
  const userRef = useRef(user);
  userRef.current = user;
  const userId = user?.id;
  const role = user?.role;

  const loadCustomers = useCallback(async () => {
    if (!userId) return;
    const request = listGuard.start();
    setLoading(true);
    setDeletableIds(new Set());
    try {
      const result = await read(() => fetchCustomersPage({ page, searchQuery, statusFilter, agentFilter, monthFilter,
        noPolicyOnly, userId, branchId }), 0, () => listGuard.isCurrent(request));
      if (!listGuard.isCurrent(request)) return;
      setCustomers(result.customers);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
      setLoadMessage(result.loadMessage ?? null);
      // The list is ready; deletion eligibility remains pessimistic until its separate check finishes.
      setLoading(false);
      try {
        const ids = await read(() => computeDeletableCustomerIds(result.customers), 2, () => listGuard.isCurrent(request));
        if (listGuard.isCurrent(request)) setDeletableIds(ids);
      } catch (error) {
      if (isAbortedRead(error)) return; console.error('Error checking deletable customers:', error); }
    } catch (error) {
      if (isAbortedRead(error)) return;
      if (listGuard.isCurrent(request)) setLoadMessage(friendlyError(error, 'تعذر تحميل العملاء، أعد المحاولة'));
    } finally { if (listGuard.isCurrent(request)) setLoading(false); }
  }, [userId, page, searchQuery, statusFilter, agentFilter, monthFilter, noPolicyOnly, branchId, listGuard, read]);

  const loadAgents = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser || currentUser.id !== userId || currentUser.role !== role) return;
    const request = agentsGuard.start();
    try {
      const result = await read(() => fetchAgentsForCurrentUser(currentUser, branchId), 1, () => agentsGuard.isCurrent(request));
      if (agentsGuard.isCurrent(request)) setAgents(result);
    } catch (error) {
      if (isAbortedRead(error)) return; console.error('Error loading agents:', error); }
  }, [userId, role, branchId, agentsGuard, read]);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    const request = statsGuard.start();
    setStatsLoading(true);
    try {
      const result = await read(() => fetchCustomerStats(userId, branchId), 1, () => statsGuard.isCurrent(request));
      if (statsGuard.isCurrent(request)) setStats(result);
    } catch (error) {
      if (isAbortedRead(error)) return; console.error('Error loading customer stats:', error); }
    finally { if (statsGuard.isCurrent(request)) setStatsLoading(false); }
  }, [userId, branchId, statsGuard, read]);

  useEffect(() => { setCustomers([]); setTotalCount(0); setTotalPages(1); setStats(null); }, [userId, branchId]);
  useEffect(() => { void loadCustomers(); return listGuard.invalidate; }, [loadCustomers, listGuard]);
  // Agent options depend on identity/branch, never page/search/filter changes.
  useEffect(() => { setAgents([]); void loadAgents(); return agentsGuard.invalidate; }, [loadAgents, agentsGuard]);
  useEffect(() => { void loadStats(); return statsGuard.invalidate; }, [loadStats, statsGuard]);
  // Reclassify visible unissued requests at the exact 60-day boundary while this page stays open.
  useEffect(() => {
    const now = Date.now();
    const nextExpiry = Math.min(...customers.filter(customer => !customer.policies?.length)
      .map(customer => new Date(customer.created_at).getTime() + REQUEST_EXPIRY_MS).filter(time => time > now));
    if (!Number.isFinite(nextExpiry)) return;
    const timer = window.setTimeout(() => { void loadCustomers(); void loadStats(); }, Math.min(nextExpiry - now + 25, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [customers, loadCustomers, loadStats]);
  useReconnectRefetch(loadCustomers, loadAgents, loadStats);
  return { customers, agents, loading, isInitialLoading: loading && customers.length === 0, loadMessage,
    totalCount, stats, statsLoading, totalPages, deletableIds, loadCustomers, loadStats };
}
