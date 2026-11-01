import { describe, expect, it } from 'vitest';
import { nationalIdBirthDate, readCalendarDate, readDecimal, readJsonObject } from '../src/lib/ai/extractionValues';
import { fieldSourceConflict, matchExactOption, validateExtractedValue } from '../src/lib/ai/extractionSemantics';

describe('source reading without guessing', () => {
  it.each([['٢٢٥٬٠٠٠٫٥٠ ج.م.', 225000.5], ['۱٬۲۵۰', 1250], ['EGP 1,250.75', 1250.75], ['12 345', 12345], ['0', 0]])('reads one exact decimal %s', (text, expected) => expect(readDecimal(text)).toBe(expected));
  it.each(['971 / 225000', '971 و 50', '١٢ قسط', 'ثلاثة آلاف', '1,20', '', 'NaN', 'Infinity', '1e6'])('does not invent an amount from %s', text => expect(readDecimal(text)).toBeNull());
  it.each(['2026-02-29', '31/04/2026', '2026-13-01', '12/2/26', '2026-00-01'])('rejects a non-calendar date %s', text => expect(readCalendarDate(text)).toBeNull());
  it('keeps Egyptian day/month order and validates leap years', () => {
    expect(readCalendarDate('٠٣/٠٤/٢٠٢٤')).toBe('2024-04-03');
    expect(readCalendarDate('29.02.2024')).toBe('2024-02-29');
    expect(nationalIdBirthDate('٢٩٠٠١٠١١٢٣٤٥٦٧')).toBe('1990-01-01');
    expect(nationalIdBirthDate('29002311234567')).toBeNull();
  });
  it('preserves phone zeroes and blocks national ID in the phone field', () => {
    const field = { name: 'phone', label: 'الهاتف', inputType: 'text' as const, required: false };
    expect(validateExtractedValue(field, '٠١٠ ١٢٣٤ ٥٦٧٨')).toEqual({ value: '01012345678', error: null });
    expect(validateExtractedValue(field, '29001011234567').error).toBeTruthy();
    expect(validateExtractedValue(field, '1012345678').error).toContain('صفر');
  });
  it('requires a unique semantic option, not the first matching prefix', () => {
    const field = { name: 'marital_status', label: 'الحالة', inputType: 'select' as const, required: false, options: [{ value: 'married', label: 'متزوج/متزوجة' }, { value: 'single', label: 'أعزب/عزباء' }] };
    expect(matchExactOption(field, 'غير متزوج')).toBe('single');
    expect(matchExactOption(field, 'متزوجة')).toBe('married');
    expect(matchExactOption(field, 'متزوجة أو مطلقة')).toBeNull();
    expect(matchExactOption({ ...field, options: [{ value: 'a', label: 'شهري' }, { value: 'b', label: 'شهري إضافي' }] }, 'شه')).toBeNull();
  });
  it('distinguishes roles, financial meanings and date purposes', () => {
    expect(fieldSourceConflict('customer_name', 'اسم الوكيل')).toBeTruthy();
    expect(fieldSourceConflict('agent_name', 'اسم المؤمن عليه')).toBeTruthy();
    expect(fieldSourceConflict('premium_amount', 'إجمالي الأقساط المدفوعة')).toBeTruthy();
    expect(fieldSourceConflict('sum_assured', 'قيمة القسط')).toBeTruthy();
    expect(fieldSourceConflict('start_date', 'تاريخ إصدار البطاقة')).toBeTruthy();
    expect(fieldSourceConflict('premium_amount', 'القسط الصافي')).toBeNull();
  });
  it('parses a fenced/prose JSON object with escaped braces, and never repairs truncation', () => {
    const body = { fields: { notes: 'quote " { ok }' } };
    expect(readJsonObject(`نتيجة: \u0060\u0060\u0060json\n${JSON.stringify(body)}\n\u0060\u0060\u0060`)).toEqual(body);
    expect(() => readJsonObject('{"fields":{"premium_amount":12')).toThrow();
  });
});
