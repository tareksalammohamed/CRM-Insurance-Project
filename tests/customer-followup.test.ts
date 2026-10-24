import { expect, it } from 'vitest';
import { cairoToday, followupStatusLabel, validateFollowup } from '../src/features/customerFollowup/model';
import { followupError } from '../src/features/customerFollowup/errors';
const base = { notes: 'تم الاتفاق', nextDate: '2026-10-24', nextAction: 'اتصال', paymentMonth: '2026-10' };
it('validates real dates, required next steps and future promises', () => {
  expect(validateFollowup(base, undefined, '2026-10-24')).toBeNull();
  expect(validateFollowup({ ...base, nextDate: '2026-02-30' }, undefined, '2026-01-01')).toBe('اختر تاريخًا صحيحًا.');
  expect(validateFollowup({ ...base, nextAction: '' }, undefined, '2026-10-24')).toContain('الخطوة القادمة');
  expect(validateFollowup({ ...base, nextDate: '2026-10-23' }, undefined, '2026-10-24')).toContain('اليوم أو بعده');
  expect(validateFollowup({ ...base, nextDate: '', nextAction: '' }, undefined, '2026-10-24')).toBeNull();
});
it('distinguishes installment promises from later-year month promises', () => {
  const installment = { policyId: 'p', policyNumber: '1', installmentId: 'i' };
  const laterYear = { policyId: 'p', policyNumber: '1', minimumMonth: '2026-09' };
  expect(validateFollowup({ ...base, nextDate: '' }, installment)).toContain('تاريخ وعد السداد');
  expect(validateFollowup({ ...base, paymentMonth: '' }, installment, '2026-10-24')).toBeNull();
  expect(validateFollowup({ ...base, paymentMonth: '' }, laterYear, '2026-10-24')).toContain('شهر التحصيل');
  expect(validateFollowup({ ...base, paymentMonth: '2026-08' }, laterYear, '2026-10-24')).toContain('السنة الثانية');
});
it('uses Cairo calendar days and never describes a promise as a real payment before settlement', () => {
  expect(cairoToday(new Date('2026-10-23T22:30:00Z'))).toBe('2026-10-24');
  expect(followupStatusLabel({ kind: 'promise', followup_status: 'overdue' })).toContain('دون سداد');
  expect(followupStatusLabel({ kind: 'promise', followup_status: 'closed' })).toBe('وعد مغلق');
  expect(followupStatusLabel({ kind: 'promise', followup_status: 'paid' })).toBe('تم السداد الفعلي');
  expect(followupError({ message: 'القسط مسدد بالفعل؛ لا يحتاج وعد سداد' }, 'fallback')).toBe('القسط مسدد بالفعل؛ لا يحتاج وعد سداد');
});
