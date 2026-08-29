import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft } from 'lucide-react';
import clsx from 'clsx';

/** نبرة دلالية موحّدة لحاوية الأيقونة — اللون يحمل معنى ثابت فى كل التطبيق */
export type StatsCardTone = 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE_TILE_CLASS: Record<StatsCardTone, string> = {
  brand: 'kpi-icon-tile--brand',
  success: 'kpi-icon-tile--success',
  warning: 'kpi-icon-tile--warning',
  danger: 'kpi-icon-tile--danger',
  info: 'kpi-icon-tile--info',
};

interface StatsCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** كلاس الحدود اليمنى الكامل، مثال: 'border-r-4 border-r-primary-500' */
  borderClassName: string;
  /** كلاس الأيقونة الكامل، مثال: 'w-4 h-4 text-primary-500' */
  iconClassName: string;
  /** كلاس نص القيمة الكامل، افتراضيًا نفس التنسيق المستخدم فى كل الصفحات */
  valueClassName?: string;
  /** كلاس نص التسمية (Label) فوق القيمة — افتراضيًا رصاصي فاتح، ويمكن
   *  تغييره (مثال: لأسود واضح) لصفحات محددة من غير ما يأثر على باقي
   *  الصفحات اللي بتستخدم نفس الكارت */
  labelClassName?: string;
  /** محتوى إضافى يظهر أسفل القيمة (مثل: من إجمالي ...) */
  footer?: ReactNode;
  onClick?: () => void;
  /** نبرة حاوية الأيقونة — الافتراضى لون الهوية (نفس الشكل السابق) */
  tone?: StatsCardTone;
  /** وصف الإجراء عند كون البطاقة قابلة للنقر (للقارئات الصوتية) */
  ariaLabel?: string;
}

/**
 * بطاقة إحصائية (KPI) عامة.
 * استُخرج شكلها المرئى من الأنماط المتطابقة فى صفحات لوحة التحكم، العملاء،
 * الوثائق، الهيكل الوظيفي والتحصيل. لا تحمل أي منطق عمل أو بيانات — كل
 * القيم والألوان تُمرَّر من الصفحة المستدعية كما كانت تمامًا من قبل.
 *
 * ملاحظتان مهمّتان على السلوك المرئى:
 *  1) الرقم لا يُقصّ أبدًا: حجمه مرن (clamp فى .kpi-card بـsrc/index.css)
 *     ويُلَف عند الضرورة، فيبقى ظاهرًا بالكامل داخل البطاقة على أضيق شاشة.
 *  2) البطاقة القابلة للنقر تُعلن عن نفسها بصريًا (سهم صغير + حالة لمس)
 *     حتى لا يكون \"الرقم قابل للنقر\" معلومة مخفية عن المستخدم.
 */
export function StatsCard({
  label,
  value,
  icon: Icon,
  borderClassName,
  iconClassName,
  valueClassName = 'text-xl md:text-2xl font-bold text-secondary-900 mt-1.5',
  labelClassName = 'text-xs md:text-sm text-secondary-500',
  footer,
  onClick,
  tone = 'brand',
  ariaLabel,
}: StatsCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <p className={clsx(labelClassName, 'leading-5 min-w-0')}>{label}</p>
        <span
          className={clsx(
            'kpi-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
            TONE_TILE_CLASS[tone]
          )}
          aria-hidden="true"
        >
          <Icon className={iconClassName} />
        </span>
      </div>
      <p className={clsx('text-figure min-w-0', valueClassName)}>{value}</p>
      {footer}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || label}
        className={clsx(
          'kpi-card kpi-card-clickable card-interactive text-right w-full cursor-pointer active:translate-y-0 touch-target',
          borderClassName
        )}
      >
        {content}
        {/* مؤشر \"اضغط للتفاصيل\" — يوضّح إمكانية التنقل بدون إضافة نص يزاحم الرقم */}
        <ChevronLeft className="kpi-card-cue" aria-hidden="true" />
      </button>
    );
  }

  return <div className={clsx('kpi-card', borderClassName)}>{content}</div>;
}
