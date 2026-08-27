import { useDashboard } from './hooks/useDashboard';
import { DashboardLoading } from './components/DashboardLoading';
import { DashboardHeader } from './components/DashboardHeader';
import { DashboardEmptyState } from './components/DashboardEmptyState';
import { DashboardStats } from './components/DashboardStats';
import { DashboardTargets } from './components/DashboardTargets';
import { DashboardPerformance } from './components/DashboardPerformance';
import { DashboardKPIs } from './components/DashboardKPIs';
import { DashboardCharts } from './components/DashboardCharts';

export function Dashboard() {
  const {
    stats,
    loading,
    lastUpdated,
    refreshing,
    refresh,
    selectedMonth,
    isCurrentMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    chartData,
    cancellationSummary,
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

  return (
    <div className="space-y-6 animate-fadeIn">
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

      <section className="dashboard-section-block" aria-labelledby="dashboard-performance-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">ملخص الفريق</span>
            <h3 id="dashboard-performance-title">إحصائيات الفريق</h3>
          </div>
          <span className="dashboard-section-note">أرقام الشهر المختار</span>
        </div>
        <DashboardPerformance
          teamPerformanceSections={teamPerformanceSections}
          sheetStack={sheetStack}
          getChildrenDetails={getChildrenDetails}
          openTeamMemberSheet={openTeamMemberSheet}
          handleSelectChild={handleSelectChild}
          handleSheetBack={handleSheetBack}
          handleSheetClose={handleSheetClose}
          selectedMonth={selectedMonth}
        />
      </section>

      <section className="dashboard-section-block" aria-labelledby="dashboard-collection-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">السيولة والمتابعة</span>
            <h3 id="dashboard-collection-title">التحصيل والإلغاءات</h3>
          </div>
          <span className="dashboard-section-note">اختصارات للمراجعة</span>
        </div>
        <DashboardKPIs stats={stats} cancellationSummary={cancellationSummary} selectedMonth={selectedMonth} />
      </section>

      <section className="dashboard-section-block dashboard-charts-block" aria-label="الرسوم البيانية">
        <DashboardCharts
          totalPolicies={stats?.totalPolicies || 0}
          policyStatusData={policyStatusData}
          chartData={chartData}
        />
      </section>
    </div>
  );
}
