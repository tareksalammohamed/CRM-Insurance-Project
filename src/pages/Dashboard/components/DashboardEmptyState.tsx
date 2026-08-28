import { Link } from 'react-router-dom';
import { TrendingUp, UserPlus, FileText } from 'lucide-react';

export function DashboardEmptyState() {
  return (
    <div className="card border-dashed" style={{ borderStyle: 'dashed' }}>
      <div className="flex items-start gap-3 md:gap-4">
        <span className="kpi-icon-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          <TrendingUp className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-secondary-900">لا يوجد نشاط مسجل بعد هذا الشهر</p>
          <p className="text-xs text-secondary-500 mt-1 leading-relaxed">
            ابدأ بإضافة عميل أو وثيقة جديدة وستظهر إحصائياتك هنا تلقائيًا
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Link to="/customers" className="btn btn-primary btn-sm">
              <UserPlus className="w-3.5 h-3.5" />
              إضافة عميل
            </Link>
            <Link to="/policies" className="btn btn-outline btn-sm">
              <FileText className="w-3.5 h-3.5" />
              إضافة وثيقة
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
