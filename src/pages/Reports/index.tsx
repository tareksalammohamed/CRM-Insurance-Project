import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBranchContext } from '../../lib/branchContext';
import { useReconnectRefetch } from '../../hooks/useReconnectRefetch';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Printer, Users, FileText, TrendingUp, Wallet, AlertTriangle,
  UserCheck, Users2, ShieldCheck, XCircle, RefreshCw, Layers,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';

import { PageHeader } from '../../components/layout/PageHeader';
import { ROLE_LABELS } from '../../lib/supabase';
import type { ReportType, DateRange } from './types';
import {
  fetchUserSubtreeIds, fetchCustomerRequestsReport, fetchPoliciesForOwners, fetchPaymentsInRange,
  type CustomerRequestFilter,
  fetchAllInstallmentsWithPolicy, fetchAgentsForReport, fetchSimplePaymentsInRange,
  fetchUsersByRole, fetchLeadersPerformance, fetchInstallmentsDueInRange, fetchUsersInSubtree,
  fetchSupervisoryPerformanceUsers,
} from './services/reportsService';
import {
  fetchActivityTargets, fetchDailyStatsForUsers,
} from './services/activityTargetsService';
import type { ActivityTargets } from './business/performanceScoreCalculator';
import {
  formatCurrency, computeCustomersReport, computePoliciesReport, computeProductionReport,
  computeCollectionReport, computeOverdueReport, computeAgentsReport,
  computeTeamPerformanceReport, computeCancellationsReport,
} from './business/reportsCalculator';
import { loadCancellationSummary } from '../Cancellations/services/cancellationService';
import { ActivityTargetsPanel } from './components/ActivityTargetsPanel';
import { ReportButtonGroup } from './components/ReportButtonGroup';
import { PerformanceScoreRow } from './components/PerformanceScoreRow';
import { CollectionDetailsByAgent } from './components/CollectionDetailsByAgent';
import { SupervisoryPerformancePanel } from './components/SupervisoryPerformancePanel';
import { computeSupervisoryPerformanceReport } from './business/supervisoryPerformanceCalculator';

