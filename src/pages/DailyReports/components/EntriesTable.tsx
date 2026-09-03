import { APPOINTMENTS_QUALITY_LABELS, APPOINTMENTS_QUALITY_BADGE_CLASS } from '../types';
import { formatReportDate, formatReportDay, parseDateInput } from '../utils';
import type { DailyAgentStatRow } from '../types';

interface EntriesTableProps {
  entries: DailyAgentStatRow[];
}

/** جدول تفاصيل الأيام المسجّلة لإيجنت واحد خلال فترة معيّنة */
export function EntriesTable({ entries }: EntriesTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-secondary-400 text-center py-4">لا توجد أيام مسجّلة لهذه الفترة</p>;
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th scope="col">التاريخ</th>
            <th scope="col">الالتزام</th>
            <th scope="col">مكالمات</th>
            <th scope="col">نتج عنها مواعيد</th>
            <th scope="col">مواعيد فعلية</th>
            <th scope="col">جودة المواعيد</th>
            <th scope="col">عملاء جدد</th>
            <th scope="col">outdoor</th>
          </tr>
        </thead>
        <tbody>
          {entries
            .slice()
            .sort((a, b) => b.report_date.localeCompare(a.report_date))
            .map((e) => {
              const d = parseDateInput(e.report_date);
              return (
                <tr key={e.id}>
                  <td>{formatReportDate(d)} <span className="text-secondary-400">({formatReportDay(d)})</span></td>
                  <td>
                    <span className={`badge ${e.punctuality_ok ? 'badge-success' : 'badge-error'}`}>{e.punctuality_ok ? 'نعم' : 'لا'}</span>
                  </td>
                  <td>{e.calls_actual}</td>
                  <td>{e.calls_to_appointments}</td>
                  <td>{e.appointments_actual}</td>
                  <td>
                    {e.appointments_quality ? (
                      <span className={APPOINTMENTS_QUALITY_BADGE_CLASS[e.appointments_quality]}>
                        {APPOINTMENTS_QUALITY_LABELS[e.appointments_quality]}
                      </span>
                    ) : (
                      <span className="text-secondary-300">—</span>
                    )}
                  </td>
                  <td>{e.new_clients}</td>
                  <td>{e.is_outdoor ? 'نعم' : '—'}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
