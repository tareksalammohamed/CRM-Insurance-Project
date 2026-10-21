import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { customerInputHints, paymentDateIssue } from '../src/lib/inputGuidance';
import { customerSchema } from '../src/pages/Customers/types';
import { PayInstallmentModal } from '../src/features/installments/PayInstallmentModal';
import { FormReview } from '../src/components/feedback/FormReview';
import type { Installment } from '../src/lib/supabase';
afterEach(cleanup);
const today = new Date(2026, 9, 11, 12);
it('explains missing, impossible and future payment dates but accepts actual days', () => {
  expect(paymentDateIssue('', today)).toContain('شهر');
  expect(paymentDateIssue('2026-02-30', today)).toContain('التقويم');
  expect(paymentDateIssue('2026-10-12', today)).toContain('مستقبلي');
  expect(paymentDateIssue('2024-02-29', today)).toBeNull();
  expect(paymentDateIssue('2026-10-11', today)).toBeNull();
});
it('advises without rewriting the source values and accepts Arabic digits', () => {
  const values = { national_id: '١٢٣٤٥٦٧٨٩٠١٢٣٤', phone: '+20 100 123 4567', birth_date: '1990-01-01' };
  expect(customerInputHints(values, today)).toEqual([]);
  expect(values.national_id).toBe('١٢٣٤٥٦٧٨٩٠١٢٣٤');
  expect(customerInputHints({ national_id: '12', phone: 'abc', birth_date: '2027-01-01' }, today)).toHaveLength(3);
});
it('allows legacy customer optional empty values but keeps new-customer requirements', () => {
  const legacy = { name: 'عميل', isEditingCustomer: true, insurance_amount: NaN, deposit_amount: NaN, payment_method: '', marital_status: '' };
  expect(customerSchema.safeParse(legacy).success).toBe(true);
  const result = customerSchema.safeParse({ ...legacy, isEditingCustomer: false });
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues.map(i => i.path[0])).toEqual(expect.arrayContaining(['insurance_amount', 'deposit_amount', 'payment_method']));
});
it('keeps zero deposit valid for a new customer', () => {
  expect(customerSchema.safeParse({ name: 'عميل', insurance_amount: 50000, deposit_amount: 0, payment_method: 'monthly' }).success).toBe(true);
});
it('payment dialog survives clearing the date and blocks confirmation', () => {
  const confirm = vi.fn();
  render(<PayInstallmentModal installment={{ due_date: '2099-01-01', amount: 100, installment_number: 1 } as Installment} paymentDateStr="" onPaymentDateChange={vi.fn()} processing={false} onConfirm={confirm} onClose={vi.fn()} />);
  expect(screen.getByRole('alert').textContent).toContain('تاريخ السداد');
  fireEvent.click(screen.getByRole('button', { name: 'تأكيد السداد' }));
  expect(confirm).not.toHaveBeenCalled();
});
it('does not dismiss payment while processing, including Escape', () => {
  const close = vi.fn();
  render(<PayInstallmentModal installment={{ due_date: '2020-01-01', amount: 100, installment_number: 1 } as Installment} paymentDateStr="2020-01-01" onPaymentDateChange={vi.fn()} processing onConfirm={vi.fn()} onClose={close} />);
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
  expect(close).not.toHaveBeenCalled();
});
it('error summary focuses the field and hides technical validator messages', () => {
  const ref = createRef<HTMLFormElement>();
  render(<form ref={ref}><FormReview formRef={ref} errors={{ premium_amount: { message: 'Invalid input: expected number' } }} /><input name="premium_amount" aria-label="premium" /></form>);
  expect(screen.queryByText(/Invalid input/)).toBeNull();
  fireEvent.click(screen.getByRole('button'));
  expect(document.activeElement).toBe(screen.getByLabelText('premium'));
});
it('explains each nested split-policy error and focuses the exact document field', () => {
  const ref = createRef<HTMLFormElement>();
  render(<form ref={ref}><FormReview formRef={ref} errors={{ split_chunks: [{}, { policy_number: { message: 'رقم الوثيقة مطلوب' }, premium_amount: { message: 'أدخل قيمة موجبة' } }] }} /><input name="split_chunks.1.policy_number" aria-label="second number" /><input name="split_chunks.1.premium_amount" aria-label="second premium" /></form>);
  fireEvent.click(screen.getByRole('button', { name: 'الوثيقة الفرعية 2 — القسط الصافي: أدخل قيمة موجبة' }));
  expect(document.activeElement).toBe(screen.getByLabelText('second premium'));
  expect(screen.getByRole('button', { name: 'الوثيقة الفرعية 2 — رقم الوثيقة: رقم الوثيقة مطلوب' })).toBeTruthy();
});
