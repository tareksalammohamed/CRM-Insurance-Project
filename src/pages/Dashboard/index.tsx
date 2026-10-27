import { LoadNotice } from '../../components/feedback/LoadNotice';
import { useDashboard } from './hooks/useDashboard';
import { DashboardLoading } from './components/DashboardLoading';
import { DashboardHeader } from './components/DashboardHeader';
import { DashboardEmptyState } from './components/DashboardEmptyState';
import { DashboardStats } from './components/DashboardStats';
import { DashboardTargets } from './components/DashboardTargets';
import { DashboardPerformance } from './components/DashboardPerformance';
import { DashboardKPIs } from './components/DashboardKPIs';
import { DashboardCharts } from './components/DashboardCharts';
import { useAuth } from '../../hooks/useAuth';
import { AdminDashboard } from '../AdminDashboard';

function OperationalDashboard() {
  const {
    stats,
    loading,
    teamLoading,
    teamError,
    dashboardError,
    lastUpdated,
    refreshing,
    refresh,
    selectedMonth,
    isCurrentMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    cancellationSummary,
    cancellationLoading,
    policyStatusData,
    teamPerformanceSections,
    sheetStack,
    user,
    getChildrenDetails,
    openTeamMemberSheet,
    handleSelectChild,
    handleSheetBack,
    handleSheetClose,
  } = useDashboard();

  if (loading) {
    return <DashboardLoading />;
  }

  if (dashboardError) return <div className="dashboard-page"><LoadNotice message={dashboardError} loading={refreshing} onRetry={() => void refresh()} /></div>;

  return (
    <div className="dashboard-page space-y-6 animate-fadeIn">
      <DashboardHeader
        selectedMonth={selectedMonth}
        isCurrentMonth={isCurrentMonth}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onCurrentMonth={goToCurrentMonth}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRefresh={refresh}
        userName={user?.name}
      />

      {stats && stats.totalPolicies === 0 && stats.totalCustomers === 0 && (
        <DashboardEmptyState />
      )}

      <section className="dashboard-section-block" aria-labelledby="dashboard-overview-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">ملخص المحفظة</span>
            <h3 id="dashboard-overview-title">العملاء والوثائق والإنتاج</h3>
          </div>
          <span className="dashboard-section-note">أرقام الشهر المختار</span>
        </div>
        <DashboardStats stats={stats} selectedMonth={selectedMonth} />
      </section>

      <section className="dashboard-section-block" aria-label="أهداف الشهر">
        <DashboardTargets stats={stats} selectedMonth={selectedMonth} />
      </section>

      <section className="dashboard-section-block" aria-label="إحصائيات الفريق">
        {teamLoading ? <p role="status" className="text-sm text-secondary-500 py-4">جاري تحميل تفاصيل أداء الفريق...</p> : teamError ? <p role="status" className="text-sm text-error-600 py-4">{teamError}</p> : <DashboardPerformance
          teamPerformanceSections={teamPerformanceSections}
          sheetStack={sheetStack}
          getChildrenDetails={getChildrenDetails}
          openTeamMemberSheet={openTeamMemberSheet}
          handleSelectChild={handleSelectChild}
          handleSheetBack={handleSheetBack}
          handleSheetClose={handleSheetClose}
          selectedMonth={selectedMonth}
        />}
      </section>

      <section className="dashboard-section-block" aria-labelledby="dashboard-collection-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">السيولة والمتابعة</span>
            <h3 id="dashboard-collection-title">التحصيل والإلغاءات</h3>
          </div>
          <span className="dashboard-section-note">اختصارات للمراجعة</span>
        </div>
        <DashboardKPIs stats={stats} cancellationSummary={cancellationSummary} cancellationLoading={cancellationLoading} selectedMonth={selectedMonth} />
      </section>

      <section className="dashboard-section-block dashboard-charts-block" aria-label="الرسوم البيانية">
        <DashboardCharts
          stats={stats}
          selectedMonth={selectedMonth}
          policyStatusData={policyStatusData}
        />
      </section>
    </div>
  );
}


export function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'super_admin') {
    return <AdminDashboard />;
  }

  return <OperationalDashboard />;
}
