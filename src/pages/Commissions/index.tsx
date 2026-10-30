import { PageHeader } from '../../components/layout/PageHeader';
import { CommissionDetails } from './components/CommissionDetails';
import { useCommissionRates } from '../../features/commissionSettings/useCommissionRates';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { LoadNotice } from '../../components/feedback/LoadNotice';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBranchContext } from '../../lib/branchContext';
import { useReconnectRefetch } from '../../hooks/useReconnectRefetch';
import { Wallet, CalendarClock, CalendarCheck2, Percent, AlertTriangle, Banknote, Coins } from 'lucide-react';
import clsx from 'clsx';

import type { CommissionRow } from './types';
import { fetchCommissionSourceData } from './services/commissionsService';
import {
  computeCommissionRows,
  computeSummary,
  formatCurrency,
} from './business/commissionsCalculator';

// صفحة العمولات: مستقلة تماماً عن باقي صفحات النظام — للعرض فقط، لا تُخزَّن
// أي عمولة بقاعدة البيانات، وتُحسب لحظياً اعتماداً على بيانات التحصيل
// الموجودة بالفعل (installments/payments لسنة أولى + year2_payments
// للتجديد). كل مستخدم يرى فقط عمولات الوثائق التي هو owner_id لها.
export function Commissions() {
  const { user } = useAuth();
  const ratesQuery = useCommissionRates();
  const guard = useRequestGuard();
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const { currentBranchId } = useBranchContext();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [missingSumAssuredCount, setMissingSumAssuredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // أول تحميل فقط (لسه مفيش بيانات) يستحق شاشة تحميل كاملة — تغيير الشهر
  // بعد كده يحافظ على الجدول الحالي ظاهر مع مؤشر تحديث بسيط
  const isInitialLoading = loading && rows.length === 0;

  const loadCommissions = useCallback(async () => {
    if (!user || !ratesQuery.data || !/^\d{4}-\d{2}$/.test(selectedMonth)) return;
    const request = guard.start();
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const selectedMonthDate = new Date(year, month - 1, 1);

      const { year1Payments, year2Payments, loadMessage: sourceMessage } = await fetchCommissionSourceData(user.id, selectedMonthDate, currentBranchId);
      if (!guard.isCurrent(request)) return;
      setLoadMessage(sourceMessage ?? null);
      const { rows: computedRows, missingSumAssuredCount: missingCount } = computeCommissionRows(
        year1Payments,
        year2Payments,
        selectedMonth,
        ratesQuery.data
      );

      // الأحدث أولاً حسب يوم الاستحقاق ثم النوع
      computedRows.sort((a, b) => a.dueDay - b.dueDay);
      setRows(computedRows);
      setMissingSumAssuredCount(missingCount);
    } catch (error) {
      if (!guard.isCurrent(request)) return;
      console.error('Error loading commissions:', error);
      setLoadMessage('تعذّر تحميل العمولات؛ أعد المحاولة.');
      setRows([]);
      setMissingSumAssuredCount(0);
    } finally {
      if (guard.isCurrent(request)) setLoading(false);
    }
  }, [user, selectedMonth, currentBranchId, ratesQuery.data, guard]);

  useEffect(() => {
    setRows([]);
    setMissingSumAssuredCount(0);
    void loadCommissions();
    return () => guard.invalidate();
  }, [loadCommissions, guard]);

  useReconnectRefetch(loadCommissions);

  const summary = computeSummary(rows);
  const year1Rows = rows.filter((row) => row.type === 'year1');
  const renewalRows = rows.filter((row) => row.type === 'renewal');
  const year1Summary = computeSummary(year1Rows);
  const renewalSummary = computeSummary(renewalRows);

  return (
    <div className="workspace-page workspace-page-commissions space-y-3 md:space-y-4">
      <PageHeader title="العمولات" subtitle="ملخص عمولاتك ومواعيد صرفها خلال الشهر المختار." action={
        <label className="flex items-center gap-2 text-xs font-medium text-secondary-600">
          شهر الصرف
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => { if (e.target.value) setSelectedMonth(e.target.value); }}
          className="input-field !w-auto !py-2 min-w-0"
        />
        </label>
      } />

      <LoadNotice message={ratesQuery.isError ? 'تعذّر تحميل نسب العمولات. لا يمكن تأكيد الحساب قبل إعادة تحميلها.' : loadMessage} loading={ratesQuery.isFetching} onRetry={() => { void ratesQuery.refetch(); void loadCommissions(); }} />
      {ratesQuery.isError ? <p className="card text-secondary-600">الحساب متوقف لحين تحميل النسب المعتمدة.</p> : <>
      {/* تنبيه: وثائق مسدد عليها أقساط الشهر ده (سنة أولى أو تجديد) بس
          "مبلغ التأمين" فيها لسه مش متسجل، فمش ممكن تُحسب عمولتها لحد ما يتضاف */}
      {!loading && missingSumAssuredCount > 0 && (
        <div className="card bg-warning-50/60 border border-warning-100 py-3 px-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning-800">
            يوجد {missingSumAssuredCount} {missingSumAssuredCount === 1 ? 'قسط مسدد' : 'أقساط مسددة'} لا يمكن احتساب
            عمولتها لأن "مبلغ التأمين" غير مسجل على الوثيقة — أضِف القيمة من صفحة الوثيقة لتظهر عمولتها هنا.
          </p>
        </div>
      )}

      {/* ملخص مختصر: الإجمالي ثم مكوناته، بدون تكرار مبالغ الصرف */}
      <section aria-label="ملخص العمولات" aria-busy={loading} className="space-y-2">
        <div className="card !p-3 md:!p-4 flex items-center justify-between gap-3 border-r-4 border-primary-500">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
              <Wallet aria-hidden="true" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-secondary-900">إجمالي عمولات الشهر</h3>
              <p className="text-xs text-secondary-500 mt-0.5">{loading ? 'جارٍ التحديث…' : `${rows.length} عملية محسوبة`}</p>
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-primary-700 tabular-nums text-left break-words">
            {isInitialLoading ? '—' : formatCurrency(summary.totalMonth)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { title: 'السنة الأولى', value: year1Summary.totalMonth, count: year1Rows.length, icon: Banknote, color: 'text-sky-700 bg-sky-100' },
            { title: 'السنة الثانية والثالثة', value: renewalSummary.totalMonth, count: renewalRows.length, icon: Coins, color: 'text-emerald-700 bg-emerald-100' },
          ].map(({ title, value, count, icon: Icon, color }) => (
            <div key={title} className="card !p-3 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', color)}>
                  <Icon aria-hidden="true" className="w-4 h-4" />
                </span>
                <h3 className="text-xs sm:text-sm font-semibold text-secondary-700">{title}</h3>
              </div>
              <p className="text-base sm:text-xl font-bold text-secondary-900 tabular-nums break-words">{isInitialLoading ? '—' : formatCurrency(value)}</p>
              <p className="text-xs text-secondary-500 mt-0.5">{loading ? 'جارٍ التحديث…' : `${count} قسط`}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="مواعيد صرف العمولات" className="card !p-3">
        <h3 className="text-xs font-bold text-secondary-500 mb-2">مواعيد الصرف</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { day: 12, amount: summary.dueOn12, note: 'مسددات 16–نهاية الشهر السابق', icon: CalendarCheck2 },
            { day: 27, amount: summary.dueOn27, note: 'مسددات 1–15 من الشهر الحالي', icon: CalendarClock },
          ].map(({ day, amount, note, icon: Icon }) => (
            <div key={day} className="min-w-0">
              <div className="flex items-center gap-1.5 text-secondary-700">
                <Icon aria-hidden="true" className="w-4 h-4 text-primary-600 shrink-0" />
                <span className="text-xs font-semibold">صرف يوم {day}</span>
              </div>
              <p className="text-sm sm:text-lg font-bold text-secondary-900 tabular-nums mt-1 break-words">{isInitialLoading ? '—' : formatCurrency(amount)}</p>
              <p className="text-[11px] sm:text-xs text-secondary-500 mt-0.5">{note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* الجدول */}
      <div className="card !p-3 md:!p-4">
        {loading && !isInitialLoading && (
          <p className="text-xs text-secondary-400 flex items-center gap-1 mb-2">
            <span className="w-3 h-3 rounded-full border-2 border-secondary-300 border-t-primary-500 animate-spin" />
            <span>جارِ التحديث...</span>
          </p>
        )}
        {isInitialLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-14">
            <div className="w-16 h-16 rounded-full bg-secondary-100 flex items-center justify-center mx-auto mb-4">
              <Percent className="w-8 h-8 text-secondary-400" />
            </div>
            <p className="text-secondary-600 font-medium">لا توجد عمولات لهذا الشهر</p>
          </div>
        ) : (
          <CommissionDetails key={selectedMonth} rows={rows} />
        )}
      </div>
      </>}
    </div>
  );
}
