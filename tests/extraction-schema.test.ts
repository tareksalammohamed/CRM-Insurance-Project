import { afterEach, expect, it } from 'vitest';
import { extractFormFieldSchema } from '../src/features/customerDataExtraction/utils/formFieldSchema';
afterEach(() => { document.body.innerHTML = ''; });
it('uses each real editable control and its own label, never hidden, locked or internal IDs', () => {
  document.body.innerHTML = `<form><div class="form-group"><label for="name">اسم العميل *</label><input id="name" name="name" value="طارق"><div class="form-group"><label for="phone">رقم الهاتف</label><input id="phone" name="phone" value="01012345678"></div></div>
    <label for="nid">الرقم القومي</label><input id="nid" name="national_id">
    <input type="hidden" name="customer_id" value="uuid"><select name="agent_id"><option value="uuid">وكيل</option></select>
    <label for="sum">مبلغ التأمين</label><input id="sum" name="sum_assured" type="number" min="0" readonly value="50000">
    <fieldset disabled><input name="disabled_amount" value="100"></fieldset><div class="hidden"><input name="old" value="old"></div>
    <input name="duplicate"><input name="duplicate"><input name="file" type="file"><textarea name="notes" aria-label="الملاحظات"></textarea>
    <label for="payment">طريقة السداد</label><select id="payment" name="payment_method"><option value="">اختر</option><option value="monthly">شهري</option></select>
  </form>`;
  const fields = extractFormFieldSchema(document.querySelector('form')!);
  expect(fields.map(field => field.name)).toEqual(['name', 'phone', 'national_id', 'notes', 'payment_method']);
  expect(fields[0]).toMatchObject({ label: 'اسم العميل', currentValue: 'طارق', required: true });
  expect(fields[1].label).toBe('رقم الهاتف');
  expect(fields[4].options).toEqual([{ value: 'monthly', label: 'شهري' }]);
});
