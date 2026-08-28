import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, RefreshCw, RotateCcw } from 'lucide-react';

interface DashboardHeaderProps {
  selectedMonth: Date;
  isCurrentMonth: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
  lastUpdated?: Date | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  userName?: string;
}

export function DashboardHeader({
  selectedMonth,
  isCurrentMonth,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
  lastUpdated,
  refreshing,
  onRefresh,
  userName,
}: DashboardHeaderProps) {
  const greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  const displayName = userName?.trim() || 'بك';
  const monthLabel = format(selectedMonth, 'MMMM yyyy', { locale: ar });

  return (
    <div className="dashboard-header">
      <div className="dashboard-intro">
        <div className="dashboard-intro-copy">
          <span className="dashboard-kicker">{greeting}، {displayName}</span>
          {/* عنوان الصفحة الأساسى — h1 واحد لكل شاشة (ترتيب عناوين سليم لقارئات الشاشة) */}
          <h1>مركز القيادة</h1>
          <p>إحصائيات شهر {monthLabel}</p>
        </div>

        <div className="dashboard-toolbar dashboard-toolbar-inline">
          {/* اختيار الشهر: أسهم للتنقل شهر لشهر + رجوع سريع للشهر الحالي لو
              المستخدم مش واقف عليه أصلاً. الشهر التالي مقفول عند الوصول
              للشهر الحقيقي الحالي (مفيش بيانات مستقبلية لعرضها). */}
          <div className="dashboard-month-controls flex items-center gap-0.5">
            <button
              type="button"
              onClick={onPreviousMonth}
              aria-label="الشهر السابق"
              className="w-9 h-9 min-h-9 flex items-center justify-center rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="min-w-[6.25rem] px-1 text-center">
              <span className="block text-[13px] font-bold leading-tight truncate" aria-live="polite">{monthLabel}</span>
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={onCurrentMonth}
                  className="mx-auto mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold hover:underline"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  الشهر الحالي
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onNextMonth}
              disabled={isCurrentMonth}
              aria-label="الشهر التالي"
              className="w-9 h-9 flex items-center justify-center rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {onRefresh && (
            <div className="dashboard-refresh-control flex flex-col items-end gap-0.5">
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label={refreshing ? 'جاري تحديث البيانات' : 'تحديث البيانات'}
                className="flex items-center gap-1.5 text-xs md:text-[13px] rounded-lg px-2.5 py-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden xs:inline">{refreshing ? 'جاري التحديث…' : 'تحديث'}</span>
              </button>
              {lastUpdated && (
                <span className="text-[10px] whitespace-nowrap">
                  {format(lastUpdated, 'hh:mm a', { locale: ar })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
