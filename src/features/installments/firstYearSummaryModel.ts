import type { Installment } from '../../lib/supabase';
import { computeInstallmentStats } from './installmentHelpers';
/** Display-only totals from the full loaded first-year schedule, never premium × 12. */
export function firstYearScheduleSummary(rows: Pick<Installment, 'status' | 'amount'>[]) {
  const stats = computeInstallmentStats(rows);
  const sum = (status?: string) => rows.reduce((total, row) => total + (!status || row.status === status ? Number(row.amount) : 0), 0);
  return { ...stats, amount: sum(), paidAmount: sum('paid'), pendingAmount: sum('pending'), overdueAmount: sum('overdue') };
}
