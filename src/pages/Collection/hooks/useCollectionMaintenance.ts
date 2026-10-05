import { useCallback, useRef } from 'react';
import { cancelSeverelyOverduePolicies } from '../services/collectionService';

// Shared by list and KPIs for this page visit. Filter/page changes never write.
export function useCollectionMaintenance(userId: string | undefined) {
  const run = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  return useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    if (!run.current || run.current.userId !== userId) {
      const promise = cancelSeverelyOverduePolicies().catch((error) => {
        console.error('Error cancelling severely overdue policies:', error);
      });
      run.current = { userId, promise };
    }
    return run.current.promise;
  }, [userId]);
}
