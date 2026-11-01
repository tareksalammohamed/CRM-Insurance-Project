vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import * as XLSX from 'xlsx';
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ mapping: vi.fn(), rpc: vi.fn() }));
vi.mock('../src/pages/DataImport/services/aiColumnMatcher', () => ({ matchColumnsWithAI: mock.mapping }));
import { supabase } from '../src/lib/supabase';
import { IMPORT_COLUMNS, type ImportColumnKey } from '../src/pages/DataImport/types';
import { buildParsedRow, importRows, matchAgentName, parseWorkbookFile, revalidateRow, validateFileDuplicates } from '../src/pages/DataImport/services/dataImportService';
const agent = { id: 'agent-1', name: 'أحمد محمد علي' };
const base: Record<ImportColumnKey, string> = { customer_name: 'سارة محمد أحمد', national_id: '29001011234567', phone: '01012345678', address: 'القاهرة', birth_date: '1990-01-01', occupation: 'مهندسة', marital_status: 'متزوجة', agent_name: agent.name, policy_number: '7010150696219', policy_type: 'الرباعية', sum_assured: '225000', premium_amount: '971.75', payment_method: 'شهري', start_date: '2026-10-01', notes: '' };
const headers = IMPORT_COLUMNS.map(column => column.header);
const values = IMPORT_COLUMNS.map(column => base[column.key]);
function fileFor(rows: unknown[][], name = 'data.xlsx', before?: unknown[][]): File {
  const workbook = XLSX.utils.book_new();
  if (before) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(before), 'تعليمات');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'البيانات');
  const buffer: ArrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return { name, size: buffer.byteLength, arrayBuffer: async () => buffer } as File;
}
beforeEach(() => { vi.resetAllMocks(); mock.mapping.mockResolvedValue({ mapping: null }); vi.spyOn(supabase, 'rpc').mockImplementation(mock.rpc); mock.rpc.mockResolvedValue({ error: null }); });
it('keeps the standard template and existing premium truncation, with no AI or financial writes', async () => {
  const result = await parseWorkbookFile(fileFor([headers, values]), [agent]);
  expect(result.headerError).toBeNull();
  expect(result.rows[0].payload).toMatchObject({ p_customer_name: base.customer_name, p_agent_id: agent.id, p_premium_amount: 971, p_sum_assured: 225000, p_start_date: '2026-10-01' });
  expect(result.columnReview?.needsConfirmation).toBe(false);
  expect(mock.mapping).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
});
it('reads a data sheet after instructions, discovers a title/header offset, and keeps physical row numbers across blank lines', async () => {
  const result = await parseWorkbookFile(fileFor([['كشف شركة التأمين'], headers, [], values], 'data.xlsx', [['تعليمات الاستخدام']]), [agent]);
  expect(result.columnReview).toMatchObject({ sheetName: 'البيانات', headerRowNumber: 2 });
  expect(result.rows[0].rowNumber).toBe(4);
  expect(result.rows[0].payload?.p_policy_number).toBe(base.policy_number);
});
it('selects the explicit net premium, never installment count, paid amount or the smallest number', async () => {
  const result = await parseWorkbookFile(fileFor([[...headers, 'عدد الأقساط', 'المسدد من القسط', 'القسط الإجمالي'], [...values, 12, 100, 1200]]), [agent]);
  expect(result.rows[0].payload?.p_premium_amount).toBe(971);
});
it('holds ambiguous columns until explicit one-to-one confirmation, without another AI call', async () => {
  const premiumIndex = IMPORT_COLUMNS.findIndex(column => column.key === 'premium_amount');
  const ambiguous = [...headers]; ambiguous[premiumIndex] = 'قسط صافي آخر';
  const file = fileFor([[...ambiguous, 'قسط صافي'], [...values, 17]]);
  const first = await parseWorkbookFile(file, [agent]);
  expect(first.columnReview?.needsConfirmation).toBe(true);
  expect(first.rows.every(row => !row.payload)).toBe(true);
  const review = first.columnReview!;
  const fixed = await parseWorkbookFile(file, [agent], { ...review, columnMapping: { ...review.mapping, premium_amount: premiumIndex } });
  expect(fixed.headerError).toBeNull(); expect(fixed.rows[0].payload?.p_premium_amount).toBe(971);
  expect(mock.mapping).toHaveBeenCalledTimes(1);
  const duplicate = await parseWorkbookFile(file, [agent], { ...review, columnMapping: { ...review.mapping, premium_amount: review.mapping.sum_assured } });
  expect(duplicate.rows).toEqual([]); expect(duplicate.headerError).toContain('لأكثر من خانة');
});
it('does not let an AI proposal reuse a locked primary column for a missing field', async () => {
  const agentIndex = IMPORT_COLUMNS.findIndex(column => column.key === 'agent_name');
  const customHeaders = [...headers]; customHeaders[agentIndex] = 'مسؤول';
  mock.mapping.mockResolvedValue({ mapping: { agent_name: 'اسم العميل' } });
  const result = await parseWorkbookFile(fileFor([customHeaders, values]), [agent]);
  expect(result.headerError).toContain('اسم الوكيل'); expect(result.rows).toEqual([]);
});
it('keeps CSV identifiers as strings including the initial phone zero', async () => {
  const csv = [headers.join(','), values.map(value => value.includes(',') ? `"${value}"` : value).join(',')].join('\n');
  const file = { name: 'data.csv', size: csv.length, text: async () => csv } as File;
  const result = await parseWorkbookFile(file, [agent]);
  expect(result.rows[0].payload?.p_phone).toBe('01012345678');
  expect(result.rows[0].payload?.p_policy_number).toBe(base.policy_number);
});
it('rejects rolled-over dates and swapped identity fields rather than saving a valid-looking replacement', () => {
  const result = buildParsedRow(2, { ...base, start_date: '31/02/2026', phone: base.national_id, national_id: base.phone }, [agent]);
  expect(result.payload).toBeNull(); expect(result.clientError).toContain('تاريخ بداية التأمين غير صحيح');
  expect(result.clientError).toContain('الرقم القومي'); expect(result.clientError).toContain('الهاتف');
});
it('never assigns an owner by fuzzy name or by the first of two identical names', () => {
  expect(matchAgentName('أحمد محمد على حسن', [agent]).agent).toBeNull();
  const agents = [agent, { ...agent, id: 'agent-2' }];
  expect(matchAgentName(agent.name, agents).agent).toBeNull();
  expect(buildParsedRow(2, { ...base }, agents).payload).toBeNull();
  expect(buildParsedRow(2, { ...base, __agent_id: 'agent-2' }, agents).payload?.p_agent_id).toBe('agent-2');
  expect(buildParsedRow(2, { ...base, __agent_id: 'outside-scope' }, agents).payload).toBeNull();
});
it('blocks duplicate policies before sending, and clears the error when the source row is corrected', async () => {
  const one = buildParsedRow(2, { ...base }, [agent]), two = buildParsedRow(3, { ...base }, [agent]);
  const result = validateFileDuplicates([one, two]);
  expect(result.every(row => !row.payload)).toBe(true);
  const summary = await importRows(result, null, vi.fn());
  expect(summary.failedCount).toBe(2); expect(mock.rpc).not.toHaveBeenCalled();
  expect(validateFileDuplicates([one, revalidateRow({ ...two, raw: { ...two.raw, policy_number: 'POL-2' } }, [agent])]).every(row => row.payload)).toBe(true);
});
it('enforces persisted review flags at the write boundary and then uses the unchanged RPC payload', async () => {
  const row = buildParsedRow(2, { ...base }, [agent]);
  await importRows([{ ...row, review: { source: 'document', confirmed: false } }], 'branch', vi.fn());
  expect(mock.rpc).not.toHaveBeenCalled();
  const approved = revalidateRow({ ...row, review: { source: 'document', confirmed: true } }, [agent]);
  await importRows([approved], 'branch', vi.fn());
  expect(mock.rpc).toHaveBeenCalledWith('import_policy_row_v2', { ...approved.payload, p_branch_id: 'branch' });
});
it('keeps unsafe numeric identifiers blocked through revalidation, until corrected from the source', async () => {
  const rowValues: unknown[] = [...values]; rowValues[IMPORT_COLUMNS.findIndex(column => column.key === 'policy_number')] = Number('123456789012345678');
  const result = await parseWorkbookFile(fileFor([headers, rowValues]), [agent]);
  expect(result.rows[0].payload).toBeNull(); expect(result.rows[0].clientError).toContain('غير دقيق');
  expect(revalidateRow(result.rows[0], [agent]).payload).toBeNull();
  expect(revalidateRow({ ...result.rows[0], raw: { ...result.rows[0].raw, policy_number: '123456789012345679' } }, [agent]).payload?.p_policy_number).toBe('123456789012345679');
});

