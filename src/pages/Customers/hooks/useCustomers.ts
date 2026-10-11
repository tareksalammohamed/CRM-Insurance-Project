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
      const result = await fetchCustomersPage({ page, searchQuery, statusFilter, agentFilter, monthFilter,
        noPolicyOnly, userId, branchId });
      if (!listGuard.isCurrent(request)) return;
      setCustomers(result.customers);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
      setLoadMessage(result.loadMessage ?? null);
      try {
        const ids = await computeDeletableCustomerIds(result.customers);
        if (listGuard.isCurrent(request)) setDeletableIds(ids);
      } catch (error) { console.error('Error checking deletable customers:', error); }
    } catch (error) {
      if (listGuard.isCurrent(request)) setLoadMessage(friendlyError(error, 'تعذر تحميل العملاء، أعد المحاولة'));
    } finally { if (listGuard.isCurrent(request)) setLoading(false); }
  }, [userId, page, searchQuery, statusFilter, agentFilter, monthFilter, noPolicyOnly, branchId, listGuard]);

  const loadAgents = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser || currentUser.id !== userId || currentUser.role !== role) return;
    const request = agentsGuard.start();
    try {
      const result = await fetchAgentsForCurrentUser(currentUser, branchId);
      if (agentsGuard.isCurrent(request)) setAgents(result);
    } catch (error) { console.error('Error loading agents:', error); }
  }, [userId, role, branchId, agentsGuard]);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    const request = statsGuard.start();
    setStatsLoading(true);
    try {
      const result = await fetchCustomerStats(userId, branchId);
      if (statsGuard.isCurrent(request)) setStats(result);
    } catch (error) { console.error('Error loading customer stats:', error); }
    finally { if (statsGuard.isCurrent(request)) setStatsLoading(false); }
  }, [userId, branchId, statsGuard]);

  useEffect(() => { setCustomers([]); setTotalCount(0); setTotalPages(1); setStats(null); }, [userId, branchId]);
  useEffect(() => { void loadCustomers(); return listGuard.invalidate; }, [loadCustomers, listGuard]);
  // Agent options depend on identity/branch, never page/search/filter changes.
  useEffect(() => { setAgents([]); void loadAgents(); return agentsGuard.invalidate; }, [loadAgents, agentsGuard]);
  useEffect(() => { void loadStats(); return statsGuard.invalidate; }, [loadStats, statsGuard]);
  useReconnectRefetch(loadCustomers, loadAgents, loadStats);
  return { customers, agents, loading, isInitialLoading: loading && customers.length === 0, loadMessage,
    totalCount, stats, statsLoading, totalPages, deletableIds, loadCustomers, loadStats };
}
