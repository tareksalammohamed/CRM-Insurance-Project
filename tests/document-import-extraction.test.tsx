vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ images: vi.fn(), ask: vi.fn() }));
vi.mock('../src/features/customerDataExtraction/utils/documentToImages', () => ({ documentFileToImagesWithMeta: mock.images }));
vi.mock('../src/lib/ai/aiManager', () => ({ askAI: mock.ask }));
import { extractRowsFromDocument, parseDocumentPage } from '../src/pages/DataImport/services/aiDocumentExtractor';
import { RowEditModal } from '../src/pages/DataImport/components/RowEditModal';
const agent = { id: 'a', name: 'أحمد محمد' };
const raw = { customer_name: 'سارة أحمد', agent_name: agent.name, policy_number: '7010150696219', policy_type: 'الرباعية', sum_assured: '225000', premium_amount: '971.75', payment_method: 'شهري', start_date: '2026-10-01' };
const response = (values = raw) => ({ success: true, content: JSON.stringify({ sources: { premium_amount: 'القسط الصافي', customer_name: 'المؤمن عليه' }, rows: [{ ...values, _evidence: { premium_amount: values.premium_amount } }] }) });
beforeEach(() => { vi.resetAllMocks(); mock.images.mockResolvedValue({ images: ['p1', 'p2'], totalPages: 2 }); });
afterEach(cleanup);
it('preserves page/field evidence and requires explicit row review before producing a usable payload', () => {
  const [row] = parseDocumentPage(response().content, 3, [agent], 2);
  expect(row.payload).toBeNull(); expect(row.review).toMatchObject({ source: 'document', page: 3, confirmed: false });
  expect(row.review?.fields?.premium_amount).toMatchObject({ evidence: '971.75', sourceLabel: 'القسط الصافي' });
  const saved = vi.fn(); render(<RowEditModal row={row} agents={[agent]} onSave={saved} onCancel={vi.fn()} />);
  expect(screen.getByText(/القسط الصافي: «971.75»/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'اعتماد بيانات الصف بعد المراجعة' }));
  expect(saved.mock.calls[0][0].review.confirmed).toBe(true);
  expect(saved.mock.calls[0][0].payload).toMatchObject({ p_sum_assured: 225000, p_premium_amount: 971.75, p_agent_id: 'a' });
});
it('keeps conflicting repeated policies visible instead of silently dropping the second record', async () => {
  mock.ask.mockResolvedValueOnce(response()).mockResolvedValueOnce(response({ ...raw, premium_amount: '999' }));
  const checkpoint = vi.fn();
  const result = await extractRowsFromDocument(new File(['x'], 'data.pdf'), 'pdf', [agent], undefined, { onCheckpoint: checkpoint });
  expect(result.rows).toHaveLength(2); expect(result.processedPages).toBe(2);
  expect(result.rows.every(row => !row.payload && row.clientError?.includes('مكرر داخل الملف'))).toBe(true);
  expect(result.rows.map(row => row.review?.page)).toEqual([1, 2]);
  expect(mock.ask.mock.calls[0][1]).toMatchObject({ preferVision: true, temperature: 0 });
  expect(checkpoint).toHaveBeenCalledTimes(2);
});
it('deduplicates only identical rows and keeps the original record reviewable', async () => {
  mock.ask.mockResolvedValue(response());
  const result = await extractRowsFromDocument(new File(['x'], 'data.pdf'), 'pdf', [agent]);
  expect(result.rows).toHaveLength(1); expect(result.rows[0].review?.confirmed).toBe(false); expect(result.partial).toBe(false);
});
it('preserves completed pages and resume metadata if the next page is malformed or capacity ends', async () => {
  mock.ask.mockResolvedValueOnce(response()).mockResolvedValueOnce({ success: false, failureType: 'capacity_exhausted', retryAfterSeconds: 30 });
  const result = await extractRowsFromDocument(new File(['x'], 'data.pdf'), 'pdf', [agent]);
  expect(result).toMatchObject({ error: null, partial: true, processedPages: 1, totalPages: 2, capacityExhausted: true, retryAfterSeconds: 30 });
  expect(result.rows).toHaveLength(1);
  mock.ask.mockReset().mockResolvedValueOnce(response()).mockResolvedValueOnce({ success: true, content: '{"rows":[' });
  const malformed = await extractRowsFromDocument(new File(['x'], 'data.pdf'), 'pdf', [agent]);
  expect(malformed.rows).toHaveLength(1); expect(malformed.processedPages).toBe(1); expect(malformed.partial).toBe(true);
});
it('does not mix object/array values into cells or advance past an unreadable page', () => {
  expect(() => parseDocumentPage('{"rows":[{"sum_assured":{"amount":5000}}]}', 1, [agent], 2)).toThrow();
  expect(() => parseDocumentPage('{"rows":[null]}', 1, [agent], 2)).toThrow();
});
