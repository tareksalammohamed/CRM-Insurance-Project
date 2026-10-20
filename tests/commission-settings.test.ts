import { afterEach, expect, it, vi } from 'vitest';
import { computeCommissionRows } from '../src/pages/Commissions/business/commissionsCalculator';
import { cairoDate, cairoToday, percentToRate, rateForDate, validateRate } from '../src/features/commissionSettings/rates';
import type { RawYear1Payment, RawYear2Payment } from '../src/pages/Commissions/services/commissionsService';
const rates = [{ effective_from: '2026-11-01', year1_percent: 3, renewal_percent: 0.1 }];
const policy = { payment_method: 'annual', sum_assured: 100000, policy_number: '123', customer: { name: 'عميل' } };
afterEach(() => vi.useRealTimers());
it('keeps baseline percentages including the small renewal rate', () => {
  expect(percentToRate(rateForDate('2026-10-31', rates).year1_percent)).toBe(0.022);
  expect(percentToRate(rateForDate('2026-10-31', rates).renewal_percent)).toBe(0.0005);
});
it('selects by payment date, not the month the commission is paid', () => {
  const first = [{ id: 'old', paid_at: '2026-10-16T12:00:00Z', installment: { policy } }, { id: 'new', paid_at: '2026-11-01T12:00:00Z', installment: { policy } }] as RawYear1Payment[];
  const renewals = [{ id: 'renewal', payment_date: '2026-11-01', policy }] as RawYear2Payment[];
  expect(computeCommissionRows(first, renewals, '2026-11', rates).rows.map(r => r.amount)).toEqual([2200, 3000, 100]);
});
it('uses Cairo date at midnight for schedule matching', () => {
  expect(cairoDate(new Date('2026-11-01T22:30:00Z'))).toBe('2026-11-02');
});
it('accepts explicit zero rates and rejects NaN, negatives and percentages above 100', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  expect(validateRate({ ...rates[0], year1_percent: 0 })).toBeNull();
  for (const year1_percent of [NaN, -1, 101]) expect(validateRate({ ...rates[0], year1_percent })).not.toBeNull();
  expect(computeCommissionRows([{ id: 'zero', paid_at: '2026-11-01', installment: { policy } }] as RawYear1Payment[], [], '2026-11', [{ ...rates[0], year1_percent: 0 }]).rows[0].amount).toBe(0);
});
it('rejects past, today and impossible effective dates', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  for (const effective_from of ['2026-10-19', cairoToday(), '2026-11-31', '']) expect(validateRate({ ...rates[0], effective_from })).not.toBeNull();
});
it('selects the latest applicable version even if versions arrive out of order', () => {
  expect(rateForDate('2027-02-01', [{ effective_from: '2027-01-01', year1_percent: 4, renewal_percent: 0.2 }, ...rates]).year1_percent).toBe(4);
});
