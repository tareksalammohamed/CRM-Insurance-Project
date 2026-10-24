import { useId, useRef, useState } from 'react';
import { followupError } from './errors';
import { cairoToday, CONTACT_OUTCOMES, validateFollowup, type PromiseContext } from './model';
import { saveFollowup, type FollowupInsert } from './service';
export function FollowupForm({ customerId, context, onSaved }: { customerId: string; context?: PromiseContext; onSaved: () => void }) {
  const prefix = useId();
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('reached');
  const [nextDate, setNextDate] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [paymentMonth, setPaymentMonth] = useState(cairoToday().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const guard = useRef(false);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (guard.current) return;
    const error = validateFollowup({ notes, nextDate, nextAction, paymentMonth }, context);
    if (error) { setMessage(error); return; }
    const values: Omit<FollowupInsert, 'id'> = {
      customer_id: customerId, kind: context ? 'promise' : 'contact', outcome: context ? 'payment_promise' : outcome,
      notes: notes.trim(), next_action: context ? null : nextAction.trim() || null, next_date: nextDate || null,
      policy_id: context?.policyId || null, installment_id: context?.installmentId || null,
      payment_month: context && !context.installmentId ? `${paymentMonth}-01` : null,
    };
    const payload = JSON.stringify(values);
    if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    guard.current = true; setBusy(true); setMessage('');
    try {
      await saveFollowup({ ...values, id: attempt.current.id });
      setNotes(''); setNextAction(''); setNextDate(''); attempt.current = null;
      setMessage(context ? 'تم حفظ الوعد. السداد الفعلي يُسجّل من إجراء السداد المعتاد.' : 'تم حفظ المتابعة.');
      onSaved();
    } catch (error) { setMessage(followupError(error, 'تعذّر الحفظ. البيانات ما زالت هنا؛ راجع الاتصال ثم أعد المحاولة.')); }
    finally { guard.current = false; setBusy(false); }
  };
  return <form onSubmit={submit} className="space-y-3 border border-secondary-200 rounded-xl p-3 bg-white">
    <h4 className="font-bold text-secondary-900">{context ? 'تسجيل وعد بالسداد' : 'تسجيل متابعة العميل'}</h4>
    {context && <p className="text-xs text-secondary-600">وثيقة {context.policyNumber}{context.installmentNumber ? ` · القسط ${context.installmentNumber}` : ' · السنة الثانية وما بعدها'}. الوعد للمتابعة فقط، ولا يُسجّل تحصيلًا أو يغيّر استحقاق القسط.</p>}
    <fieldset disabled={busy} className="space-y-3">
      {!context && <div><label className="input-label" htmlFor={`${prefix}-outcome`}>نتيجة التواصل</label><select id={`${prefix}-outcome`} className="input" value={outcome} onChange={e => setOutcome(e.target.value)}>{Object.entries(CONTACT_OUTCOMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>}
      <div><label className="input-label" htmlFor={`${prefix}-notes`}>{context ? 'تفاصيل الاتفاق مع العميل' : 'ماذا حدث في التواصل؟'}</label><textarea id={`${prefix}-notes`} className="input min-h-20" value={notes} onChange={e => setNotes(e.target.value)} required maxLength={2000} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="input-label" htmlFor={`${prefix}-date`}>{context ? 'تاريخ وعد السداد' : 'موعد المتابعة القادمة (اختياري)'}</label><input id={`${prefix}-date`} type="date" className="input" min={cairoToday()} required={!!context} value={nextDate} onChange={e => setNextDate(e.target.value)} /></div>
        {context && !context.installmentId && <div><label className="input-label" htmlFor={`${prefix}-month`}>شهر التحصيل المقصود</label><input id={`${prefix}-month`} type="month" className="input" min={context.minimumMonth} required value={paymentMonth} onChange={e => setPaymentMonth(e.target.value)} /></div>}
      </div>
      {!context && <div><label className="input-label" htmlFor={`${prefix}-action`}>الخطوة القادمة {nextDate ? '(مطلوبة)' : '(اختياري)'}</label><input id={`${prefix}-action`} className="input" value={nextAction} onChange={e => setNextAction(e.target.value)} required={!!nextDate} maxLength={500} /></div>}
      <button type="submit" className="btn btn-primary btn-sm">{busy ? 'جاري الحفظ...' : context ? 'حفظ وعد السداد' : 'حفظ المتابعة'}</button>
    </fieldset>
    {message && <p className="text-sm text-secondary-700" role="status">{message}</p>}
  </form>;
}
