import { supabase } from '../../lib/supabase';
import { dalRead } from '../../lib/dataAccessLayer';
import type { CommissionRate } from './rates';

/** Shared confirmed schedule for the commission page and profile. */
export async function fetchCommissionRates(): Promise<CommissionRate[]> {
  const result = await dalRead('commission-rates:policy-issue-v2', async () => {
    const rates: CommissionRate[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('commission_rate_schedule')
        .select('effective_from, year1_percent, renewal_percent').order('effective_from').range(offset, offset + 499);
      if (error) throw error;
      rates.push(...((data ?? []) as CommissionRate[]));
      if (!data || data.length < 500) break;
    }
    if (!rates.length) throw new Error('تعذر تحميل قواعد نسب العمولات');
    return rates;
  }, { emptyValue: null });
  if (result.status !== 'online' || !result.data?.length) throw new Error('تعذر تأكيد قواعد نسب العمولات؛ أعد المحاولة');
  return result.data;
}
