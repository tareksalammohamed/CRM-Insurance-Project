import { supabase } from '../../../lib/supabase';
import { format, startOfMonth, subMonths } from 'date-fns';
import { dalRead, readStatusMessage } from '../../../lib/dataAccessLayer';

export interface RawYear1Payment {
  id: string;
  amount: number;
  paid_at: string;
  installment: {
    policy: {
      id: string;
      policy_number: string;
      payment_method: string;
      sum_assured: number | null;
      owner_id: string;
      branch_id: string;
      customer: { name: string } | null;
    } | null;
  } | null;
}

export interface RawYear2Payment {
  id: string;
  amount: number;
  payment_date: string;
  policy: {
    id: string;
    policy_number: string;
    payment_method: string;
    sum_assured: number | null;
    owner_id: string;
    branch_id: string;
    customer: { name: string } | null;
  } | null;
}

// جلب بيانات السداد الخام (سنة أولى + تجديد) الخاصة بمستخدم معين فقط
// (الوثائق التي هو مالكها/أصدرها owner_id)، ضمن نطاق يغطي الشهر المختار
// والشهر السابق له مباشرة — لأن استحقاق العمولة قد يقع في الشهر التالي
// لشهر السداد الفعلي (قاعدة الصرف يوم 12 / يوم 27).
// هذه القراءة فقط ولا تُعدّل أي جدول، ولا تؤثر على أي منطق آخر بالنظام.
const EMPTY_COMMISSION_SOURCE: { year1Payments: RawYear1Payment[]; year2Payments: RawYear2Payment[] } = {
  year1Payments: [],
  year2Payments: [],
};

export async function fetchCommissionSourceData(
  ownerId: string,
  selectedMonthDate: Date,
  branchId: string | null = null,
): Promise<{ year1Payments: RawYear1Payment[]; year2Payments: RawYear2Payment[]; loadMessage?: string | null }> {
  const rangeStartMonth = format(startOfMonth(subMonths(selectedMonthDate, 1)), 'yyyy-MM-dd');
  const rangeEndMonth = format(startOfMonth(selectedMonthDate), 'yyyy-MM-dd');

  const result = await dalRead(
    `commissions:source:${ownerId}:${rangeStartMonth}:${rangeEndMonth}:${branchId ?? 'none'}`,
    async () => {
      // Filter ownership on the server and page through all matched payments.
      // This avoids downloading the whole branch and silently hitting the API row cap.
      const readYear1 = async () => {
        const rows: RawYear1Payment[] = [];
        for (let offset = 0; ; offset += 500) {
          let query = supabase.from('payments').select(`id, amount, paid_at,
            installment:installment_id!inner(policy:policy_id!inner(
              id, policy_number, payment_method, sum_assured, owner_id, branch_id,
              customer:customer_id(name)))`)
            .eq('is_cancelled', false).eq('installment.policy.owner_id', ownerId)
            .gte('payment_month', rangeStartMonth).lte('payment_month', rangeEndMonth)
            .order('id').range(offset, offset + 499);
          if (branchId) query = query.eq('installment.policy.branch_id', branchId);
          const { data, error } = await query;
          if (error) throw error;
          rows.push(...((data || []) as unknown as RawYear1Payment[]));
          if (!data || data.length < 500) return rows;
        }
      };
      const readYear2 = async () => {
        const rows: RawYear2Payment[] = [];
        for (let offset = 0; ; offset += 500) {
          let query = supabase.from('year2_payments').select(`id, amount, payment_date,
            policy:policy_id!inner(id, policy_number, payment_method, sum_assured, owner_id, branch_id,
              customer:customer_id(name))`)
            .eq('is_cancelled', false).eq('policy.owner_id', ownerId)
            .gte('payment_month', rangeStartMonth).lte('payment_month', rangeEndMonth)
            .order('id').range(offset, offset + 499);
          if (branchId) query = query.eq('policy.branch_id', branchId);
          const { data, error } = await query;
          if (error) throw error;
          rows.push(...((data || []) as unknown as RawYear2Payment[]));
          if (!data || data.length < 500) return rows;
        }
      };
      const [year1Payments, year2Payments] = await Promise.all([readYear1(), readYear2()]);

      return { year1Payments, year2Payments };
    },
    { emptyValue: EMPTY_COMMISSION_SOURCE },
  );
  return { ...result.data, loadMessage: readStatusMessage(result) };
}
