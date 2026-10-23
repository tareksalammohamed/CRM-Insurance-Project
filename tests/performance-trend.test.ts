import { expect, it } from 'vitest';
import { computePerformanceTrend, type TrendPayment } from '../src/pages/Reports/business/performanceTrend';
it('keeps six ordered months including empty months and separates production from collection within scope', () => {
  const payment = (payment_month: string, amount: number, is_first: boolean, owner_id = 'a'): TrendPayment => ({ payment_month, amount, installment: { is_first, policy: { owner_id } } });
  const result = computePerformanceTrend([
    payment('2026-05-01', 100, true), payment('2026-05-01', 20, false),
    payment('2026-10-01', 300, true), payment('2026-10-01', 900, false, 'outside'),
    payment('2026-04-01', 1000, true),
  ], ['a'], new Date(2026, 9, 23));
  expect(result.map(row => row.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  expect(result[0]).toMatchObject({ production: 100, collection: 20 });
  expect(result[1]).toMatchObject({ production: 0, collection: 0 });
  expect(result[5]).toMatchObject({ production: 300, collection: 0 });
});
it('orders months correctly across a year boundary', () => {
  expect(computePerformanceTrend([], [], new Date(2026, 1, 12)).map(row => row.month)).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
});
