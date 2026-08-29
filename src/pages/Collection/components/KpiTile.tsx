import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft } from 'lucide-react';
import clsx from 'clsx';

/** نبرة دلالية للتحصيل — نفس دلالات النظام: مستحق/مسدد/متأخر/معلومة/هوية */
export type CollectionTone = 'due' | 'paid' | 'overdue' | 'info' | 'brand';

const TONE_CLASS: Record<CollectionTone, string> = {
  due: 'col-tone-due',
  paid: 'col-tone-paid',
  overdue: 'col-tone-overdue',
  info: 'col-tone-info',
  brand: 'col-tone-brand',
};

interface KpiTileProps {
  label: string;
  /** الرقم الرئيسي — يُمرَّر منسّقًا مسبقًا (formatCurrency أو عدد) */
  value: ReactNode;
  icon: LucideIcon;
  tone: CollectionTone;
  /** معلومة ثانوية/حالة أسفل الرقم (سياق: من إجمالي ... / عدد الأقساط) */
  footer?: ReactNode;
  /** نبرة لون الرقم نفسه — تُستخدم فقط حيث المعنى يستدعيه (مسدد/متأخر) */
  valueTone?: 'success' | 'danger';
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * بلاطة KPI مؤسسية لصفحة التحصيل.
 * ----------------------------------------------------------------------------
 * مكوّن عرض خالص: لا يحمل أى منطق عمل ولا يحسب أى قيمة — كل الأرقام تُمرَّر
 * جاهزة من الصفحة كما هى. مقصور على صفحة التحصيل (كلاسات .col-) فلا يؤثر
 * على بطاقات الإحصاءات فى باقي الصفحات.
 *
 * ضمانات مرئية:
 *  1) الرقم لا يُقصّ أبدًا: حجم مرن بـclamp + overflow-wrap، والبلاطة لها
 *     ارتفاع أدنى يكفى لرقم طويل + سطر حالة.
 *  2) البطاقة القابلة للنقر تُعلن عن نفسها (سهم + حالة لمس + حلقة تركيز)،
 *     وهدف اللمس كامل البلاطة (أكبر بكثير من 44px).
 */
export function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
  footer,
  valueTone,
  onClick,
  ariaLabel,
}: KpiTileProps) {
  const body = (
    <>
      <div className="col-kpi-top">
        <p className="col-kpi-label">{label}</p>
        <span className="col-kpi-tile" aria-hidden="true">
          <Icon />
        </span>
      </div>

      <p
        className={clsx(
          'col-kpi-value',
          valueTone === 'success' && 'col-kpi-value--success',
          valueTone === 'danger' && 'col-kpi-value--danger'
        )}
      >
        {value}
      </p>

      {footer ? <div className="col-kpi-foot">{footer}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || label}
        className={clsx('col-kpi', TONE_CLASS[tone])}
      >
        {body}
        <ChevronLeft className="col-kpi-cue" aria-hidden="true" />
      </button>
    );
  }

  return <div className={clsx('col-kpi', TONE_CLASS[tone])}>{body}</div>;
}
