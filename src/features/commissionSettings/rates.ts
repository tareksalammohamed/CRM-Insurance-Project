export interface CommissionRate {
  effective_from: string;
  year1_percent: number;
  renewal_percent: number;
}
export const LEGACY_COMMISSION_RATE: CommissionRate = { effective_from: '1900-01-01', year1_percent: 2.2, renewal_percent: 0.05 };

/** Rates are chosen by the actual payment date, never by payout month. */
export function rateForDate(date: string, rates: readonly CommissionRate[]): CommissionRate {
  return rates.reduce((selected, rate) => rate.effective_from <= date && rate.effective_from >= selected.effective_from ? rate : selected, LEGACY_COMMISSION_RATE);
}
export function cairoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (type: string) => parts.find(p => p.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function cairoToday(): string { return cairoDate(new Date()); }
export function percentToRate(value: number): number { return Number((value / 100).toFixed(6)); }
export function tomorrowInCairo(): string {
  const date = new Date(`${cairoToday()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
export function validateRate(rate: CommissionRate): string | null {
  if (![rate.year1_percent, rate.renewal_percent].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) return 'أدخل نسبة مئوية بين صفر و100 في الخانتين.';
  const date = new Date(`${rate.effective_from}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== rate.effective_from || rate.effective_from <= cairoToday()) return 'اختر تاريخًا من الغد أو بعده لحماية العمولات السابقة.';
  return null;
}
