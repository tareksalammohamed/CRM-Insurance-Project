import { format, startOfMonth, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
export interface TrendPayment {
  amount: number | string;
  payment_month: string;
  installment: { is_first: boolean; policy: { owner_id: string } | null } | null;
}
export function trendMonths(now = new Date()) {
  return Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(startOfMonth(now), 5 - i);
    return { month: format(date, 'yyyy-MM'), label: format(date, 'MMM yyyy', { locale: ar }), production: 0, collection: 0 };
  });
}
export function computePerformanceTrend(payments: TrendPayment[], userIds: string[], now = new Date()) {
  const months = trendMonths(now);
  const scope = new Set(userIds);
  const buckets = new Map(months.map(month => [month.month, month]));
  for (const payment of payments) {
    if (!payment.installment?.policy || !scope.has(payment.installment.policy.owner_id)) continue;
    const bucket = buckets.get(payment.payment_month.slice(0, 7));
    if (bucket) bucket[payment.installment.is_first ? 'production' : 'collection'] += Number(payment.amount);
  }
  return months;
}
