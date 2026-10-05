import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../../../lib/supabase';
import { fetchCollectionQuickStats, type CollectionQuickStats } from '../services/collectionService';
import { useReconnectRefetch } from '../../../hooks/useReconnectRefetch';

// ===== بطاقات إحصائية سريعة (لحظية من Supabase) =====
export function useCollectionQuickStats(user: User | null | undefined, branchId: string | null, ensureMaintenance: () => Promise<void>) {
  const [quickStats, setQuickStats] = useState<CollectionQuickStats | null>(null);
  const [quickStatsLoading, setQuickStatsLoading] = useState(true);

  const requestId = useRef(0);
  const loadQuickStats = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setQuickStatsLoading(true);
    try {
      await ensureMaintenance();
      if (currentRequest !== requestId.current) return;
      const stats = await fetchCollectionQuickStats(branchId);
      if (currentRequest === requestId.current) setQuickStats(stats);
    } catch (error) {
      console.error('Error loading collection quick stats:', error);
    } finally {
      if (currentRequest === requestId.current) setQuickStatsLoading(false);
    }
  }, [branchId, ensureMaintenance]);

  useEffect(() => {
    if (user) loadQuickStats();
    return () => { requestId.current += 1; };
  }, [user, loadQuickStats]);

  useReconnectRefetch(() => { if (user) loadQuickStats(); });

  return { quickStats, quickStatsLoading, loadQuickStats };
}
