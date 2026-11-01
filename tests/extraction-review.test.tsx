import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ExtractionResult } from '../src/features/customerDataExtraction/types';
const mocked = vi.hoisted(() => ({ images: vi.fn() }));
vi.mock('../src/features/customerDataExtraction/utils/documentToImages', () => ({ documentFileToImagesWithMeta: mocked.images }));
import { DocumentExtractButton } from '../src/features/customerDataExtraction/components/DocumentExtractButton';
beforeEach(() => { vi.resetAllMocks(); mocked.images.mockResolvedValue({ images: ['image'], totalPages: 1, truncated: false }); });
afterEach(() => { cleanup(); document.body.innerHTML = ''; });
function mount(result: ExtractionResult | Promise<ExtractionResult>) {
  const formRef = createRef<HTMLFormElement>(), write = vi.fn(), extract = vi.fn().mockResolvedValue(result);
  render(<form ref={formRef}><label htmlFor="customer-name">الاسم</label><input id="customer-name" name="name" defaultValue="اسم كتبه المستخدم" /><input name="customer_id" type="hidden" defaultValue="customer-a" /><label htmlFor="phone">الهاتف</label><input id="phone" name="phone" /><label htmlFor="premium">القسط</label><input id="premium" name="premium_amount" type="number" />
    <DocumentExtractButton formRef={formRef} label="استخراج البيانات" extract={extract} setFieldValue={write} /></form>);
  const choose = () => fireEvent.change(document.querySelectorAll('input[type=file]')[1], { target: { files: [new File(['data'], 'image.png', { type: 'image/png' })] } });
  return { choose, write, extract, formRef };
}
const proposal = { fields: {
  name: { value: 'اسم بالمستند', confidence: 'high' as const, evidence: 'اسم بالمستند', sourceLabel: 'العميل' },
  phone: { value: '01012345678', confidence: 'low' as const, evidence: '٠١٠١٢٣٤٥٦٧٨', issue: 'خط غير واضح' },
  premium_amount: { value: '971', confidence: 'high' as const, evidence: '971', sourceLabel: 'القسط الصافي' },
} };
it('shows proposals and evidence before writing; uncertain and already-entered values are not preselected', async () => {
  const app = mount(proposal); app.choose();
  await screen.findByRole('dialog', { name: 'مراجعة البيانات المستخرجة' });
  expect(app.write).not.toHaveBeenCalled();
  expect((screen.getByRole('checkbox', { name: 'الاسم' }) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole('checkbox', { name: 'الهاتف' }) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole('checkbox', { name: 'القسط' }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText(/٠١٠١٢٣٤٥٦٧٨/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'تعبئة 1 خانة مختارة' }));
  expect(app.write.mock.calls).toEqual([['premium_amount', 971]]);
});
it('does not apply any selected field if the destination changes or becomes locked during review', async () => {
  const app = mount(proposal); app.choose(); await screen.findByRole('dialog', { name: 'مراجعة البيانات المستخرجة' });
  (app.formRef.current!.elements.namedItem('premium_amount') as HTMLInputElement).readOnly = true;
  fireEvent.click(screen.getByRole('button', { name: 'تعبئة 1 خانة مختارة' }));
  expect(app.write).not.toHaveBeenCalled(); expect(await screen.findByRole('alert')).toBeTruthy();
});
it('blocks an invalid proposed amount, then accepts an explicit correction without stripping unrelated digits', async () => {
  const app = mount({ fields: { premium_amount: { value: '971 / 50', confidence: 'low', issue: 'مبلغ غير واضح' } } }); app.choose();
  await screen.findByRole('dialog', { name: 'مراجعة البيانات المستخرجة' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'القسط' }));
  expect((screen.getByRole('button', { name: 'تعبئة 1 خانة مختارة' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('القيمة المقترحة: القسط'), { target: { value: '971' } });
  fireEvent.click(screen.getByRole('button', { name: 'تعبئة 1 خانة مختارة' }));
  expect(app.write.mock.calls).toEqual([['premium_amount', 971]]);
});
it('does not offer a result tied to a customer that was switched while the read was in flight', async () => {
  let resolve!: (result: ExtractionResult) => void;
  const app = mount(new Promise(done => { resolve = done; })); app.choose();
  await act(async () => { (app.formRef.current!.elements.namedItem('customer_id') as HTMLInputElement).value = 'customer-b'; resolve(proposal); });
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(screen.queryByRole('dialog')).toBeNull(); expect(app.write).not.toHaveBeenCalled();
});
it('ignores a result after its form is unmounted', async () => {
  let resolve!: (result: ExtractionResult) => void;
  const app = mount(new Promise(done => { resolve = done; })); app.choose(); cleanup();
  await act(async () => resolve(proposal));
  expect(app.write).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull();
});

it('discloses unread PDF pages even when the analyzed pages returned no matching fields', async () => {
  mocked.images.mockResolvedValue({ images: ['p1'], totalPages: 6, truncated: true });
  const app = mount({ fields: {} }); app.choose();
  expect((await screen.findByRole('alert')).textContent).toContain('أول 1 صفحات من 6');
  expect(screen.getByRole('alert').textContent).toContain('بقية الصفحات لم تُحلل');
  expect(app.write).not.toHaveBeenCalled();
});
