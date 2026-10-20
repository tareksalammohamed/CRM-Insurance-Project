import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { CommissionRate } from './rates';

export function useCommissionRates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['commission-rates', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const rates: CommissionRate[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('commission_rate_schedule')
          .select('effective_from, year1_percent, renewal_percent').order('effective_from').range(offset, offset + 499);
        if (error) throw error;
        rates.push(...((data ?? []) as CommissionRate[]));
        if (!data || data.length < 500) break;
      }
      if (!rates.length) throw new Error('Commission rate schedule unavailable');
      return rates;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
