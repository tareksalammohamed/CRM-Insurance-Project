/**
 * هيكل تحميل يحاكي بنية لوحة التحكم الحقيقية (Hero + طبقة KPI + التارجت +
 * قائمة) بدل دوّارة عامة، فالانتقال للمحتوى الفعلي يبقى بدون قفزة تخطيط.
 */
export function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fadeIn" role="status" aria-live="polite">
      <span className="sr-only">جارٍ تحميل لوحة التحكم…</span>

      {/* Hero */}
      <div className="dashboard-intro">
        <div className="dashboard-intro-copy w-full">
          <div className="skeleton-bar h-3 w-24 !bg-white/20" />
          <div className="skeleton-bar h-6 w-40 mt-2.5 !bg-white/25" />
          <div className="skeleton-bar h-3 w-32 mt-2 !bg-white/15" />
        </div>
      </div>

      {/* طبقة KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi-card">
            <div className="flex items-start justify-between gap-3">
              <div className="skeleton-bar h-3 w-16" />
              <div className="skeleton-bar h-10 w-10 !rounded-xl" />
            </div>
            <div className="skeleton-bar h-7 w-20 mt-3" />
          </div>
        ))}
      </div>

      {/* التارجت */}
      <div className="card">
        <div className="skeleton-bar h-4 w-28 mb-4" />
        <div className="skeleton-bar h-2.5 w-full !rounded-full mb-2" />
        <div className="flex justify-between mb-5">
          <div className="skeleton-bar h-3 w-20" />
          <div className="skeleton-bar h-3 w-20" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-bar h-24 !rounded-xl" />
          ))}
        </div>
      </div>

      {/* قائمة */}
      <div className="card">
        <div className="skeleton-bar h-4 w-24 mb-4" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton-bar h-9 w-9 !rounded-full" />
              <div className="flex-1 min-w-0">
                <div className="skeleton-bar h-3 w-1/3" />
                <div className="skeleton-bar h-2.5 w-1/2 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
