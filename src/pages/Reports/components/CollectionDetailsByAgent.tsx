import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Inbox, UserCircle } from 'lucide-react';
import { formatCurrency } from '../business/reportsCalculator';

type RawInstallment = {
  agentId: string | null;
  agentName: string;
  customerName: string;
  policyNumber: string;
  dueDate: string;
  amount: number;
  status: 'paid' | 'unpaid';
};

// جدول تفاصيل منظّم لتقارير التحصيل: بيجمع الأقساط تحت اسم كل وكيل، وبيحط
// تحت كل وكيل إجمالي المسدد وإجمالي المتبقي غير المسدد، ثم إجمالي عام فى
// الآخر. الفلتر (statusFilter) بيحدد إيه اللي يظهر فى الجدول نفسه بس —
// لو "الكل": بتتعرض كل الأقساط وتحت كل وكيل السطرين (مسدد + غير مسدد).
// لو "مسدد" أو "غير مسدد": بتتعرض بس الأقساط المطابقة، وتحت كل وكيل سطر
// واحد بالإجمالي المطابق.
export function CollectionDetailsByAgent({
  installments,
  statusFilter,
}: {
  installments: RawInstallment[];
  statusFilter: 'all' | 'paid' | 'unpaid';
}) {
  const filtered = statusFilter === 'all'
    ? installments
    : installments.filter((i) => i.status === statusFilter);

  const groups = new Map<string, RawInstallment[]>();
  filtered.forEach((i) => {
    const key = i.agentId || i.agentName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  });

  const sortedGroups = Array.from(groups.entries()).sort((a, b) =>
    a[1][0].agentName.localeCompare(b[1][0].agentName, 'ar')
  );

  const grandPaid = filtered.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const grandUnpaid = filtered.filter((i) => i.status === 'unpaid').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="card print:shadow-none print:border print:break-inside-avoid">
      <div className="card-section-head">
        <h3>تفاصيل السجلات (مجمّعة حسب الوكيل)</h3>
        {sortedGroups.length > 0 && (
          <span className="card-section-meta">{sortedGroups.length} وكيل</span>
        )}
      </div>
      {sortedGroups.length > 0 ? (
        <div className="space-y-5">
          {sortedGroups.map(([agentKey, rows]) => {
            const agentPaid = rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
            const agentUnpaid = rows.filter((r) => r.status === 'unpaid').reduce((s, r) => s + r.amount, 0);
            return (
              <div key={agentKey} className="print:break-inside-avoid">
                <h4 className="mb-2 flex items-center gap-1.5 border-b border-secondary-200 pb-1.5 text-[13px] font-extrabold tracking-tight text-secondary-800">
                  <UserCircle className="w-4 h-4 shrink-0 text-primary-600" />
                  <span className="truncate">{rows[0].agentName}</span>
                </h4>

                {/* ===== الموبايل: بطاقات بدل الجدول ===== */}
                <div className="stack-list md:hidden print:hidden">
                  {rows.map((r, idx) => (
                    <div key={idx} className="stack-row">
                      <div className="stack-row-head">
                        <span className="stack-row-title">
                          <span className="truncate">{r.customerName}</span>
                        </span>
                        <span
                          className={`badge text-[10px] shrink-0 ${r.status === 'paid' ? 'badge-success' : 'badge-warning'}`}
                        >
                          {r.status === 'paid' ? 'مسدد' : 'غير مسدد'}
                        </span>
                      </div>
                      <div className="stack-row-grid">
                        <div className="stack-row-cell">
                          <span>رقم الوثيقة</span>
                          <span className="font-mono" dir="ltr">{r.policyNumber}</span>
                        </div>
                        <div className="stack-row-cell">
                          <span>المبلغ</span>
                          <span>{formatCurrency(r.amount)}</span>
                        </div>
                        <div className="stack-row-cell col-span-2">
                          <span>التاريخ</span>
                          <span>{format(new Date(r.dueDate), 'd MMMM yyyy', { locale: ar })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {statusFilter !== 'unpaid' && (
                      <span className="badge badge-success text-[11px]">
                        المسدد: {formatCurrency(agentPaid)}
                      </span>
                    )}
                    {statusFilter !== 'paid' && (
                      <span className="badge badge-warning text-[11px]">
                        غير المسدد: {formatCurrency(agentUnpaid)}
                      </span>
                    )}
                  </div>
                </div>

                {/* ===== الديسكتوب/الطباعة: الجدول الكامل ===== */}
                <div className="table-container hidden md:block print:!block print:hover:bg-transparent">
                  <table>
                    <thead>
                      <tr>
                        <th>العميل</th>
                        <th>رقم الوثيقة</th>
                        <th>التاريخ</th>
                        <th>المبلغ</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={idx}>
                          <td>{r.customerName}</td>
                          <td className="font-mono" dir="ltr">{r.policyNumber}</td>
                          <td className="tabular-nums">{format(new Date(r.dueDate), 'd MMMM yyyy', { locale: ar })}</td>
                          <td className="tabular-nums font-semibold">{formatCurrency(r.amount)}</td>
                          <td>
                            <span
                              className={`badge ${r.status === 'paid' ? 'badge-success' : 'badge-warning'}`}
                            >
                              {r.status === 'paid' ? 'مسدد' : 'غير مسدد'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {statusFilter !== 'unpaid' && (
                        <tr>
                          <td colSpan={3} className="font-bold text-success-700">إجمالي المسدد</td>
                          <td colSpan={2} className="font-bold tabular-nums text-success-700">{formatCurrency(agentPaid)}</td>
                        </tr>
                      )}
                      {statusFilter !== 'paid' && (
                        <tr>
                          <td colSpan={3} className="font-bold text-warning-700">إجمالي المتبقي غير المسدد</td>
                          <td colSpan={2} className="font-bold tabular-nums text-warning-700">{formatCurrency(agentUnpaid)}</td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}

          <div className="pt-3 border-t-2 border-secondary-200 print:break-inside-avoid">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {statusFilter !== 'unpaid' && (
                <div className="kpi-card border-r-4 border-success-500 print:bg-white print:border">
                  <p className="metric-label">إجمالي المسدد (كل الوكلاء)</p>
                  <p className="text-figure text-success-700">{formatCurrency(grandPaid)}</p>
                </div>
              )}
              {statusFilter !== 'paid' && (
                <div className="kpi-card border-r-4 border-warning-500 print:bg-white print:border">
                  <p className="metric-label">إجمالي المتبقي غير المسدد (كل الوكلاء)</p>
                  <p className="text-figure text-warning-700">{formatCurrency(grandUnpaid)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-state-icon">
            <Inbox className="w-6 h-6" />
          </span>
          <p className="empty-state-title">لا توجد سجلات مطابقة لهذه الفلاتر</p>
          <p className="empty-state-desc">جرّب تعديل الفترة أو حالة السداد.</p>
        </div>
      )}
    </div>
  );
}
