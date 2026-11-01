import { supabase } from '../../lib/supabase';
import { dalRead } from '../../lib/dataAccessLayer';

export interface OperationalMonth {
  reporting_month: string;
  calendar_month: string;
  cairo_date: string;
  extended_until: string | null;
  server_now: string;
  valid_until: string;
  expiresAt: number;
}

export async function fetchOperationalMonth(userId: string): Promise<OperationalMonth> {
  const result = await dalRead(`operationalMonth:v1:${userId}`, async () => {
    const { data, error } = await supabase.rpc('get_operational_reporting_month');
    if (error) throw error;
    if (!data?.[0]) throw new Error('تعذر تحديد شهر العمل');
    return data[0] as Omit<OperationalMonth, 'expiresAt'>;
  }, { emptyValue: null, timeoutMs: 4000 });
  if (!result.data || result.status === 'error' || result.status === 'offline-empty') throw new Error('تعذر تحديد شهر العمل');
  const expiresAt = (result.cachedAt ?? Date.now()) + Date.parse(result.data.valid_until) - Date.parse(result.data.server_now);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('انتهى تأكيد شهر العمل؛ أعد التحميل');
  return { ...result.data, expiresAt };
}

