import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Search, UsersRound, X } from 'lucide-react';
import { AppDialog } from '../../components/ui/AppDialog';
import { SearchInput } from '../../components/forms/SearchInput';
import { getVisibleNavLayout } from '../../config/navigation';
import type { UserRole } from '../../lib/supabase';

const normalize = (text: string) => text.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[\u064B-\u065Fـ]/g, '').trim().toLowerCase();
const aliases: Record<string, string> = {
  '/collection': 'تحصيل سداد دفع اقساط ايصالات متاخرات',
  '/policies': 'وثيقة وثائق اصدار تامين', '/customers': 'عميل عملاء هاتف رقم قومي',
  '/commissions': 'عموله عمولات صرف', '/daily-reports': 'مواعيد مكالمات زيارات تقارير يوميه',
  '/monthly-closing': 'اقفال شهري مذكره تنسيب', '/settings': 'اعدادات نسب عمولات',
};

export function WorkspaceSearch({ role, onClose }: { role: UserRole; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const pages = useMemo(() => getVisibleNavLayout(role).flatMap(entry => entry.kind === 'standalone'
    ? [{ ...entry.item, group: 'أدوات' }]
    : entry.group.items.map(item => ({ ...item, group: entry.group.label }))), [role]);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = pages.filter(item => terms.every(term => normalize(`${item.label} ${item.subLabel ?? ''} ${aliases[item.path] ?? ''}`).includes(term)));
  const open = (path: string) => { onClose(); navigate(path); };
  const allowed = new Set(pages.map(item => item.path));
  return <AppDialog onClose={onClose} ariaLabel="البحث والتنقل" className="workspace-search-shell max-w-2xl">
    <div className="workspace-search-header">
      <div><p className="workspace-search-kicker">مساحة عمل واحدة</p><h2>عايز توصل لإيه؟</h2></div>
      <button type="button" onClick={onClose} className="icon-button" aria-label="إغلاق البحث"><X /></button>
    </div>
    <div className="px-4 pb-3 sm:px-5">
      <SearchInput autoFocus value={query} onChange={setQuery} placeholder="اكتب اسم صفحة، أو عميل، أو رقم وثيقة" />
      <p className="text-xs text-secondary-500 mt-2">اختار مكان البحث في البيانات، أو افتح صفحة من النتائج. تظهر الصفحات المتاحة لصلاحيتك فقط.</p>
    </div>
    <div className="workspace-search-results">
      {query.trim() && (allowed.has('/customers') || allowed.has('/policies')) && <section className="workspace-search-section" aria-label="البحث في البيانات">
        <h3>ابحث عن «{query.trim()}»</h3>
        <div className="workspace-search-scopes">
          {allowed.has('/customers') && <button type="button" onClick={() => open(`/customers?search=${encodeURIComponent(query.trim())}`)}><UsersRound aria-hidden="true" /><span>في العملاء<small>الاسم أو الهاتف أو الرقم القومي</small></span><ArrowLeft aria-hidden="true" /></button>}
          {allowed.has('/policies') && <button type="button" onClick={() => open(`/policies?search=${encodeURIComponent(query.trim())}`)}><FileText aria-hidden="true" /><span>في الوثائق<small>رقم الوثيقة أو اسم العميل</small></span><ArrowLeft aria-hidden="true" /></button>}
        </div>
      </section>}
      <section className="workspace-search-section" aria-label="الصفحات المتاحة">
        <h3>{query.trim() ? 'صفحات مرتبطة ببحثك' : 'وصول سريع للصفحات'}</h3>
        <div className="workspace-search-pages">
          {matches.map(({ path, label, group, icon: Icon }) => <button key={path} type="button" onClick={() => open(path)}><Icon aria-hidden="true" /><span>{label}<small>{group}</small></span><ArrowLeft aria-hidden="true" /></button>)}
        </div>
        {!matches.length && <p className="py-5 text-sm text-secondary-500"><Search className="inline w-4 h-4 ml-1" />لا توجد صفحة مطابقة. جرّب «تحصيل» أو «عمولات» أو اسم الصفحة.</p>}
      </section>
    </div>
    <div className="workspace-search-footer">اختصار الفتح: Ctrl / ⌘ + K · الإغلاق: Esc</div>
  </AppDialog>;
}
