import { beforeEach, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock('../src/lib/ai/aiManager', () => ({ askAI: mocked.ask }));
import { matchColumnsWithAI } from '../src/pages/DataImport/services/aiColumnMatcher';
beforeEach(() => vi.resetAllMocks());
it('rejects invented, duplicated and semantically wrong source columns even when the model returns them', async () => {
  mocked.ask.mockResolvedValue({ success: true, content: 'نتيجة:\n```json\n{"mapping":{"customer_name":"اسم الوكيل","agent_name":"اسم الوكيل","premium_amount":"إجمالي الأقساط","sum_assured":"قيمة غير موجودة","national_id":"الرقم","policy_number":"الرقم"}}\n```' });
  const result = await matchColumnsWithAI(['اسم الوكيل', 'إجمالي الأقساط', 'الرقم'], [['أحمد', 999, 123]]);
  expect(result.mapping).toEqual({ agent_name: 'اسم الوكيل', national_id: 'الرقم' });
  expect(JSON.stringify(mocked.ask.mock.calls[0][0])).toContain('ليست وسيلة الدفع');
});
it('does not identify an ambiguous duplicate header by its first index', async () => {
  mocked.ask.mockResolvedValue({ success: true, content: '{"mapping":{"premium_amount":"القسط"}}' });
  expect((await matchColumnsWithAI(['القسط', 'القسط'], [[971, 1200]])).mapping).toEqual({});
});
