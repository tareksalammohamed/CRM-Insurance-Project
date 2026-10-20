import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { readDisplayPreferences, saveDisplayPreferences, type DisplayPreference } from '../lib/displayPreferences';
export function DisplayPreferences() {
  const [value, setValue] = useState(readDisplayPreferences);
  const items: { key: keyof DisplayPreference; title: string; note: string }[] = [
    { key: 'compact', title: 'عرض مدمج', note: 'مسافات أقل في البطاقات والجداول لعرض بيانات أكثر.' },
    { key: 'reduceMotion', title: 'تقليل الحركة', note: 'إيقاف الحركات الزخرفية والانتقالات لتجربة أهدأ.' },
    { key: 'largeText', title: 'نص أكبر', note: 'تكبير النص الأساسي لتسهيل القراءة.' },
  ];
  return <section className="card space-y-3"><h3 className="font-bold flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-primary-600" />تفضيلات العرض</h3><p className="text-xs text-secondary-500">تُحفظ على هذا الجهاز فورًا، ولا تؤثر على الطباعة أو الحسابات.</p>
    <div className="grid gap-3 md:grid-cols-3">{items.map(item => <label key={item.key} className="flex items-start gap-3 rounded-xl border border-secondary-200 p-3 cursor-pointer"><input type="checkbox" className="mt-1 h-5 w-5" checked={value[item.key]} onChange={event => { const next = { ...value, [item.key]: event.target.checked }; setValue(next); saveDisplayPreferences(next); }} /><span><span className="block font-semibold text-sm">{item.title}</span><span className="block text-xs text-secondary-500 mt-1">{item.note}</span></span></label>)}</div>
  </section>;
}
