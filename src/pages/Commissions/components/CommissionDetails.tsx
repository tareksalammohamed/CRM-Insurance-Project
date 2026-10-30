import { FilterPicker } from '../../../components/forms/FilterPicker';
import { useMemo, useState } from 'react';
import { Banknote, CalendarClock, ReceiptText } from 'lucide-react';
import { SearchInput } from '../../../components/forms/SearchInput';
import { Pagination } from '../../../components/ui/Pagination';
import { COMMISSION_TYPE_LABELS, formatCurrency } from '../business/commissionsCalculator';
import type { CommissionRow } from '../types';

const PAGE_SIZE = 25;

/** Presentation filters never feed the monthly summary or calculation. */
export function CommissionDetails({ rows }: { rows: CommissionRow[] }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [day, setDay] = useState('all');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ar');
    return rows.filter(row => (type === 'all' || row.type === type)
      && (day === 'all' || String(row.dueDay) === day)
      && (!query || row.customerName.toLocaleLowerCase('ar').includes(query) || row.policyLast6.includes(query)));
  }, [rows, search, type, day]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = () => { setSearch(''); setType('all'); setDay('all'); setPage(1); };
  return (
    <section className="commission-details space-y-3" aria-label="تفاصيل العمولات">
      <div className="flex items-center gap-2">
        <ReceiptText aria-hidden="true" className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-bold text-secondary-900">تفاصيل العمولات</h3>
      </div>
      <div className="commission-details-filters">
        <SearchInput value={search} onChange={value => { setSearch(value); setPage(1); }} placeholder="اسم العميل أو آخر 6 أرقام من الوثيقة" />
        <label className="space-y-1 min-w-0"><span className="input-label">نوع العمولة</span>
          <FilterPicker label="نوع العمولة" value={type} onChange={value => { setType(value); setPage(1); }} options={[{ value: 'all', label: 'كل الأنواع' }, { value: 'year1', label: 'السنة الأولى' }, { value: 'renewal', label: 'السنة الثانية والثالثة' }]} />
        </label>
        <label className="space-y-1 min-w-0"><span className="input-label">يوم الصرف</span>
          <FilterPicker label="يوم الصرف" value={day} onChange={value => { setDay(value); setPage(1); }} options={[{ value: 'all', label: 'كل المواعيد' }, { value: '12', label: 'يوم 12' }, { value: '27', label: 'يوم 27' }]} />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary-500">
        <p role="status">{filtered.length ? `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, filtered.length)} من ${filtered.length} عملية` : 'لا توجد نتائج مطابقة'}</p>
        {(search || type !== 'all' || day !== 'all') && <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>مسح التصفية</button>}
      </div>
      <p className="text-xs text-secondary-500">التصفية تخص التفاصيل فقط؛ ملخص الشهر بالأعلى يشمل كل العمولات.</p>
      {visible.length === 0 ? <div className="py-8 text-center text-sm text-secondary-500">جرّب اسمًا أو رقم وثيقة آخر، أو امسح التصفية.</div> : <>
        <div className="commission-mobile-list md:hidden">
          {visible.map(row => <article key={row.id} className="commission-mobile-row">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-secondary-900 break-words min-w-0">{row.customerName}</h4>
              <span className={`badge shrink-0 ${row.type === 'year1' ? 'badge-info' : 'badge-success'}`}>{COMMISSION_TYPE_LABELS[row.type]}</span>
            </div>
            <p className="text-xs text-secondary-500 mt-1">آخر 6 أرقام من الوثيقة: <bdi className="font-medium">{row.policyLast6}</bdi></p>
            <div className="commission-row-footer">
              <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-secondary-900"><Banknote aria-hidden="true" className="w-4 h-4 text-success-600 shrink-0" />{formatCurrency(row.amount)}</span>
              <span className="inline-flex items-center gap-1 text-xs text-secondary-500"><CalendarClock aria-hidden="true" className="w-4 h-4" />صرف يوم {row.dueDay}</span>
            </div>
          </article>)}
        </div>
        <div className="table-container hidden md:block">
          <table><caption className="sr-only">عمولات الشهر وفق تصفية التفاصيل</caption><thead><tr>
            <th scope="col">اسم العميل</th><th scope="col">آخر 6 أرقام من الوثيقة</th><th scope="col">نوع العمولة</th><th scope="col">قيمة العمولة</th><th scope="col">تستحق يوم</th>
          </tr></thead><tbody>{visible.map(row => <tr key={row.id}>
            <td>{row.customerName}</td><td><bdi>{row.policyLast6}</bdi></td>
            <td><span className={`badge ${row.type === 'year1' ? 'badge-info' : 'badge-success'}`}>{COMMISSION_TYPE_LABELS[row.type]}</span></td>
            <td className="font-semibold tabular-nums">{formatCurrency(row.amount)}</td><td>يوم {row.dueDay}</td>
          </tr>)}</tbody></table>
        </div>
        <Pagination page={current} totalPages={pages} onPageChange={updater => setPage(updater(current))} />
      </>}
    </section>
  );
}
