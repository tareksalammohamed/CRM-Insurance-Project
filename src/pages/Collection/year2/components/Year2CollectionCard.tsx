import { Hash, UserRound, CalendarDays, CheckCircle2, AlertTriangle, Clock3, History, ListChecks, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Year2EligiblePolicy } from '../types';

interface Year2CollectionCardProps {
  policy: Year2EligiblePolicy;
  formatCurrency: (value: number) => string;
  onHistory: (policy: Year2EligiblePolicy) => void;
  onAddPayment: (policy: Year2EligiblePolicy) => void;
}

// أول حرف من اسم العميل — نفس أسلوب بطاقة السنة الأولى بالظبط
function initialOf(name: string | undefined): string {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0) : '؟';
}

// تسمية السنة التأمينية بالعربي — أول 10 سنين بصيغتها الفصيحة المعتادة
// (الثانية، الثالثة...)، وأي رقم أكبر بيتحول لصيغة رقمية بسيطة "السنة 11"
// بدل ما نحتاج نغطي كل صيغ العدد العربي
const ORDINAL_YEAR_LABELS: Record<number, string> = {
  2: 'الثانية', 3: 'الثالثة', 4: 'الرابعة', 5: 'الخامسة', 6: 'السادسة',
  7: 'السابعة', 8: 'الثامنة', 9: 'التاسعة', 10: 'العاشرة',
};

function yearBadgeLabel(yearNumber: number | undefined): string {
  if (!yearNumber || yearNumber < 2) return 'السنة الثانية';
  const ordinal = ORDINAL_YEAR_LABELS[yearNumber];
  return ordinal ? `السنة ${ordinal}` : `السنة ${yearNumber}`;
}

function Year2CollectionCardImpl({ policy, formatCurrency, onHistory, onAddPayment }: Year2CollectionCardProps) {
  const status = policy.year2_status ?? 'month';
  // نفس نبرات الألوان المستخدمة فى بطاقة السنة الأولى بالضبط (مسدد = أخضر،
  // متأخر = أحمر، مستحق = عنبري) — عشان الشعور البصري يفضل واحد فى الشاشتين
  const tone = status === 'paid' ? 'col-tone-paid' : status === 'overdue' ? 'col-tone-overdue' : 'col-tone-due';
  const StatusIcon = status === 'paid' ? CheckCircle2 : status === 'overdue' ? AlertTriangle : Clock3;
  const statusLabel = status === 'paid' ? 'تم السداد' : status === 'overdue' ? 'متأخر' : 'مستحق';

  const customerName = policy.customer?.name || '-';

  return (
    <div className={clsx('col-row', tone)}>
      {/* ===== الهوية: العميل + رقم الوثيقة + السنة التأمينية الحالية + حالة التحصيل ===== */}
      <div className="col-row-head">
        <span className="col-row-avatar" aria-hidden="true">
          {initialOf(policy.customer?.name)}
        </span>

        <div className="col-row-ident">
          <span className="col-row-name" title={customerName}>
            {customerName}
          </span>
          <div className="col-row-sub">
            <span className="col-row-policy" dir="ltr">
              <Hash aria-hidden="true" />
              <span>{policy.policy_number}</span>
            </span>
            <span className="col-kpi-chip">{yearBadgeLabel(policy.policy_year_number)}</span>
          </div>
        </div>

        <span className="col-badge">
          <StatusIcon aria-hidden="true" />
          <span>{statusLabel}</span>
        </span>
      </div>

      {/* ===== إجمالي محصل السنوات اللاحقة + عدد مرات التحصيل من أول بداية التأمين ===== */}
      <div className="col-row-amount col-row-amount--split">
        <div className="col-row-amount-primary">
          <span className="col-row-amount-label">إجمالي المحصل (السنة الثانية وما بعدها)</span>
          <span className="col-row-amount-value">{formatCurrency(policy.year2_total_paid || 0)}</span>
        </div>

        {typeof policy.total_paid_installments_count === 'number' && (
          <>
            <span className="col-row-amount-divider" aria-hidden="true" />
            <div className="col-row-amount-secondary">
              <span className="col-row-amount-secondary-label">
                <ListChecks aria-hidden="true" />
                <span>مسدد من البداية</span>
              </span>
              <span className="col-row-amount-secondary-value">{policy.total_paid_installments_count}</span>
            </div>
          </>
        )}
      </div>

      {/* ===== تفاصيل تشغيلية ===== */}
      <div className="col-row-grid">
        <div className="col-cell">
          <p className="col-cell-label">
            <CalendarDays aria-hidden="true" />
            <span>بداية التأمين</span>
          </p>
          <p className="col-cell-value">{format(new Date(policy.start_date), 'dd/MM/yyyy')}</p>
        </div>

        <div className="col-cell">
          <p className="col-cell-label">
            <UserRound aria-hidden="true" />
            <span>المسؤول</span>
          </p>
          <p className="col-cell-value col-cell-value--muted">{policy.owner?.name || '-'}</p>
        </div>
      </div>

      <div className="col-row-actions">
        <button onClick={() => onAddPayment(policy)} className="btn btn-primary btn-sm flex-1">
          <CheckCircle className="w-4 h-4" />
          <span>تسجيل تحصيل</span>
        </button>
        <button
          onClick={() => onHistory(policy)}
          className="btn btn-secondary btn-sm touch-target shrink-0"
          title="سجل التحصيل"
          aria-label="سجل التحصيل"
        >
          <History className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export const Year2CollectionCard = Year2CollectionCardImpl;
