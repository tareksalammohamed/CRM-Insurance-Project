import { isAbortedRead } from '../../../lib/adaptiveReads';
import { useRequestGuard } from '../../../hooks/useRequestGuard';
import { useAdaptiveReads } from '../../../hooks/useAdaptiveReads';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useBranchContext } from '../../../lib/branchContext';
import { type UserRole } from '../../../lib/supabase';
import type { BranchRoleInfo } from '../../../lib/branchHierarchy';
import { format, startOfMonth, endOfMonth, addMonths, isWithinInterval, isSameMonth } from 'date-fns';

import type { DashboardStats, TeamPerformance, TeamMemberDetail } from '../types';
import {
  fetchDashboardScope, fetchDashboardRawData, fetchTeamUsers, fetchDashboardBranchRoles,
} from '../services/dashboardService';
import { computeDashboardStats, computeTeamPerformance, computeChartData, computeTeamAchievementDetails, buildBranchAwareChildrenMap } from '../business/dashboardCalculator';
import type { CancellationSummary } from '../../Cancellations/types';
import { loadCancellationSummary } from '../../Cancellations/services/cancellationService';
import { TEAM_PERFORMANCE_SECTIONS } from '../constants';
import { useReconnectRefetch } from '../../../hooks/useReconnectRefetch';

