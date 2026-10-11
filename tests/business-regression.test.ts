import { describe, expect, it } from 'vitest';
import { calculatePrice } from '../src/pages/PriceCalculator/pricingEngine';
import { PRICING_VARIANTS } from '../src/pages/PriceCalculator/pricingData';
import { calculatePolicyBenefit } from '../src/pages/PriceCalculator/PolicyBenefits';
import { computeCommissionRows, computeSummary } from '../src/pages/Commissions/business/commissionsCalculator';
import { isEligibleForCancellationRate, computeTotalCollected } from '../src/pages/Cancellations/business/cancellationCalculator';
import type { RawYear1Payment, RawYear2Payment } from '../src/pages/Commissions/services/commissionsService';

describe('existing insurance business rules (unchanged)', () => {
  it('locks a known protection/investment quote', () => {
    const result = calculatePrice({ age: 30, variantKey: 'protection_investment_15y', sumInsured: 100000 });
    expect(result.annualPremium).toBe(6342);
    expect(result.semiAnnualPremium).toBeCloseTo(3297.84);
    expect(result.quarterlyPremium).toBeCloseTo(1648.92);
    expect(result.monthlyPremium).toBeCloseTo(549.64);
    expect(calculatePolicyBenefit(result)).toMatchObject({ kind: 'flat_profit', annualProfit: 5750, totalProfit: 86250, maturityAmount: 186250 });
  });
  it.each([0, 25, 50] as const)('preserves pension option %s%% cash, divisor 89, and 120 months', (cash) => {
    const variant = PRICING_VARIANTS.find((item) => item.family === 'pension_reassurance')!;
    const age = Math.min(...Object.keys(variant.rates).map(Number));
    const quote = calculatePrice({ age, variantKey: variant.key, sumInsured: 890000 });
    expect(calculatePolicyBenefit(quote, cash)).toMatchObject({ kind: 'pension', cashReward: cash * 8900,
      monthlyPension: { 0: 10000, 25: 7500, 50: 5000 }[cash], pensionMonths: 120 });
  });
  it.each(['monthly', 'quarterly', 'semi_annual', 'annual'])('preserves year-one and renewal commission for %s', (method) => {
    const count = { monthly: 12, quarterly: 4, semi_annual: 2, annual: 1 }[method]!;
    const policy = { payment_method: method, sum_assured: 120000, policy_number: '123456789', customer: { name: 'عميل' } };
    const year1 = [{ id: 'one', paid_at: '2026-10-15T12:00:00', installment: { policy } }] as RawYear1Payment[];
    const year2 = [{ id: 'two', payment_date: '2026-09-16', policy }] as RawYear2Payment[];
    const { rows } = computeCommissionRows(year1, year2, '2026-10');
    expect(rows).toHaveLength(2); expect(rows[0]).toMatchObject({ amount: 2640 / count, dueDay: 27, type: 'year1' });
    expect(rows[1]).toMatchObject({ amount: 60 / count, dueDay: 12, type: 'renewal' });
    expect(computeSummary(rows).totalMonth).toBeCloseTo(2700 / count);
  });
  it('preserves the 15/16 commission boundary across December', () => {
    const policy = { payment_method: 'annual', sum_assured: 100000, policy_number: '123' };
    const payments = [15, 16].map((day) => ({ id: `${day}`, paid_at: `2026-12-${day}T12:00:00`, installment: { policy } })) as RawYear1Payment[];
    expect(computeCommissionRows(payments, [], '2026-12').rows).toHaveLength(1);
    expect(computeCommissionRows(payments, [], '2027-01').rows[0]).toMatchObject({ dueDay: 12, amount: 2200 });
  });
  it('keeps cancellation eligibility strictly below 18 months', () => {
    expect(isEligibleForCancellationRate('2025-01-01', '2026-06-30')).toBe(true);
    expect(isEligibleForCancellationRate('2025-01-01', '2026-07-01')).toBe(false);
  });
  it('keeps cancellation denominator inclusive of both years and scoped to owners', () => {
    expect(computeTotalCollected([{ amount: 100, installment: { policy: { owner_id: 'a' } } }, { amount: 1000, installment: { policy: { owner_id: 'outside' } } }],
      [{ amount: 50, policy: { owner_id: 'a' } }], ['a'])).toBe(150);
  });
});
