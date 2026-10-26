import { fetchAllRows } from '../../../lib/fetchAllRows';
import { supabase } from '../../../lib/supabase';
import { format } from 'date-fns';
import type { RawCancelledPolicy, BasicHierarchyUser } from '../types';
import { buildCancellationSummary } from '../business/cancellationCalculator';
import { freshDalRead as dalRead } from '../../../lib/dataAccessLayer';
import { fetchUserSubtreeIdsBranchAware, fetchBranchRoleMap } from '../../../lib/branchHierarchy';

// Verified, complete reads: a failed source must not become a partial financial summary.

// نطاق المستخدم (نفسه + كل من تحته)، فى سياق فرع معيّن (المرحلة 3) لو
// اتمرر branchId، وإلا نفس السلوك القديم العابر للفروع بالظبط.
export async function fetchUserSubtreeIds(userId: string, branchId?: string | null): Promise<string[]> {
  return fetchUserSubtreeIdsBranchAware('cancellations', userId, branchId, true);
}

export async function fetchSubtreeUsers(userIds: string[]): Promise<BasicHierarchyUser[]> {
  const result = await dalRead(
    `cancellations:subtreeUsers:${userIds.slice().sort().join(',')}`,
    async () => {
      const data = await fetchAllRows((from, to) => supabase
        .from('users')
        .select('id, name, role, manager_id', { count: 'exact' })
        .in('id', userIds).order('id').range(from, to));
      return data || [];
    },
    { emptyValue: [] as BasicHierarchyUser[] },
  );
  return result.data;
}

// الوثائق الملغاة خلال الفترة (من أول يناير حتى نهاية الشهر الحالي)، ضمن
// نطاق المستخدم فقط. RLS على جدول policies يقيّد النتائج تلقائياً بنفس
// النطاق أيضاً، فالفلترة بـ owner_id هنا مجرد اتساق مع باقي الصفحات.
export async function fetchCancelledPoliciesInYear(
  userIds: string[],
  yearStart: Date,
  periodEnd: Date,
): Promise<RawCancelledPolicy[]> {
  const result = await dalRead(
    `cancellations:cancelledInYear:${userIds.slice().sort().join(',')}:${yearStart.toISOString()}:${periodEnd.toISOString()}`,
    async () => {
      const data = await fetchAllRows((from, to) => supabase
        .from('policies')
        .select('id, policy_number, customer_id, owner_id, policy_type, start_date, premium_amount, cancelled_at, customer:customer_id(name)', { count: 'exact' })
        .in('owner_id', userIds)
        .eq('status', 'cancelled')
        .not('cancelled_at', 'is', null)
        .gte('cancelled_at', yearStart.toISOString())
        .lte('cancelled_at', periodEnd.toISOString()).order('id').range(from, to));
      return (data as unknown as RawCancelledPolicy[]) || [];
    },
    { emptyValue: [] as RawCancelledPolicy[] },
  );
  return result.data;
}

// إجمالي الأقساط المسددة لكل الوثائق (المقام) — نفس نمط باقي التقارير:
// نجيب الدفعات مع بيانات المالك المضمّنة (embed) ثم نفلتر بالـ owner_id
// على مستوى العميل لأن payments/year2_payments لا تحتوي owner_id مباشرة.
const EMPTY_COLLECTED_IN_PERIOD = { year1Payments: [] as any[], year2Payments: [] as any[] };

export async function fetchAllCollectedInPeriod(yearStartStr: string, periodEndStr: string) {
  const result = await dalRead(
    `cancellations:allCollected:${yearStartStr}:${periodEndStr}`,
    async () => {
      const [year1Res, year2Res] = await Promise.all([
        fetchAllRows((from, to) => supabase
          .from('payments')
          .select('amount, installment:installment_id(policy:policy_id(owner_id))', { count: 'exact' })
          .eq('is_cancelled', false)
          .gte('payment_month', yearStartStr)
          .lte('payment_month', periodEndStr).order('id').range(from, to)),
        fetchAllRows((from, to) => supabase
          .from('year2_payments')
          .select('amount, policy:policy_id(owner_id)', { count: 'exact' })
          .eq('is_cancelled', false)
          .gte('payment_month', yearStartStr)
          .lte('payment_month', periodEndStr).order('id').range(from, to)),
      ]);

      return {
        year1Payments: year1Res || [],
        year2Payments: year2Res || [],
      };
    },
    { emptyValue: EMPTY_COLLECTED_IN_PERIOD },
  );
  return result.data;
}

