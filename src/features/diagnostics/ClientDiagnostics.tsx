import { useSyncExternalStore } from 'react';
import { clearClientDiagnostics, getClientDiagnostics, subscribeClientDiagnostics, summarizeClientReads } from '../../lib/clientDiagnostics';
const labels: Record<string, string> = { dashboard: 'الرئيسية', customers: 'العملاء', policies: 'الوثائق', collection: 'التحصيل', commissions: 'العمولات', reports: 'التقارير', monthlyClosing: 'الإقفال', followups: 'المتابعات', profile: 'الملف الشخصي', dailyStats: 'النشاط اليومي', year2: 'السنوات اللاحقة', settings: 'الإعدادات', other: 'خدمات أخرى' };
export function ClientDiagnostics() {
  const rows = useSyncExternalStore(subscribeClientDiagnostics, getClientDiagnostics, getClientDiagnostics);
  const summary = summarizeClientReads(rows);
  const areas = [...new Set(rows.map(row => row.area))].map(area => ({ area, ...summarizeClientReads(rows.filter(row => row.area === area)) })).sort((a,b) => b.p95 - a.p95);
  return <section className="workspace-section space-y-3" aria-label="أداء القراءة على هذا الجهاز">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold text-secondary-900">أداء القراءة على هذا الجهاز</h2><p className="text-xs text-secondary-600">آخر ٨٠ قراءة في الجلسة الحالية، تشمل انتظار الشبكة وإعادة المحاولة والكاش. لا تمثل زمن الخادم وحده.</p></div><button className="btn btn-secondary btn-sm" onClick={clearClientDiagnostics} disabled={!rows.length}>تصفير القياس</button></div>
    <div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="surface-sunken"><strong>{summary.count}</strong><p>قراءة مقاسة</p></div><div className="surface-sunken"><strong>{summary.p95} ms</strong><p>زمن ٩٥٪ من القراءات أو أقل</p></div><div className="surface-sunken"><strong>{summary.degraded}</strong><p>قراءة بحالة اتصال أو تحديث متدهورة</p></div></div>
    {!rows.length ? <p className="text-sm text-secondary-500">افتح صفحات التطبيق ثم ارجع هنا لعرض القياسات.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-right p-2">المساحة</th><th>القراءات</th><th>زمن ٩٥٪ أو أقل</th><th>تحديث متدهور</th></tr></thead><tbody>{areas.map(area => <tr key={area.area} className="border-t border-secondary-200"><td className="p-2">{labels[area.area]}</td><td className="text-center">{area.count}</td><td className="text-center">{area.p95} ms</td><td className="text-center">{area.degraded}</td></tr>)}</tbody></table></div>}
    <p className="text-xs text-secondary-500">قياسات محلية مؤقتة لا تحتوي أسماء أو أرقام عملاء أو روابط بحث، وتُمسح عند تغيير الحساب. النسخة المحفوظة أو انقطاع الاتصال لا يعنيان خطأ في الحسابات.</p>
  </section>;
}
