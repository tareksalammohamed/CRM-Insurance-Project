import { beforeEach, expect, it, vi } from 'vitest';
import type { DetectedFormField } from '../src/features/customerDataExtraction/types';
const mocked = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock('../src/lib/ai/aiManager', () => ({ askAI: mocked.ask }));
import { extractFormDataFromDocument, sanitizeFormExtraction } from '../src/lib/ai/formExtractionEngine';
const fields: DetectedFormField[] = [
  { name: 'name', label: 'اسم العميل', inputType: 'text', required: true },
  { name: 'national_id', label: 'الرقم القومي', inputType: 'text', required: false },
  { name: 'birth_date', label: 'الميلاد', inputType: 'date', required: false },
  { name: 'premium_amount', label: 'الصافي', inputType: 'number', required: true },
];
beforeEach(() => vi.resetAllMocks());
it('does not trust high confidence for wrong source meaning, bad numbers or impossible dates', () => {
  const result = sanitizeFormExtraction({ fields: {
    name: { value: 'أحمد علي', confidence: 'high', evidence: 'أحمد علي', sourceLabel: 'اسم الوكيل' },
    premium_amount: { value: '971 + 50 رسوم', confidence: 'high', sourceLabel: 'القسط الإجمالي' },
    birth_date: { value: '31/02/2026', confidence: 'high' },
    customer_id: { value: 'invented-uuid', confidence: 'high' },
  } }, fields, 1);
  expect(result.fields.name.confidence).toBe('low');
  expect(result.fields.premium_amount.issue).toContain('مبلغ واحد');
  expect(result.fields.birth_date.issue).toContain('تاريخ غير صحيح');
  expect(result.fields.customer_id).toBeUndefined();
});
it('flags contradictory identity and birth date, and rejects a mixed-record form', () => {
  const result = sanitizeFormExtraction({ fields: { national_id: { value: '29001011234567', confidence: 'high', evidence: '29001011234567', sourceLabel: 'رقم قومي' }, birth_date: { value: '1991-01-01', confidence: 'high', evidence: '1991-01-01', sourceLabel: 'ميلاد' } } }, fields, 1);
  expect(result.fields.national_id.issue).toContain('غير متطابقين');
  expect(result.fields.birth_date.confidence).toBe('low');
  expect(sanitizeFormExtraction({ ambiguous_records: true, fields: { name: { value: 'أحمد' } } }, fields, 2)).toMatchObject({ fields: {}, warnings: [expect.stringContaining('أكثر من عميل')] });
});
it('uses the existing gateway with vision, field semantics and evidence; never sends existing entered values as instructions', async () => {
  mocked.ask.mockResolvedValue({ success: true, content: '```json\n{"fields":{"premium_amount":{"value":"٩٧١","confidence":"high","evidence":"٩٧١","sourceLabel":"القسط الصافي","sourcePage":1}}}\n```' });
  const result = await extractFormDataFromDocument(['image'], fields.map(field => ({ ...field, currentValue: 'private-existing-value' })), { formPurpose: 'إصدار وثيقة' });
  expect(result.fields.premium_amount).toMatchObject({ value: '971', confidence: 'high', sourcePage: 1 });
  expect(mocked.ask.mock.calls[0][1]).toMatchObject({ temperature: 0, preferVision: true });
  const prompt = JSON.stringify(mocked.ask.mock.calls[0][0]);
  expect(prompt).toContain('القسط الصافي لكل دفعة');
  expect(prompt).toContain('مصدر');
  expect(prompt).not.toContain('private-existing-value');
});

it('compares document identity with the selected policy customer and never preselects a mismatched or unknown subject', async () => {
  mocked.ask.mockResolvedValue({ success: true, content: JSON.stringify({ subject_name: 'شخص آخر', fields: { premium_amount: { value: '971', confidence: 'high', evidence: '971', sourceLabel: 'القسط الصافي' } } }) });
  const result = await extractFormDataFromDocument(['image'], fields, { formPurpose: 'وثيقة', expectedCustomerName: 'طارق سلام' });
  expect(result.fields.premium_amount.confidence).toBe('low');
  expect(result.warnings?.[0]).toContain('طارق سلام');
  expect(result.warnings?.[0]).toContain('شخص آخر');
});
