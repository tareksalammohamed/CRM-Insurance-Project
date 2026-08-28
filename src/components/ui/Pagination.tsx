import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (updater: (p: number) => number) => void;
  /** كلاس الحاوية (المسافات/الحدود)، افتراضيًا نفس التنسيق المستخدم فى أغلب الصفحات */
  className?: string;
}

/**
 * ترقيم صفحات عام (السابق / أرقام الصفحات / التالي).
 * استُخرج من الأنماط المتطابقة فى صفحات التحصيل، الوثائق، العملاء،
 * المستخدمين وسجل العمليات. لا يحمل أى منطق عمل — الصفحة الحالية والإجمالي
 * يُمرَّران من الصفحة المستدعية كما كانا تمامًا من قبل، والانتقال يستخدم نفس
 * دالة onPageChange بنفس صيغة الـ updater (p) => number المستعملة فى كل
 * الصفحات، فلا يتغيّر أى سلوك أو استعلام.
 *
 * التحسين هنا مرئى/تفاعلى فقط: بدل "صفحة 3 من 12" كنص جامد، المستخدم يرى
 * أرقام الصفحات ويقدر يقفز لأى صفحة بضغطة واحدة (أقل عدد نقرات للوصول)،
 * مع اختصار ذكى (…) للقوائم الطويلة. على الموبايل تُخفى الأرقام ويظهر
 * العدّاد النصّى المدمج لتجنّب أى تجاوز أفقي على 320px.
 */

/**
 * يبنى قائمة الصفحات المعروضة: أول صفحة، آخر صفحة، والصفحة الحالية وجيرانها،
 * مع علامة اختصار (…) بين الفواصل. الناتج دائمًا قصير (٧ عناصر كحد أقصى)
 * فلا يتمدد الشريط مهما كان عدد الصفحات.
 */
function buildPageList(page: number, totalPages: number): (number | 'gap')[] {
  // حتى ٧ صفحات: نعرضها كلها بدون اختصار
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, page]);
  // جار واحد على كل جانب من الصفحة الحالية
  if (page - 1 > 1) pages.add(page - 1);
  if (page + 1 < totalPages) pages.add(page + 1);
  // نضمن عرض عنصرين إضافيين عند الأطراف حتى يبقى طول الشريط ثابتًا بصريًا
  if (page <= 3) { pages.add(2); pages.add(3); pages.add(4); }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap');
    result.push(p);
  });
  return result;
}

export function Pagination({ page, totalPages, onPageChange, className = 'pt-2' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageList = buildPageList(page, totalPages);

  return (
    <nav
      className={clsx('pagination-bar', className)}
      aria-label={`تنقل بين الصفحات، صفحة ${page} من ${totalPages}`}
    >
      <button
        onClick={() => onPageChange((p) => Math.max(1, p - 1))}
        disabled={page === 1}
        className="btn btn-ghost btn-sm disabled:opacity-40 shrink-0"
        aria-label="الصفحة السابقة"
      >
        <ChevronRight className="w-4 h-4" />
        <span className="hidden xs:inline">السابق</span>
      </button>

      {/* أرقام الصفحات — ديسكتوب/تابلت */}
      <div className="pagination-pages hidden sm:flex" role="group" aria-label="أرقام الصفحات">
        {pageList.map((entry, i) =>
          entry === 'gap' ? (
            <span key={`gap-${i}`} className="pagination-ellipsis" aria-hidden="true">…</span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(() => entry)}
              className="pagination-page"
              aria-current={entry === page ? 'page' : undefined}
              aria-label={entry === page ? `الصفحة ${entry}، الحالية` : `الانتقال للصفحة ${entry}`}
            >
              {entry}
            </button>
          )
        )}
      </div>

      {/* عدّاد مدمج — الموبايل (يمنع أى تجاوز أفقي على الشاشات الضيقة) */}
      <span className="pagination-counter sm:hidden" aria-hidden="true">
        {page} / {totalPages}
      </span>

      <button
        onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
        className="btn btn-ghost btn-sm disabled:opacity-40 shrink-0"
        aria-label="الصفحة التالية"
      >
        <span className="hidden xs:inline">التالي</span>
        <ChevronLeft className="w-4 h-4" />
      </button>
    </nav>
  );
}