export function Reports() {
  const { user } = useAuth();
  const { currentBranchId } = useBranchContext();
  const navigate = useNavigate();
  const [reportType, setReportType] = useState<ReportType>('customers');
  const [customerRequestFilter, setCustomerRequestFilter] = useState<CustomerRequestFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const currentYear = new Date().getFullYear();
  // فلتر الشهر: بصيغة yyyy-MM، يُستخدم فقط عندما تكون dateRange = 'month'
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  // فلتر الربع السنوي: رقم الربع (1-4) والسنة — يختارهما المستخدم بحرية
  // بدل الاعتماد دائماً على آخر 3 أشهر من تاريخ اليوم
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.floor(new Date().getMonth() / 3) + 1);
  const [quarterYear, setQuarterYear] = useState<number>(currentYear);
  // فلتر السنة: يختارها المستخدم بحرية بدل تثبيتها على السنة الحالية دائماً
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  // فلتر الحالة (مسدد/غير مسدد) لتقرير التحصيل الدوري وإجمالي الإنتاج
  // والتحصيل — بيتحكم بس فى عرض جدول التفاصيل المطبوع (مش فى إجماليات
  // الملخص اللي فوق، اللي بتفضل بتعرض أرقام الفترة كاملة)
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  // فلتر "اختيار مستخدم معين": فاضي = نطاقي أنا كامل (زي الافتراضي القديم).
  // لو اتحدد مستخدم، التقرير بيتحسب على أساس هو وكل اللي تحته فى الهيكل
  // الوظيفي فقط (حسب get_user_subtree)، بدل نطاقي أنا
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectableUsers, setSelectableUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  // الأهداف اليومية المستخدمة لحساب "التقييم الشامل" (درجة النشاط) — تُحمّل
  // مرة واحدة، وتُستخدم فى تبويبات أداء الوكلاء/رؤساء المجموعات/المراقبين
  const [activityTargets, setActivityTargets] = useState<(ActivityTargets & { id: string | null }) | null>(null);
  // أول تحميل فقط (لسه مفيش بيانات لأي تقرير) يستحق شاشة تحميل كاملة —
  // تبديل نوع التقرير أو الفلتر بعد كده يحافظ على آخر تقرير ظاهر مع
  // مؤشر تحديث بسيط بدل ما تختفي الشاشة بالكامل فى كل مرة
  const isInitialLoading = loading && data === null;

  // نمط "latest ref": الـ effect يعيد التحميل عند تغير بيانات الفلاتر فقط (نفس
  // السلوك السابق تمامًا)، ويستدعي دائمًا أحدث نسخة من loadReport عبر ref
  // بدل إدراج الدالة نفسها فى الـ deps (هويتها تتغير كل render فكانت ستسبب
  // إعادة تحميل فى كل render) — بدون أى eslint-disable.
  const loadReportRef = useRef<() => void>(() => {});
  loadReportRef.current = () => { void loadReport(); };

  useEffect(() => {
    if (user) {
      loadReportRef.current();
    }
  }, [user, reportType, dateRange, selectedMonth, selectedQuarter, quarterYear, selectedYear, selectedUserId, currentBranchId, activityTargets, customerRequestFilter]);

  useReconnectRefetch(() => { if (user) loadReport(); });

  // قائمة المستخدمين القابلين للاختيار فى فلتر "مستخدم معين" — كل اللي تحت
  // نطاق المستخدم الحالي فى الهيكل الوظيفي (بما فيهم هو نفسه)، تُحمّل مرة
  // واحدة لما المستخدم يفتح الصفحة
  useEffect(() => {
    if (!user) return;
    (async () => {
      const baseIds = await fetchUserSubtreeIds(user.id, currentBranchId);
      const list = await fetchUsersInSubtree(baseIds);
      setSelectableUsers(list);
    })();
  }, [user, currentBranchId]);

  useEffect(() => {
    (async () => {
      const targets = await fetchActivityTargets();
      setActivityTargets(targets);
    })();
  }, []);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'month': {
        // استخدام الشهر المُختار من الفلتر بدل الاعتماد دائماً على الشهر الحالي
        const base = selectedMonth ? new Date(`${selectedMonth}-01T00:00:00`) : now;
        return { start: startOfMonth(base), end: endOfMonth(base) };
      }
      case 'quarter': {
        // الربع المختار (1: يناير-مارس ... 4: أكتوبر-ديسمبر) من السنة المختارة
        const startMonth = (selectedQuarter - 1) * 3;
        const start = new Date(quarterYear, startMonth, 1);
        const end = endOfMonth(new Date(quarterYear, startMonth + 2, 1));
        return { start, end };
      }
      case 'year': {
        const yearDate = new Date(selectedYear, 0, 1);
        return { start: startOfYear(yearDate), end: endOfYear(yearDate) };
      }
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      // تقرير "نسبة الإلغاءات" لا يحتاج مطلقًا شجرة المستخدمين الفرعية (يعتمد
      // فقط على loadCancellationSummary) — تفادي استعلام RPC غير مستخدم له
      if (reportType === 'cancellations') {
        await loadCancellationsReport();
        return;
      }

      const baseUserIds = await fetchUserSubtreeIds(user!.id, currentBranchId);
      // لو محدد مستخدم معين فى الفلتر: النطاق يبقى هو وكل اللي تحته بس
      // (مقصور دايماً على نطاق المستخدم الحالي الأصلي كحماية إضافية)
      const userIds = selectedUserId
        ? (await fetchUserSubtreeIds(selectedUserId, currentBranchId)).filter((id) => baseUserIds.includes(id))
        : baseUserIds;

      switch (reportType) {
        case 'customers':
          await loadCustomersReport(userIds, start, end, customerRequestFilter);
          break;
        case 'policies':
          await loadPoliciesReport(userIds);
          break;
        case 'production':
          await loadProductionReport(userIds, start, end);
          break;
        case 'collection':
          await loadCollectionReport(userIds, start, end);
          break;
        case 'production_collection':
          await loadProductionAndCollectionReport(userIds, start, end);
          break;
        case 'overdue':
          await loadOverdueReport(userIds);
          break;
        case 'agents':
          await loadAgentsReport(userIds, start, end);
          break;
        case 'group_leaders':
          await loadGroupLeadersReport(userIds, start, end);
          break;
        case 'supervisors':
          await loadSupervisorsReport(userIds, start, end);
          break;
        case 'supervisory_performance':
          await loadSupervisoryPerformanceReport(userIds, start, end);
          break;
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomersReport = async (
    userIds: string[],
    start: Date,
    end: Date,
    filter: CustomerRequestFilter,
  ) => {
    const customers = await fetchCustomerRequestsReport(userIds, start, end, filter);
    const { data: reportData, chartData: chart } = computeCustomersReport(customers);
    setData(reportData);
    setChartData(chart);
  };

  const loadPoliciesReport = async (userIds: string[]) => {
    const policies = await fetchPoliciesForOwners(userIds);
    const { data: reportData, chartData: chart } = computePoliciesReport(policies);
    setData(reportData);
    setChartData(chart);
  };

  const loadProductionReport = async (userIds: string[], start: Date, end: Date) => {
    const payments = await fetchPaymentsInRange(start, end);
    const { data: reportData, chartData: chart } = computeProductionReport(payments, userIds);
    setData(reportData);
    setChartData(chart);
  };

  const loadCollectionReport = async (userIds: string[], start: Date, end: Date) => {
    const [payments, installmentsDue] = await Promise.all([
      fetchPaymentsInRange(start, end),
      fetchInstallmentsDueInRange(userIds, start, end),
    ]);
    const { data: reportData, chartData: chart } = computeCollectionReport(payments, installmentsDue, userIds);
    setData(reportData);
    setChartData(chart);
  };

  const loadProductionAndCollectionReport = async (userIds: string[], start: Date, end: Date) => {
    const [payments, installmentsDue] = await Promise.all([
      fetchPaymentsInRange(start, end),
      fetchInstallmentsDueInRange(userIds, start, end, true),
    ]);
    // includeFirstInstallments=true: مستحق ومسدد واحد مجمّع (إنتاج جديد +
    // تحصيل دوري معاً) بدل تقسيمهما لبندين منفصلين
    const { data: reportData, chartData: chart } = computeCollectionReport(payments, installmentsDue, userIds, true);
    setData(reportData);
    setChartData(chart);
  };

  const loadOverdueReport = async (userIds: string[]) => {
    const installments = await fetchAllInstallmentsWithPolicy();
    const { data: reportData, chartData: chart } = computeOverdueReport(installments, userIds);
    setData(reportData);
    setChartData(chart);
  };

  const loadAgentsReport = async (userIds: string[], start: Date, end: Date) => {
    // الثلاثة مستقلون (لا يعتمد أي منهم على نتيجة الآخر) — تنفيذهم بالتوازي
    // بدل التسلسل يقلّل زمن التحميل دون أي تغيير فى النتيجة
    const [agents, payments, dailyStats] = await Promise.all([
      fetchAgentsForReport(userIds),
      fetchSimplePaymentsInRange(start, end),
      fetchDailyStatsForUsers(userIds, start, end),
    ]);
    const dailyStatsByAgent = new Map<string, typeof dailyStats>();
    dailyStats.forEach((row) => {
      if (!dailyStatsByAgent.has(row.agent_id)) dailyStatsByAgent.set(row.agent_id, []);
      dailyStatsByAgent.get(row.agent_id)!.push(row);
    });
    const { data: reportData, chartData: chart } = computeAgentsReport(
      agents, payments, dailyStatsByAgent, activityTargets ?? undefined,
    );
    setData(reportData);
    setChartData(chart);
  };

  const loadGroupLeadersReport = async (userIds: string[], start: Date, end: Date) => {
    const leaders = await fetchUsersByRole(userIds, ['group_leader']);
    const performance = await fetchLeadersPerformance(leaders, start, end, currentBranchId, activityTargets ?? undefined);
    const { details } = computeTeamPerformanceReport(performance, 'رئيس المجموعة');

    setData({ leaders: performance, details });
    setChartData(performance.map((p) => ({ name: p.name, value: p.finalScore })));
  };

  // تقرير "نسبة الإلغاءات" له فترة حساب ثابتة دائماً (أول يناير حتى نهاية
  // الشهر الحالي)، مستقلة عن فلاتر الفترة الخاصة بباقي التقارير
  const loadCancellationsReport = async () => {
    if (!user) return;
    const summary = await loadCancellationSummary({ id: user.id, name: user.name, role: user.role });
    const { data: reportData, chartData: chart } = computeCancellationsReport(summary);
    setData(reportData);
    setChartData(chart);
  };

  const loadSupervisoryPerformanceReport = async (userIds: string[], start: Date, end: Date) => {
    const [users, payments, dailyStats] = await Promise.all([
      fetchSupervisoryPerformanceUsers(userIds, currentBranchId),
      fetchSimplePaymentsInRange(start, end),
      fetchDailyStatsForUsers(userIds, start, end),
    ]);
    const result = computeSupervisoryPerformanceReport(users, payments, dailyStats, activityTargets ?? undefined);
    setData(result.data);
    setChartData(result.chartData);
  };

  const loadSupervisorsReport = async (userIds: string[], start: Date, end: Date) => {
    const supervisors = await fetchUsersByRole(userIds, ['supervisor', 'general_supervisor']);
    const performance = await fetchLeadersPerformance(supervisors, start, end, currentBranchId, activityTargets ?? undefined);
    const { details } = computeTeamPerformanceReport(performance, 'المراقب');

    setData({ supervisors: performance, details });
    setChartData(performance.map((p) => ({ name: p.name, value: p.finalScore })));
  };

  const mainReportButtons: { id: ReportType; label: string; icon: typeof Users }[] = [
    { id: 'customers', label: 'طلبات التأمين', icon: Users },
    { id: 'policies', label: 'تقرير الوثائق', icon: FileText },
    { id: 'production', label: 'الإنتاج الجديد', icon: TrendingUp },
    { id: 'collection', label: 'التحصيل الدوري', icon: Wallet },
    { id: 'production_collection', label: 'إجمالي الإنتاج والتحصيل', icon: Layers },
    { id: 'overdue', label: 'الأقساط المتأخرة', icon: AlertTriangle },
  ];

  const performanceReportButtons: { id: ReportType; label: string; icon: typeof Users }[] = [
    { id: 'agents', label: 'أداء الوكلاء', icon: UserCheck },
    { id: 'group_leaders', label: 'أداء رؤساء المجموعات', icon: Users2 },
    { id: 'supervisors', label: 'أداء المراقبين', icon: ShieldCheck },
    { id: 'supervisory_performance', label: 'أداء المراقبة', icon: Layers },
  ];

  const cancellationsReportButtons: { id: ReportType; label: string; icon: typeof Users }[] = [
    { id: 'cancellations', label: 'نسبة الإلغاءات', icon: XCircle },
  ];

  const reportButtons = [...mainReportButtons, ...performanceReportButtons, ...cancellationsReportButtons];

  // قائمة السنوات المتاحة للاختيار (5 سنوات سابقة + السنة القادمة)
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear + 1 - i);

  const { start: periodStart, end: periodEnd } = getDateRange();
  const currentReportLabel = reportType === 'customers'
    ? 'طلبات التأمين وبيانات العملاء'
    : reportType === 'supervisory_performance'
      ? 'أداء المراقبة'
      : reportButtons.find((r) => r.id === reportType)?.label;
  const detailsColumns = data?.details && data.details.length > 0 ? Object.keys(data.details[0]) : [];

  return (
    <div className="print-report space-y-6 animate-fadeIn print:space-y-3">
      {/* رأس خاص بالطباعة فقط - لا يظهر أثناء الاستخدام العادى */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">{currentReportLabel}</h2>
        <p className="text-sm text-secondary-600 mt-1">
          الفترة من {format(periodStart, 'd MMMM yyyy', { locale: ar })} إلى{' '}
          {format(periodEnd, 'd MMMM yyyy', { locale: ar })}
        </p>
        <p className="text-xs text-secondary-400 mt-1">
          تاريخ الطباعة: {format(new Date(), 'd MMMM yyyy - HH:mm', { locale: ar })}
        </p>
      </div>

      <div className="print:hidden">
        <PageHeader
          title={reportType === 'customers' ? 'طلبات التأمين وبيانات العملاء' : 'مؤشرات الأداء والإحصائيات'}
          subtitle={reportType === 'customers'
            ? 'متابعة طلبات التأمين، حالة الإصدار، وقيمة التأمين حسب الوكيل'
            : 'تقارير أداء الوكلاء ورؤساء المجموعات والمراقبين'}
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="btn btn-secondary"
                title="طباعة التقرير"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة</span>
              </button>
            </div>
          }
        />
        {loading && !isInitialLoading && (
          <p className="flex items-center gap-1.5 text-secondary-400 text-xs mt-1.5">
            <RefreshCw className="w-3 h-3 animate-spin" />
            جارِ التحديث...
          </p>
        )}
      </div>

      <div className="card print:hidden border-primary-100/50 bg-gradient-to-br from-white to-primary-50/30 space-y-4">
        <ReportButtonGroup
          title="التقارير"
          buttons={mainReportButtons}
          reportType={reportType}
          onSelect={setReportType}
        />
        <div className="border-t border-primary-100/60 pt-4">
          <ReportButtonGroup
            title="تقارير الأداء"
            buttons={performanceReportButtons}
            reportType={reportType}
            onSelect={setReportType}
          />
        </div>
        <div className="border-t border-primary-100/60 pt-4">
          <ReportButtonGroup
            title="نسبة الإلغاءات"
            buttons={cancellationsReportButtons}
            reportType={reportType}
            onSelect={setReportType}
          />
        </div>
      </div>

      {(reportType === 'agents' || reportType === 'group_leaders' || reportType === 'supervisors' || reportType === 'supervisory_performance') && (
        <ActivityTargetsPanel targets={activityTargets} onSaved={setActivityTargets} />
      )}

      {reportType === 'cancellations' ? (
        <p className="text-sm text-secondary-500 print:hidden">
          فترة الحساب ثابتة دائماً: من أول يناير حتى نهاية الشهر الحالي من سنة {new Date().getFullYear()}
        </p>
      ) : (
        <div className="card print:hidden border-secondary-100 bg-secondary-50/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm text-secondary-600 border border-secondary-100"><Layers className="h-3.5 w-3.5" /></span>
            <label className="text-sm font-bold text-secondary-900">نطاق التقرير والفترة</label>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="input-field w-auto"
            >
              <option value="month">شهر محدد</option>
              <option value="quarter">ربع سنوي محدد</option>
              <option value="year">سنة محددة</option>
            </select>

            {dateRange === 'month' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input-field w-auto"
              />
            )}

            {dateRange === 'quarter' && (
              <>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                  className="input-field w-auto"
                >
                  <option value={1}>الربع الأول (يناير - مارس)</option>
                  <option value={2}>الربع الثاني (أبريل - يونيو)</option>
                  <option value={3}>الربع الثالث (يوليو - سبتمبر)</option>
                  <option value={4}>الربع الرابع (أكتوبر - ديسمبر)</option>
                </select>
                <select
                  value={quarterYear}
                  onChange={(e) => setQuarterYear(Number(e.target.value))}
                  className="input-field w-auto"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </>
            )}

            {dateRange === 'year' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="input-field w-auto"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {reportType === 'customers' && (
        <div className="card print:hidden border-primary-100 bg-gradient-to-br from-white to-primary-50/40 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-secondary-900">حالة طلبات التأمين</p>
              <p className="text-xs text-secondary-500 mt-1">اختر الطلبات التي تريد مراجعتها في التقرير والجدول أدناه</p>
            </div>
            <span className="badge badge-primary">{data?.total ?? 0} نتيجة</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              { value: 'all' as const, label: 'كل الطلبات', icon: Layers },
              { value: 'issuance' as const, label: 'طلبات في الإصدار', icon: RefreshCw },
              { value: 'with_policy' as const, label: 'لها وثائق', icon: FileText },
            ]).map(({ value, label, icon: Icon }) => {
              const isActive = customerRequestFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCustomerRequestFilter(value)}
                  className={`min-h-12 rounded-xl border px-3 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                    isActive
                      ? 'bg-primary-600 text-white border-primary-600 shadow-primary-glow-inset'
                      : 'bg-white text-secondary-700 border-secondary-200 hover:border-primary-300 hover:bg-primary-50/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(reportType === 'collection' || reportType === 'production_collection') && (
        <div className="card print:hidden">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="input-label">الحالة قبل الطباعة</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'unpaid')}
                className="input-field w-auto mt-1"
              >
                <option value="all">الكل (مسدد وغير مسدد)</option>
                <option value="paid">مسدد فقط</option>
                <option value="unpaid">غير مسدد فقط</option>
              </select>
            </div>
            <div>
              <label className="input-label">مستخدم معين</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="input-field w-auto mt-1"
              >
                <option value="">الكل (نطاقي الكامل)</option>
                {selectableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {isInitialLoading ? (
        <div className="flex items-center justify-center h-48 print:hidden">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {reportType === 'customers' && data && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
              {[
                { label: 'إجمالي الطلبات', value: data.total, accentClass: 'bg-primary-50 text-primary-700', icon: Users },
                { label: 'طلبات في الإصدار', value: data.issuanceCount, accentClass: 'bg-warning-50 text-warning-700', icon: RefreshCw },
                { label: 'طلبات لها وثائق', value: data.withPolicyCount, accentClass: 'bg-success-50 text-success-700', icon: FileText },
                { label: 'إجمالي مبالغ التأمين', value: formatCurrency(data.totalInsuranceAmount || 0), accentClass: 'bg-info-50 text-info-700', icon: Wallet },
              ].map(({ label, value, accentClass, icon: Icon }) => (
                <div key={label} className="relative overflow-hidden rounded-2xl border border-secondary-100 bg-white p-4 shadow-soft transition-transform duration-200 hover:-translate-y-0.5">
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${accentClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-medium text-secondary-500 leading-5">{label}</p>
                  <p className="text-figure mt-1 text-xl font-extrabold text-secondary-900">{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-1">
            <div className="lg:col-span-2 card print:shadow-none print:border print:break-inside-avoid">
              <h3 className="type-h3 mb-4 print:hidden">
                {reportType === 'customers' ? 'الطلبات المسجلة حسب الفترة' : currentReportLabel}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip
                      formatter={(value: any) =>
                        (reportType === 'agents' || reportType === 'group_leaders' || reportType === 'supervisors')
                          ? `${value}%`
                          : formatCurrency(value)
                      }
                      contentStyle={{
                        direction: 'rtl',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}
                    />
                    {reportType === 'collection' || reportType === 'production_collection' ? (
                      <>
                        <Legend />
                        <Bar dataKey="المستحق" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="المسدد" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </>
                    ) : (
                      <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card print:shadow-none print:border print:break-inside-avoid">
              <h3 className="type-h3 mb-4">ملخص التقرير</h3>
              {data && (
                <div className="space-y-4">
                  {data.supervisoryPerformance && (
                    <div className="space-y-2">
                      <div className="rounded-xl bg-primary-50 p-3">
                        <p className="text-xs font-semibold text-secondary-600">متوسط التقييم النهائي</p>
                        <p className="mt-1 text-2xl font-black text-primary-700">
                          {data.supervisoryPerformance.roots.length > 0
                            ? `${Math.round(data.supervisoryPerformance.roots.reduce((sum: number, root: any) => sum + root.finalScore, 0) / data.supervisoryPerformance.roots.length)}%`
                            : '—'}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-success-50 p-2 text-center"><p className="text-[11px] text-secondary-500">مراقب</p><strong className="text-success-700">{data.supervisoryPerformance.totalSupervisors}</strong></div>
                        <div className="rounded-lg bg-primary-50 p-2 text-center"><p className="text-[11px] text-secondary-500">رئيس مجموعة</p><strong className="text-primary-700">{data.supervisoryPerformance.totalGroupLeaders}</strong></div>
                        <div className="rounded-lg bg-info-50 p-2 text-center"><p className="text-[11px] text-secondary-500">وكيل</p><strong className="text-info-700">{data.supervisoryPerformance.totalAgents}</strong></div>
                      </div>
                    </div>
                  )}

                  {data.cancellationRate !== undefined && (
                    <div className="grid grid-cols-1 gap-3 print:grid-cols-1">
                      <button
                        type="button"
                        onClick={() => navigate('/cancellations')}
                        className="text-right p-4 bg-error-50 rounded-lg hover:bg-error-100 transition-colors print:bg-white print:border print:p-2"
                      >
                        <p className="text-sm text-secondary-600">نسبة الإلغاءات</p>
                        <p className="text-2xl font-bold text-error-700 mt-1">{data.cancellationRate}%</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/cancellations')}
                        className="text-right p-4 bg-error-50 rounded-lg hover:bg-error-100 transition-colors print:bg-white print:border print:p-2"
                      >
                        <p className="text-sm text-secondary-600">قيمة الإلغاءات</p>
                        <p className="text-2xl font-bold text-error-700 mt-1">{formatCurrency(data.cancelledValue)}</p>
                      </button>
                      <div className="p-4 bg-secondary-50 rounded-lg print:bg-white print:border print:p-2">
                        <p className="text-sm text-secondary-600">إجمالي الأقساط المسددة هذا العام</p>
                        <p className="text-lg font-semibold text-secondary-800 mt-1">{formatCurrency(data.totalCollected)}</p>
                        <p className="text-sm text-secondary-500 mt-1">{data.count} وثيقة داخلة في الحساب</p>
                      </div>
                    </div>
                  )}

                  {data.dueTotal !== undefined && (
                    <div className="grid grid-cols-1 gap-3 print:grid-cols-1">
                      <div className="p-4 bg-amber-50 rounded-lg print:bg-white print:border print:p-2">
                        <p className="text-sm text-secondary-600">المستحق خلال الفترة</p>
                        <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(data.dueTotal)}</p>
                      </div>
                      <div className="p-4 bg-success-50 rounded-lg print:bg-white print:border print:p-2">
                        <p className="text-sm text-secondary-600">المسدد فعلياً خلال الفترة</p>
                        <p className="text-2xl font-bold text-success-700 mt-1">{formatCurrency(data.paidTotal)}</p>
                        {data.count !== undefined && (
                          <p className="text-sm text-secondary-500 mt-1">{data.count} دفعة مسجّلة</p>
                        )}
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg print:bg-white print:border print:p-2">
                        <p className="text-sm text-secondary-600">نسبة التحصيل</p>
                        <p className="text-2xl font-bold text-primary-700 mt-1">
                          {data.collectionRatePeriod !== null ? `${data.collectionRatePeriod}%` : '—'}
                        </p>
                      </div>
                    </div>
                  )}

                  {data.total !== undefined && (
                    <div className="p-4 bg-primary-50 rounded-lg print:bg-white print:border print:p-2">
                      <p className="text-sm text-secondary-600">الإجمالي</p>
                      <p className="text-2xl font-bold text-primary-700 mt-1">
                        {(typeof data.total === 'number' && reportType.includes('production')) ||
                        reportType.includes('collection') ||
                        reportType === 'overdue'
                          ? formatCurrency(data.total)
                          : data.total}
                      </p>
                      {data.count !== undefined && (
                        <p className="text-sm text-secondary-500 mt-1">
                          {data.count} سجل
                        </p>
                      )}
                    </div>
                  )}

                  {data.byStatus && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-600">نشط</span>
                        <span className="font-semibold text-success-700">{data.byStatus.active}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-600">ملغى</span>
                        <span className="font-semibold text-error-700">{data.byStatus.cancelled}</span>
                      </div>
                    </div>
                  )}

                  {data.agents && (
                    <div className="space-y-2 max-h-64 overflow-y-auto print:max-h-none print:overflow-visible">
                      {data.agents.map((agent: any, idx: number) => (
                        <PerformanceScoreRow key={agent.id || idx} name={agent.name} entry={agent} />
                      ))}
                    </div>
                  )}

                  {data.leaders && (
                    <div className="space-y-2 max-h-64 overflow-y-auto print:max-h-none print:overflow-visible">
                      {data.leaders.map((leader: any, idx: number) => (
                        <PerformanceScoreRow
                          key={leader.id || idx}
                          name={leader.name}
                          subLabel={`${leader.count} عضو`}
                          entry={leader}
                        />
                      ))}
                    </div>
                  )}

                  {data.supervisors && (
                    <div className="space-y-2 max-h-64 overflow-y-auto print:max-h-none print:overflow-visible">
                      {data.supervisors.map((supervisor: any, idx: number) => (
                        <PerformanceScoreRow
                          key={supervisor.id || idx}
                          name={supervisor.name}
                          subLabel={`${supervisor.count} عضو`}
                          entry={supervisor}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {reportType === 'supervisory_performance' && data?.supervisoryPerformance && (
            <SupervisoryPerformancePanel report={data.supervisoryPerformance} />
          )}

          {(reportType === 'collection' || reportType === 'production_collection') ? (
            <CollectionDetailsByAgent
              installments={data?.installmentsRaw || []}
              statusFilter={statusFilter}
            />
          ) : reportType === 'customers' ? (
            <div className="card print:shadow-none print:border print:break-inside-avoid space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="type-h3">سجل طلبات التأمين</h3>
                  <p className="text-xs text-secondary-500 mt-1">الاسم، تاريخ التسجيل، مبلغ التأمين، والوكيل المسؤول</p>
                </div>
                <span className="badge badge-secondary">{data?.total ?? 0} طلب</span>
              </div>
              {data?.details?.length > 0 ? (
                <div className="table-container table-zebra print:hover:bg-transparent">
                  <table className="min-w-[760px]">
                    <thead>
                      <tr>
                        <th scope="col">اسم العميل</th>
                        <th scope="col">تاريخ التسجيل</th>
                        <th scope="col">مبلغ التأمين</th>
                        <th scope="col">اسم الوكيل</th>
                        <th scope="col">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.details.map((row: Record<string, any>, idx: number) => (
                        <tr key={`${row['اسم العميل']}-${idx}`}>
                          <td className="font-semibold text-secondary-900">{row['اسم العميل']}</td>
                          <td className="text-secondary-600">{row['تاريخ التسجيل']}</td>
                          <td className="font-bold text-primary-700">{row['مبلغ التأمين']}</td>
                          <td className="text-secondary-700">{row['اسم الوكيل']}</td>
                          <td>
                            <span className={row['الحالة'] === 'في الإصدار' ? 'badge badge-warning' : 'badge badge-success'}>
                              {row['الحالة']}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state py-8">
                  <div className="empty-state-icon"><FileText className="w-5 h-5" /></div>
                  <p className="empty-state-title">لا توجد طلبات مطابقة</p>
                  <p className="empty-state-desc">جرّب تغيير حالة الطلب أو الفترة المحددة</p>
                </div>
              )}
            </div>
          ) : (
            <div className="card print:shadow-none print:border print:break-inside-avoid">
              <h3 className="type-h3 mb-4">تفاصيل السجلات</h3>
              {detailsColumns.length > 0 ? (
                <div className="table-container print:hover:bg-transparent">
                  <table>
                    <thead>
                      <tr>
                        {detailsColumns.map((col) => (
                          <th scope="col" key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.details.map((row: Record<string, any>, idx: number) => (
                        <tr key={idx}>
                          {detailsColumns.map((col) => (
                            <td key={col}>{row[col]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-secondary-400 text-center py-6">لا توجد سجلات في هذه الفترة</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