// إجمالي الأقساط المسددة قبل الإلغاء لكل وثيقة من الوثائق المؤهلة (البسط) —
// نستخدم فلترة مباشرة بالـ policy_id (بدون تجميع/تخزين، مجرد جلب حي من القاعدة)
const EMPTY_PAID_AMOUNTS = {
  year1Payments: [] as { amount: number; policy_id: string }[],
  year2Payments: [] as { amount: number; policy_id: string }[],
};

export async function fetchPaidAmountsForPolicies(policyIds: string[]) {
  if (policyIds.length === 0) {
    return { year1Payments: [] as { amount: number; policy_id: string }[], year2Payments: [] as { amount: number; policy_id: string }[] };
  }

  const result = await dalRead(
    `cancellations:paidAmounts:${policyIds.slice().sort().join(',')}`,
    async () => {
      const [installmentsRes, year2Res] = await Promise.all([
        fetchAllRows((from, to) => supabase
          .from('installments')
          .select('id, policy_id', { count: 'exact' })
          .in('policy_id', policyIds).order('id').range(from, to)),
        fetchAllRows((from, to) => supabase
          .from('year2_payments')
          .select('amount, policy_id', { count: 'exact' })
          .eq('is_cancelled', false)
          .in('policy_id', policyIds).order('id').range(from, to)),
      ]);

      const installments = installmentsRes || [];
      const installmentIds = installments.map((i) => i.id);

      let year1Payments: { amount: number; installment_id: string }[] = [];
      if (installmentIds.length > 0) {
        const data = await fetchAllRows((from, to) => supabase
          .from('payments')
          .select('amount, installment_id', { count: 'exact' })
          .eq('is_cancelled', false)
          .in('installment_id', installmentIds).order('id').range(from, to));
        year1Payments = data || [];
      }

      // نحوّل year1Payments (المرتبطة بـ installment_id) لتصبح مرتبطة بـ policy_id مباشرة
      const instToPolicy = new Map(installments.map((i) => [i.id, i.policy_id]));
      const year1WithPolicy = year1Payments
        .map((p) => ({ amount: Number(p.amount), policy_id: instToPolicy.get(p.installment_id) || '' }))
        .filter((p) => p.policy_id);

      const year2WithPolicy = (year2Res || []).map((p) => ({ amount: Number(p.amount), policy_id: p.policy_id }));

      return { year1Payments: year1WithPolicy, year2Payments: year2WithPolicy };
    },
    { emptyValue: EMPTY_PAID_AMOUNTS },
  );
  return result.data;
}

export const getYearStart = () => new Date(new Date().getFullYear(), 0, 1);
export const getPeriodEndStr = (periodEnd: Date) => format(periodEnd, 'yyyy-MM-dd');
export const getYearStartStr = (yearStart: Date) => format(yearStart, 'yyyy-MM-dd');

// دالة تجميعية واحدة (جلب + حساب) تُستخدم من Dashboard وReports وصفحة تفاصيل
// الإلغاءات، حتى لا يتكرر نفس التسلسل في أكثر من مكان. branchId اختياري
// (المرحلة 3): من غيره السلوك يرجع بالظبط لسلوك ما قبل دعم تعدد الفروع.
export async function loadCancellationSummary(
  viewer: { id: string; name: string; role: string },
  branchId?: string | null,
) {
  const now = new Date();
  const yearStart = getYearStart();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const yearStartStr = getYearStartStr(yearStart);
  const periodEndStr = getPeriodEndStr(periodEnd);

  const userIds = await fetchUserSubtreeIds(viewer.id, branchId);

  const [cancelledPolicies, users, { year1Payments: allYear1Payments, year2Payments: allYear2Payments }, branchRoles] =
    await Promise.all([
      fetchCancelledPoliciesInYear(userIds, yearStart, periodEnd),
      fetchSubtreeUsers(userIds),
      fetchAllCollectedInPeriod(yearStartStr, periodEndStr),
      fetchBranchRoleMap(branchId, userIds, true),
    ]);

  const eligiblePolicyIds = cancelledPolicies
    .filter((p) => p.cancelled_at)
    .map((p) => p.id);

  const paidForEligiblePolicies = await fetchPaidAmountsForPolicies(eligiblePolicyIds);

  return buildCancellationSummary({
    year: now.getFullYear(),
    cancelledPolicies,
    users,
    viewer,
    paidForEligiblePolicies,
    allYear1Payments,
    allYear2Payments,
    userIds,
    branchRoles,
  });
}
