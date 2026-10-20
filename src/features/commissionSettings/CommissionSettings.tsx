import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Percent } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCommissionRates } from './useCommissionRates';
import { cairoToday, LEGACY_COMMISSION_RATE, rateForDate, tomorrowInCairo, validateRate, type CommissionRate } from './rates';
import { LoadNotice } from '../../components/feedback/LoadNotice';

export function CommissionSettings() {
  const query = useCommissionRates();
  const client = useQueryClient();
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<CommissionRate>({ ...LEGACY_COMMISSION_RATE, effective_from: tomorrowInCairo() });
  const initialized = useRef(false);
  useEffect(() => {
    if (query.data && !initialized.current) {
      initialized.current = true;
      setDraft({ ...rateForDate(cairoToday(), query.data), effective_from: tomorrowInCairo() });
    }
  }, [query.data]);
  const current = rateForDate(cairoToday(), query.data ?? []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current || !query.data || query.isError) return;
    const error = validateRate(draft);
    if (error) { setMessage(error); return; }
    busy.current = true; setSaving(true); setMessage('');
    try {
      const { error } = await supabase.from('commission_rate_schedule').upsert(draft, { onConflict: 'effective_from' }).select('effective_from').single();
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ['commission-rates'] });
      setMessage('تم حفظ النسب. تُطبق على السداد من التاريخ المحدد، دون تغيير العمولات السابقة.');
    } catch { setMessage('تعذّر حفظ النسب. راجع الاتصال والصلاحية وتأكد أن تاريخ التطبيق ما زال في المستقبل.'); }
    finally { busy.current = false; setSaving(false); }
  };
  return <section className="card space-y-4" aria-labelledby="commission-settings-title">
    <h3 id="commission-settings-title" className="font-bold flex items-center gap-2"><Percent className="w-5 h-5 text-primary-600" />نسب العمولات</h3>
    <p className="text-sm text-secondary-500">إعداد عام لكل الفروع. النسب من مبلغ التأمين وتُوزع على الأقساط بنفس القواعد الحالية. التعديل متاح لمدير النظام فقط.</p>
    <LoadNotice message={query.isError ? 'تعذّر تحميل نسب العمولات؛ أعد المحاولة قبل التعديل.' : null} onRetry={() => void query.refetch()} loading={query.isFetching} />
    {query.isLoading ? <p role="status">جاري تحميل النسب…</p> : query.data && <>
      <div className="rounded-xl bg-primary-50 p-3 text-sm text-primary-800">الساري الآن: السنة الأولى <b>{current.year1_percent}%</b> · الثانية والثالثة <b>{current.renewal_percent}%</b></div>
      <form onSubmit={save} className="space-y-3">
        <fieldset disabled={saving || query.isError} className="grid gap-3 sm:grid-cols-3">
          <label className="input-label">السنة الأولى (%)<input className="input-field mt-1" type="number" min="0" max="100" step="0.0001" required value={Number.isNaN(draft.year1_percent) ? '' : draft.year1_percent} onChange={e => setDraft({ ...draft, year1_percent: e.target.valueAsNumber })} /></label>
          <label className="input-label">الثانية والثالثة (%)<input className="input-field mt-1" type="number" min="0" max="100" step="0.0001" required value={Number.isNaN(draft.renewal_percent) ? '' : draft.renewal_percent} onChange={e => setDraft({ ...draft, renewal_percent: e.target.valueAsNumber })} /></label>
          <label className="input-label">يسري على السداد من<input className="input-field mt-1" type="date" min={tomorrowInCairo()} required value={draft.effective_from} onChange={e => setDraft({ ...draft, effective_from: e.target.value })} /></label>
        </fieldset>
        <p className="text-xs text-secondary-500">مثال: 0.05 تعني 0.05%، أي 50 جنيهًا لكل 100,000 جنيه تأمين سنويًا قبل توزيع الأقساط. اختيار تاريخ مجدول موجود يُحدّث نسبه.</p>
        <button className="btn btn-primary" disabled={saving || query.isError}>{saving ? 'جاري الحفظ…' : 'حفظ نسب العمولات'}</button>
      </form>
      <div className="overflow-x-auto"><table className="table w-full"><caption className="text-start text-sm font-bold py-2">سجل النسب وتواريخ تطبيقها</caption><thead><tr><th>بداية التطبيق</th><th>الأولى</th><th>الثانية والثالثة</th><th>الحالة</th></tr></thead><tbody>{[...query.data].reverse().map(rate => <tr key={rate.effective_from}><td>{rate.effective_from === '1900-01-01' ? 'النسب الأصلية' : rate.effective_from}</td><td>{rate.year1_percent}%</td><td>{rate.renewal_percent}%</td><td>{rate.effective_from > cairoToday() ? <button type="button" className="text-primary-700 underline" onClick={() => setDraft(rate)}>تعديل المجدول</button> : rate.effective_from === current.effective_from ? 'ساري' : 'سابق'}</td></tr>)}</tbody></table></div>
    </>}
    {message && <p role="status" className="rounded-xl bg-secondary-50 p-3 text-sm">{message}</p>}
  </section>;
}