it('flags a birth date that contradicts a valid national ID without deriving a replacement', () => {
  const row = buildParsedRow(2, { ...base, birth_date: '1991-01-01' }, [agent]);
  expect(row.payload).toBeNull(); expect(row.clientError).toContain('لا يطابق الرقم القومي');
  expect(row.raw.birth_date).toBe('1991-01-01');
});
it('uses actual numeric Excel cells despite display formatting, and preserves native dates after editing', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([headers, values]);
  sheet['L2'] = { t: 'n', v: 971.75, z: '0.00E+00' };
  sheet['K2'] = { t: 'n', v: 225000, z: '#,##0.00" EGP"' };
  sheet['N2'] = { t: 'd', v: new Date(2026, 9, 1, 12), z: 'mm/dd/yyyy' };
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'البيانات');
  const buffer: ArrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const result = await parseWorkbookFile({ name: 'formatted.xlsx', size: buffer.byteLength, arrayBuffer: async () => buffer } as File, [agent]);
  expect(result.rows[0].payload).toMatchObject({ p_premium_amount: 971, p_sum_assured: 225000, p_start_date: '2026-10-01' });
  expect(revalidateRow(result.rows[0], [agent]).payload?.p_start_date).toBe('2026-10-01');
});
it('does not reinterpret a percentage-formatted Excel cell as a monetary premium', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([headers, values]); sheet['L2'] = { t: 'n', v: 12.9, z: '0%' };
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'البيانات');
  const buffer: ArrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const result = await parseWorkbookFile({ name: 'percentage.xlsx', size: buffer.byteLength, arrayBuffer: async () => buffer } as File, [agent]);
  expect(result.rows[0].payload).toBeNull(); expect(result.rows[0].clientError).toContain('نسبة مئوية');
  expect(revalidateRow(result.rows[0], [agent]).payload).toBeNull();
});
