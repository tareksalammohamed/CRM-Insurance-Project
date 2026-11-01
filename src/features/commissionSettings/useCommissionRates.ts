import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { fetchCommissionRates } from './service';

export function useCommissionRates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['commission-rates', user?.id, 'policy-issue-v2'],
    enabled: !!user,
    queryFn: fetchCommissionRates,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
