import { supabase } from '../../lib/supabase';
import { freshDalRead } from '../../lib/dataAccessLayer';
import { clearAllDataCache } from '../../lib/dataCache';

import type { ClosingExtension } from './model';

export async function fetchClosingExtension(month: string): Promise<ClosingExtension | null> {
  const result = await freshDalRead(`closingExtension:${month}`, async () => {
    const { data, error } = await supabase.from('closing_period_extensions').select('id,month,extended_until,reason,updated_at').eq('month', month).maybeSingle();
    if (error) throw error;
    return data as ClosingExtension | null;
  }, { emptyValue: null });
  return result.data;
}
export async function saveClosingExtension(month: string, until: string, reason: string, expectedUntil: string | null) {
  const { data, error } = await supabase.rpc('set_closing_period_extension', { p_month: month, p_extended_until: until, p_reason: reason.trim(), p_expected_until: expectedUntil });
  if (error) throw error;
  // Financial caches predate this explicit company decision; queue data is separate.
  await clearAllDataCache();
  return data as { extension: ClosingExtension; assigned_count: number };
}
