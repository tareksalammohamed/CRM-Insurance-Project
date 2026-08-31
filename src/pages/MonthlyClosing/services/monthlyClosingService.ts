import { supabase } from '../../../lib/supabase';
import type { BasicUser, PaymentRow } from '../types';
import { dalRead } from '../../../lib/dataAccessLayer';
import { fetchUserSubtreeIdsBranchAware, fetchBranchRoleMap } from '../../../lib/branchHierarchy';
import type { Branch } from '../../../features/branches/types';

// ─── data access layer: كل استعلامات Supabase الخاصة بصفحة تقفيل الشهر ───
// دوال القراءة بقت تمر من dalRead (طبقة الوصول الموحدة للبيانات) — راجع
// lib/dataAccessLayer.ts لمعرفة سلوك الأونلاين/الأوفلاين/الخطأ.

export async function fetchClosingRecord(monthStr: string) {
  const result = await dalRead(
    `monthlyClosing:record:${monthStr}`,
    async () => {
      const { data, error } = await supabase
        .from('monthly_closings')
        .select('*, closed_by:closed_by_user_id(name), opened_by:opened_by_user_id(name)')
        .eq('month', monthStr)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    { emptyValue: null as any },
  );
  return result.data;
}

// نطاق "الفرع" (المرحلة 3): لو branchId اتمرر، الشجرة بتتبنى من
// user_branch_roles الخاصة بيه بس (عبر get_user_subtree_branch_aware)؛
// من غيره بترجع لنفس سلوك get_user_subtree الأصلي العابر للفروع.
export async function fetchUserSubtreeIds(userId: string, branchId?: string | null): Promise<string[]> {
  return fetchUserSubtreeIdsBranchAware('monthlyClosing', userId, branchId);
}

// خريطة role/manager_id الخاصة بنفس الفرع لكل مستخدم فى النطاق — تُستخدم
// فى بناء الهرم داخل monthlyClosingCalculator بدل users.manager_id العام.
export { fetchBranchRoleMap };

// فروع نطاق الطباعة: بدل عرض كل فروع التطبيق (fetchBranches الخاصة بشاشة
// إدارة الفروع)، بترجع بس الفروع الفعلية اللي أعضاء النطاق الحالي (ids —
// نفس المستخدمين اللي التقرير مبني عليهم) موجودين فيها، عشان قائمة
// "اسم الفرع" فى مودال الطباعة تفضل مقصورة على الفروع التابعة للمستخدم.
export async function fetchBranchesForUserIds(ids: string[]): Promise<Branch[]> {
  if (ids.length === 0) return [];
  const result = await dalRead(
    `monthlyClosing:printBranches:${ids.slice().sort().join(',')}`,
    async () => {
      const { data, error } = await supabase
        .from('user_branch_roles')
        .select('branch:branch_id(id, name, is_active, created_at, is_headquarters)')
        .in('user_id', ids);
      if (error) throw error;
      const rows = (data || []) as unknown as { branch: Branch | null }[];
      const map = new Map<string, Branch>();
      rows.forEach((r) => {
        if (r.branch && r.branch.is_active !== false) map.set(r.branch.id, r.branch);
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    },
    { emptyValue: [] as Branch[] },
  );
  return result.data;
}

export async function fetchUsersByIds(ids: string[]): Promise<BasicUser[]> {
  const result = await dalRead(
    `monthlyClosing:usersByIds:${ids.slice().sort().join(',')}`,
    async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, manager_id, target, is_active, deleted_at, created_at')
        .in('id', ids);
      if (error) throw error;
      return (data || []) as BasicUser[];
    },
    { emptyValue: [] as BasicUser[] },
  );
  return result.data;
}

export async function fetchMonthPayments(monthStr: string): Promise<any[]> {
  const result = await dalRead(
    `monthlyClosing:monthPayments:${monthStr}`,
    async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id, amount, paid_at,
          installment:installment_id (
            installment_number, is_first,
            policy:policy_id (
              policy_number, owner_id,
              customer:customer_id ( name )
            )
          )
        `)
        .eq('payment_month', monthStr)
        .eq('is_cancelled', false);
      if (error) throw error;
      return data || [];
    },
    { emptyValue: [] as any[] },
  );
  return result.data;
}

export function filterPaymentsByOwnerIds(paymentsRaw: any[], ids: string[]): PaymentRow[] {
  return paymentsRaw.filter((p: any) => ids.includes(p.installment?.policy?.owner_id)) as PaymentRow[];
}

/**
 * أول شهر ظهر فيه شغل فعلي للمستخدم (قسط سنة أولى أو تحصيل تجديد)،
 * مع استبعاد المدفوعات الملغاة. نستخدمه لتحديد المستخدم الذي بدأ شغله
 * لأول مرة في شهر التقفيل حتى لو أُنشئ حسابه قبل ذلك.
 */
export async function fetchFirstWorkMonthByOwnerIds(ownerIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (ownerIds.length === 0) return result;

  const dataResult = await dalRead(
    `monthlyClosing:firstWorkMonth:${ownerIds.slice().sort().join(',')}`,
    async () => {
      const [year1Res, renewalRes] = await Promise.all([
        supabase
          .from('payments')
          .select('payment_month, installment:installment_id(policy:policy_id(owner_id))')
          .eq('is_cancelled', false),
        supabase
          .from('year2_payments')
          .select('payment_month, policy:policy_id(owner_id)')
          .eq('is_cancelled', false),
      ]);
      if (year1Res.error) throw year1Res.error;
      if (renewalRes.error) throw renewalRes.error;
      return { year1: year1Res.data || [], renewal: renewalRes.data || [] };
    },
    { emptyValue: { year1: [] as any[], renewal: [] as any[] } },
  );

  const consider = (ownerId: unknown, month: unknown) => {
    if (typeof ownerId !== 'string' || !ownerIds.includes(ownerId) || typeof month !== 'string') return;
    const previous = result.get(ownerId);
    if (!previous || month < previous) result.set(ownerId, month);
  };
  dataResult.data.year1.forEach((row: any) => consider(row.installment?.policy?.owner_id, row.payment_month));
  dataResult.data.renewal.forEach((row: any) => consider(row.policy?.owner_id, row.payment_month));
  return result;
}

export async function closeMonth(monthStr: string, userId: string) {
  const { error } = await supabase.from('monthly_closings').insert({
    month: monthStr, closed_by_user_id: userId, is_open: false,
  });
  if (error?.code === '23505') {
    await supabase.from('monthly_closings')
      .update({ is_open: false, opened_at: null, opened_by_user_id: null })
      .eq('month', monthStr);
  } else if (error) {
    throw error;
  }
  await supabase.rpc('log_activity', { p_action: 'month_close', p_entity_type: 'monthly_closing' });
}

export async function openMonth(monthStr: string, userId: string) {
  const { error } = await supabase.from('monthly_closings')
    .update({ is_open: true, opened_at: new Date().toISOString(), opened_by_user_id: userId })
    .eq('month', monthStr);
  if (error) throw error;
  await supabase.rpc('log_activity', { p_action: 'month_open', p_entity_type: 'monthly_closing' });
}
