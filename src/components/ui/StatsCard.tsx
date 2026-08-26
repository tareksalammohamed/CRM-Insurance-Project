import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

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
}

/**
 * بطاقة إحصائية (KPI) عامة.
 * استُخرج شكلها المرئى من الأنماط المتطابقة فى صفحات لوحة التحكم، العملاء،
 * الوثائق، الهيكل الوظيفي والتحصيل. لا تحمل أي منطق عمل أو بيانات — كل
 * القيم والألوان تُمرَّر من الصفحة المستدعية كما كانت تمامًا من قبل.
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
}: StatsCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={clsx(labelClassName, 'leading-5')}>{label}</p>
        <span className="kpi-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
          <Icon className={iconClassName} />
        </span>
      </div>
      <p className={clsx('text-figure', valueClassName)}>{value}</p>
      {footer}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'kpi-card card-interactive text-right w-full cursor-pointer active:translate-y-0 touch-target',
          borderClassName
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={clsx('kpi-card', borderClassName)}>{content}</div>;
}
