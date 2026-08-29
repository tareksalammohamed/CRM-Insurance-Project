/**
 * هيكل تحميل مطابق لشكل بطاقة القسط الجديدة (col-row).
 * مقصور على صفحة التحصيل حتى تبقى أبعاد الهيكل مساوية للبطاقة الحقيقية فلا
 * تحدث "قفزة" فى التخطيط لحظة وصول البيانات.
 */
export function LoadingState() {
  return (
    <div className="col-list">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="col-row col-tone-brand skeleton-shimmer">
          <div className="col-row-head">
            <div className="col-row-avatar skeleton-bar" />
            <div className="col-row-ident space-y-1.5">
              <div className="h-3.5 w-32 skeleton-bar rounded" />
              <div className="h-2.5 w-24 skeleton-bar rounded" />
            </div>
            <div className="h-5 w-16 skeleton-bar rounded-full shrink-0" />
          </div>

          <div className="col-row-amount">
            <div className="h-2.5 w-20 skeleton-bar rounded" />
            <div className="h-4 w-24 skeleton-bar rounded" />
          </div>

          <div className="col-row-grid">
            <div className="col-cell space-y-1.5">
              <div className="h-2 w-16 skeleton-bar rounded" />
              <div className="h-3 w-20 skeleton-bar rounded" />
            </div>
            <div className="col-cell space-y-1.5">
              <div className="h-2 w-12 skeleton-bar rounded" />
              <div className="h-3 w-16 skeleton-bar rounded" />
            </div>
            <div className="col-cell col-cell--wide space-y-1.5">
              <div className="h-2 w-14 skeleton-bar rounded" />
              <div className="h-3 w-28 skeleton-bar rounded" />
            </div>
          </div>

          <div className="col-row-actions">
            <div className="h-9 flex-1 skeleton-bar rounded-xl" />
            <div className="h-9 w-11 skeleton-bar rounded-xl shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