export function useDashboard() {
  const { user } = useAuth();
  const { currentBranchId } = useBranchContext();
  const read = useAdaptiveReads(`${user?.id}:${currentBranchId}`);
  const cancellationGuard = useRequestGuard();
  const [cancellationLoading, setCancellationLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  // وقت آخر تحديث ناجح للبيانات + حالة "جاري التحديث" منفصلة عن loading
  // الأساسية (اللي بتعرض الـ skeleton الكامل أول مرة فقط) — التحديث اليدوي
  // بيستخدم refreshing بس عشان مايمسحش البيانات الظاهرة أثناء إعادة الجلب.
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // الشهر المعروض حاليًا في اللوحة (افتراضيًا الشهر الحالي). تغييره بيعيد
  // تحميل كل بيانات اللوحة لنفس الشهر المُختار بدل الشهر الحقيقي — ملاحظة:
  // "المستحق/المتأخر" بتعكس الحالة الحيّة الآن فى قاعدة البيانات (status)
  // مش لقطة مجمّدة وقت الشهر ده، بعكس "الإنتاج/التحصيل" اللي دايماً دقيقة
  // لأنها مبنية على payment_month الفعلي المسجَّل وقت السداد.
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => new Date());
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());
  const [chartData, setChartData] = useState<{ production: number; collection: number }>({ production: 0, collection: 0 });
  // مؤشر "نسبة الإلغاءات" — يُحمَّل بشكل مستقل تماماً ولا يؤثر على أي حساب آخر في الصفحة
  const [cancellationSummary, setCancellationSummary] = useState<CancellationSummary | null>(null);

  // البيانات الخام المستخدمة أصلاً لحساب "أداء الفريق" (بالأعلى) — يتم
  // الاحتفاظ بها هنا فقط لإعادة استخدامها فى حساب تفاصيل الـ Bottom Sheet
  // التفاعلي عند الضغط على اسم، بدون أي استعلامات إضافية للشبكة (نفس
  // البيانات المحمَّلة أصلاً مع لوحة التحكم لكل الفريق المرئي للمستخدم).
  const [teamUsersRaw, setTeamUsersRaw] = useState<{ id: string; name: string; role: string; target: number | null; manager_id: string | null; is_active: boolean }[]>([]);
  const [teamPaymentsRaw, setTeamPaymentsRaw] = useState<any[]>([]);
  // أقساط "المستحق هذا الشهر" ولم تُسدد بعد (pending/overdue، ومُفلترة على
  // due_date ضمن الشهر الحالي) — لنفس الفريق المرئي بالأعلى، تُستخدم فقط فى
  // حساب remainingNewProduction/remainingCollection داخل الـ Bottom Sheet.
  const [teamDueInstallmentsRaw, setTeamDueInstallmentsRaw] = useState<any[]>([]);
  // خريطة role/manager_id الخاصة بالفرع الحالي — نفس البيانات المستخدمة فى
  // بناء "أداء الفريق"، محفوظة هنا فقط عشان childrenByManager (تنقّل الـ
  // Bottom Sheet) يستخدم نفس منطق الفرع بدل الرجوع لـ manager_id العام.
  const [teamBranchRoles, setTeamBranchRoles] = useState<Map<string, BranchRoleInfo>>(new Map());
  // سلسلة التنقل الهرمي داخل الـ Sheet (من الجذر إلى الشخص المعروض حاليًا)؛
  // فارغة = الـ Sheet مغلق
  const [sheetStack, setSheetStack] = useState<TeamMemberDetail[]>([]);
  // رقم متسلسل للطلب الحالي: يمنع استجابة قديمة لحساب/فرع سابق من الكتابة
  // فوق بيانات الحساب الحالي، وهو مهم خصوصًا عند الانتقال بين حساب طارق وسمر.
  const dashboardRequestIdRef = useRef(0);

  // ملحوظة: الـeffects اللي بتستدعي loadDashboardData/loadCancellationStats
  // اتنقلت تحت تعريفهما (بقوا useCallback بنفس الـdeps اللي كانت معلنة يدويًا
  // هنا) — نفس مرات وتوقيت التحميل بالظبط، ونفس الفصل المقصود بين مؤشر
  // الإلغاءات (مش مرتبط بالشهر) وباقي بيانات اللوحة.

  // مؤشر الإلغاءات مش مرتبط بالشهر المختار (بيعرض دايمًا آخر 12 شهر حتى
  // الآن)، فبيتحمّل مرة واحدة بس عند تغيير المستخدم/الفرع، مش عند تغيير
  // selectedMonth، حتى لا نكرر نفس الاستعلام من غير داعي.
  // تحميل مستقل لمؤشر "نسبة الإلغاءات" — منفصل تماماً عن loadDashboardData
  // وعن كل الحسابات الأخرى في الصفحة، فشله لا يؤثر على باقي الإحصائيات
  const loadCancellationStats = useCallback(async () => {
    if (!user) return;
    const request = cancellationGuard.start();
    setCancellationLoading(true);
    try {
      const result = await read(() => loadCancellationSummary({ id: user.id, name: user.name, role: user.role }, currentBranchId), 2, () => cancellationGuard.isCurrent(request));
      if (cancellationGuard.isCurrent(request)) setCancellationSummary(result);
    } catch (error) {
      if (isAbortedRead(error)) return;
      console.error('Error loading cancellation stats:', error);
    } finally { if (cancellationGuard.isCurrent(request)) setCancellationLoading(false); }
  }, [user, currentBranchId, read, cancellationGuard]);

  const loadDashboardData = useCallback(async (silent = false) => {
    const requestId = ++dashboardRequestIdRef.current;
    if (!silent) setLoading(true);
    setTeamLoading(true);
    setTeamError(null);
    let mainLoaded = false;
    try {
      const now = selectedMonth;
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');

      const { userIds, raw, team, scope } = await read(async () => {
        const scope = await fetchDashboardScope(user!.id, currentBranchId);
        if (scope.status === 'error' || scope.status === 'offline-empty') throw new Error('تعذر التحقق من نطاق الفريق');
        const userIds = scope.data;
        if (requestId !== dashboardRequestIdRef.current) throw Object.assign(new Error('قراءة قديمة'), { name: 'AbortError' });
        const team = read(() => Promise.all([
          fetchTeamUsers(userIds), fetchDashboardBranchRoles(currentBranchId, userIds),
        ]), 1, () => requestId === dashboardRequestIdRef.current)
          .then(data => ({ data }), error => ({ error }));
        return { userIds, raw: await fetchDashboardRawData(userIds, monthStartStr), team, scope };
      }, 0, () => requestId === dashboardRequestIdRef.current);
      const { customersRes, policiesRes, installmentsRes, paymentsRes } = raw;

      // لو بدأ طلب أحدث (تغيير حساب/فرع/شهر)، تجاهل نتيجة الطلب القديم
      // بالكامل حتى لا يظهر إجمالي مستخدم آخر في الصفحة الحالية.
      if (requestId !== dashboardRequestIdRef.current) return;

      if (raw.readStatus === 'error' || raw.readStatus === 'offline-empty') throw new Error('ملخص غير متاح');
      const degraded = scope.status !== 'online' || (!!raw.readStatus && raw.readStatus !== 'online');
      setDashboardNotice(degraded ? raw.loadMessage || 'تعذر تحديث نطاق الفريق؛ الأرقام المعروضة مبنية على نطاق محفوظ. أعد المحاولة للتأكد من أحدث البيانات.' : null);
      const policies = policiesRes.data || [];
      const payments = paymentsRes.data || [];
      const installments = installmentsRes.data || [];

      setDashboardError(null);
      setStats(computeDashboardStats({
        customersCount: customersRes.count || 0,
        policies,
        installmentsRaw: installments,
        paymentsRaw: payments,
        userIds,
        monthStart,
        monthEnd,
        target: user?.target || 0,
      }));

      setChartData(computeChartData(payments, userIds));
      const verifiedTimes = [scope.cachedAt, raw.cachedAt].filter((time): time is number => typeof time === 'number');
      setLastUpdated(degraded ? (verifiedTimes.length ? new Date(Math.min(...verifiedTimes)) : null) : new Date());
      mainLoaded = true;
      if (!silent) setLoading(false);
      // The main portfolio is usable while team details continue loading.
      if (degraded) { setTeamError('تعذر تحديث ملخص الفريق؛ أعد تحديث بيانات الرئيسية لعرض أداء الفريق المؤكد.'); return; }
      const teamResult = await team;
      if ('error' in teamResult) throw teamResult.error;
      const [teamUsers, branchRoles] = teamResult.data;
      if (requestId !== dashboardRequestIdRef.current) return;
      setTeamUsersRaw(teamUsers);
      setTeamPaymentsRaw(payments);
      setTeamBranchRoles(branchRoles);
      // نفس منطق "dueInstallments" فى computeDashboardStats: أقساط لم
      // تُسدد بعد ويقع تاريخ استحقاقها ضمن الشهر الحالي.
      setTeamDueInstallmentsRaw(installments.filter((i: any) => {
        const dueDate = new Date(i.due_date);
        return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
      }));
      setTeamPerformance(computeTeamPerformance(teamUsers, payments, user?.role as UserRole | undefined, branchRoles));


    } catch (error) {
      if (isAbortedRead(error)) return;
      console.error('Error loading dashboard:', error);
      if (requestId === dashboardRequestIdRef.current) {
        if (mainLoaded) setTeamError('تعذر تحميل تفاصيل الفريق؛ أعد التحديث للمحاولة مرة أخرى.');
        else setDashboardError('تعذر تحميل ملخص الصفحة الرئيسية؛ أعد المحاولة.');
      }
    } finally {
      if (requestId === dashboardRequestIdRef.current) { if (!silent) setLoading(false); setTeamLoading(false); }
    }
  }, [user, currentBranchId, selectedMonth, read]);

  useEffect(() => {
    if (user) loadDashboardData();
    return () => { dashboardRequestIdRef.current += 1; };
  }, [user, loadDashboardData]);

  // مؤشر الإلغاءات مش مرتبط بالشهر المختار (بيعرض دايمًا آخر 12 شهر حتى
  // الآن)، فبيتحمّل مرة واحدة بس عند تغيير المستخدم/الفرع، مش عند تغيير
  // selectedMonth — وده محفوظ هنا لأن loadCancellationStats مش بتعتمد عليه.
  useEffect(() => {
    setCancellationSummary(null);
    if (user) loadCancellationStats();
    return cancellationGuard.invalidate;
  }, [user, loadCancellationStats, cancellationGuard]);

  const policyStatusData = stats
    ? [
        { name: 'نشط', value: stats.activePolicies, color: '#22c55e' },
        { name: 'ملغى', value: stats.cancelledPolicies, color: '#ef4444' }
      ]
    : [];

  const teamPerformanceSections = TEAM_PERFORMANCE_SECTIONS
    .map((section) => ({
      label: section.label,
      members: teamPerformance.filter((m) => section.roles.includes(m.role)).slice(0, 5),
    }))
    .filter((section) => section.members.length > 0);

  // تفاصيل أداء كل عضو (مقسّمة إنتاج جديد / تحصيل) لكل الفريق المرئي —
  // تُحسب مرة واحدة فقط من نفس البيانات المحمّلة أصلاً بالأعلى (بدون أي
  // استعلام إضافي)، وتُستخدم لتغذية الـ Bottom Sheet التفاعلي عند الضغط على
  // أي اسم، بما فى ذلك التنقل الهرمي بين المستويات داخل نفس الجلسة.
  const achievementDetails = useMemo(
    () => computeTeamAchievementDetails(teamUsersRaw, teamPaymentsRaw, teamDueInstallmentsRaw, teamBranchRoles),
    [teamUsersRaw, teamPaymentsRaw, teamDueInstallmentsRaw, teamBranchRoles]
  );

  const childrenByManager = useMemo(
    () => buildBranchAwareChildrenMap(teamUsersRaw, teamBranchRoles),
    [teamUsersRaw, teamBranchRoles]
  );

  const getChildrenDetails = (personId: string): TeamMemberDetail[] => {
    const childIds = childrenByManager.get(personId) || [];
    return childIds
      .map((id) => achievementDetails.get(id))
      .filter((d): d is TeamMemberDetail => !!d)
      .sort((a, b) => b.achieved - a.achieved);
  };

  const openTeamMemberSheet = (personId: string) => {
    const detail = achievementDetails.get(personId);
    if (detail) setSheetStack([detail]);
  };

  const handleSelectChild = (child: TeamMemberDetail) => {
    setSheetStack((prev) => [...prev, child]);
  };

  const handleSheetBack = () => {
    setSheetStack((prev) => prev.slice(0, -1));
  };

  const handleSheetClose = () => setSheetStack([]);

  // التنقل بين الشهور: للخلف دايمًا متاح، للأمام محدود بحد أقصى الشهر
  // الحالي الحقيقي (مفيش داعي لعرض شهر مستقبلي لسه معندهوش بيانات).
  const goToPreviousMonth = () => setSelectedMonth((prev) => addMonths(prev, -1));
  const goToNextMonth = () => {
    if (isCurrentMonth) return;
    setSelectedMonth((prev) => addMonths(prev, 1));
  };
  const goToCurrentMonth = () => setSelectedMonth(new Date());

  // تحديث يدوي (زرار في الهيدر): بيعيد تحميل نفس بيانات لوحة التحكم لنفس
  // الشهر المُختار حاليًا + مؤشر الإلغاءات، بدون إظهار الـ skeleton الكامل
  // (silent) — بس مؤشر دوران بسيط على الزرار نفسه لحد ما ينتهي.
  const refresh = async () => {
    if (!user || refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([loadDashboardData(true), loadCancellationStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  useReconnectRefetch(
    () => { if (user) loadDashboardData(); },
    () => { if (user) loadCancellationStats(); },
  );

  return {
    user,
    stats,
    loading,
    teamLoading,
    teamError,
    dashboardError,
    dashboardNotice,
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
    cancellationLoading,
    policyStatusData,
    teamPerformanceSections,
    achievementDetails,
    sheetStack,
    getChildrenDetails,
    openTeamMemberSheet,
    handleSelectChild,
    handleSheetBack,
    handleSheetClose,
  };
}
