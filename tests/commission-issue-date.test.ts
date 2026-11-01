import { describe, expect, it } from 'vitest';
import { computeCommissionRows, computeSummary } from '../src/pages/Commissions/business/commissionsCalculator';
import { InvalidPolicyIssueDateError } from '../src/features/commissionSettings/rates';
import type { RawYear1Payment, RawYear2Payment } from '../src/pages/Commissions/services/commissionsService';

const rates = [
  { effective_from: '1900-01-01', year1_percent: 2.2, renewal_percent: 0.05 },
  { effective_from: '2026-11-01', year1_percent: 3, renewal_percent: 0.1 },
  { effective_from: '2027-01-01', year1_percent: 4, renewal_percent: 0.2 },
];
const policy = { id: 'p', start_date: '2026-10-31', payment_method: 'annual', sum_assured: 120000, policy_number: '123456789', owner_id: 'o', branch_id: 'b', customer: { name: 'عميل' } };
const first = (start_date: string, paid_at = '2027-01-01T12:00:00Z', method = 'annual'): RawYear1Payment => ({ id: `${start_date}-${paid_at}`, amount: 1000, paid_at, installment: { policy: { ...policy, start_date, payment_method: method } } });
const renewal = (start_date: string, payment_date = '2027-01-01', method = 'annual'): RawYear2Payment => ({ id: start_date, amount: 1000, payment_date, policy: { ...policy, start_date, payment_method: method } });

it('uses each inclusive policy date boundary, independently of the common payment date', () => {
  const dates = ['2026-10-31', '2026-11-01', '2026-12-31', '2027-01-01'];
  const result = computeCommissionRows(dates.map(date => first(date)), dates.map(date => renewal(date)), '2027-01', rates);
  expect(result.rows.map(row => row.amount)).toEqual([2640, 3600, 3600, 4800, 60, 120, 120, 240]);
});
it('keeps later first-year installments on the original rule through several scheduled changes', () => {
  for (const month of ['2026-11', '2026-12', '2027-01', '2027-02']) {
    expect(computeCommissionRows([first('2026-10-31', `${month}-01T12:00:00Z`, 'monthly')], [], month, rates).rows[0].amount).toBe(220);
  }
});
it('uses original policy dates when historical documents were inserted/imported recently', () => {
  const payment = first('2026-10-31');
  Object.assign(payment.installment!.policy!, { created_at: '2027-01-01T12:00:00Z' });
  expect(computeCommissionRows([payment], [], '2027-01', rates).rows[0].amount).toBe(2640);
});
describe.each([['monthly', 12], ['quarterly', 4], ['semi_annual', 2], ['annual', 1]] as const)('%s preserves divisors and payout dates', (method, count) => {
  it('selects rates by policy date for first-year and renewal receipts', () => {
    const result = computeCommissionRows([
      first('2026-10-31', '2026-12-16T12:00:00Z', method),
      first('2026-11-01', '2027-01-15T12:00:00Z', method),
    ], [renewal('2026-10-31', '2026-12-31', method), renewal('2026-11-01', '2027-01-01', method)], '2027-01', rates);
    expect(result.rows.map(row => row.amount)).toEqual([2640 / count, 3600 / count, 60 / count, 120 / count]);
    expect(result.rows.map(row => row.dueDay)).toEqual([12, 27, 12, 27]);
    expect(computeSummary(result.rows).totalMonth).toBeCloseTo(6420 / count);
  });
});
it.each(['', '2026-02-30', 'not-a-date', '2026-11-01T12:00:00Z'])('does not fall back to receipt dates when the policy date is invalid: %s', date => {
  expect(() => computeCommissionRows([first(date)], [], '2027-01', rates)).toThrow(InvalidPolicyIssueDateError);
  expect(() => computeCommissionRows([], [renewal(date)], '2027-01', rates)).toThrow(InvalidPolicyIssueDateError);
});
it('preserves missing-amount counts and filtering by payout month', () => {
  const payment = first('2026-10-31'); payment.installment!.policy!.sum_assured = null;
  expect(computeCommissionRows([payment], [], '2027-01', rates)).toEqual({ rows: [], missingSumAssuredCount: 1 });
  expect(computeCommissionRows([first('')], [], '2027-03', rates)).toEqual({ rows: [], missingSumAssuredCount: 0 });
});
