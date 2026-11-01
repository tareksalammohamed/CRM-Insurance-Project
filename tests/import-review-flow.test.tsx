vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ParseResult } from '../src/pages/DataImport/services/dataImportService';
const mocked = vi.hoisted(() => ({ parse: vi.fn(), send: vi.fn() }));
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u', role: 'supervisor', name: 'طارق' } }) }));
vi.mock('../src/lib/branchContext', () => ({ useBranchContext: () => ({ currentBranchId: 'b' }) }));
vi.mock('../src/pages/DataImport/services/dataImportService', async importOriginal => ({ ...await importOriginal<object>(), parseWorkbookFile: mocked.parse, importRows: mocked.send, fetchImportAgents: async () => [{ id: 'a', name: 'أحمد محمد' }] }));
vi.mock('../src/pages/DataImport/services/aiDocumentExtractor', () => ({ detectDocumentKind: () => null, extractRowsFromDocument: vi.fn() }));
vi.mock('../src/features/jobs/jobService', () => ({ createAppJob: async () => ({ id: 'j' }), updateAppJob: async () => {}, finishAppJob: async () => {} }));
vi.mock('../src/features/jobs/importResumeService', () => ({ createImportCheckpoint: async () => {}, updateImportCheckpoint: async () => {}, getCompletedImportRowNumbers: async () => new Set(), getImportCheckpoint: async () => null, downloadCheckpointFile: vi.fn(), cleanupImportResumeData: async () => {} }));
import { IMPORT_COLUMNS } from '../src/pages/DataImport/types';
import { buildParsedRow } from '../src/pages/DataImport/services/dataImportService';
import { DataImport } from '../src/pages/DataImport';
const row = buildParsedRow(2, { customer_name: 'سارة أحمد', agent_name: 'أحمد محمد', policy_number: '70101', policy_type: 'الرباعية', sum_assured: '225000', premium_amount: '971', payment_method: 'شهري', start_date: '2026-10-01' }, [{ id: 'a', name: 'أحمد محمد' }]);
const review = { headers: IMPORT_COLUMNS.map(column => column.header), samples: [IMPORT_COLUMNS.map(column => String(row.raw[column.key] ?? ''))], mapping: Object.fromEntries(IMPORT_COLUMNS.map((column, index) => [column.key, index])), warnings: [], sheetName: 'البيانات', headerRowNumber: 1, needsConfirmation: true };
const pending: ParseResult = { rows: [{ ...row, payload: null, review: { source: 'columns', confirmed: false } }], headerError: null, usedAIMapping: true, columnReview: review };
const approved: ParseResult = { rows: [row], headerError: null, columnReview: { ...review, needsConfirmation: false } };
beforeEach(() => { vi.resetAllMocks(); mocked.send.mockResolvedValue({ totalRows: 1, importedCount: 1, failedCount: 0, results: [] }); });
afterEach(cleanup);
function mount() {
  render(<MemoryRouter><DataImport /></MemoryRouter>);
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'test.xlsx')] } });
}
it('blocks sending until the AI column proposal is explicitly approved, then sends the revalidated rows', async () => {
  mocked.parse.mockResolvedValueOnce(pending).mockResolvedValueOnce(approved); mount();
  const approve = await screen.findByRole('button', { name: 'اعتماد التوزيع وإعادة فحص الصفوف' });
  expect((screen.getByRole('button', { name: /بدء الاستيراد/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(mocked.send).not.toHaveBeenCalled();
  fireEvent.click(approve);
  await waitFor(() => expect((screen.getByRole('button', { name: /بدء الاستيراد/ }) as HTMLButtonElement).disabled).toBe(false));
  expect(mocked.parse.mock.calls[1][2]).toMatchObject({ columnMapping: review.mapping, sheetName: 'البيانات', headerRowNumber: 1 });
  fireEvent.click(screen.getByRole('button', { name: /بدء الاستيراد/ }));
  await waitFor(() => expect(mocked.send).toHaveBeenCalledOnce());
  expect(mocked.send.mock.calls[0][0][0].payload).toMatchObject({ p_sum_assured: 225000, p_premium_amount: 971, p_agent_id: 'a' });
  expect(mocked.send.mock.calls[0][1]).toBe('b');
});
it('ignores an old parse after the source file has been removed', async () => {
  let resolve!: (value: ParseResult) => void;
  mocked.parse.mockReturnValue(new Promise(done => { resolve = done; })); mount();
  await waitFor(() => expect(mocked.parse).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByTitle('إزالة الملف'));
  await act(async () => resolve(pending));
  expect(screen.queryByRole('button', { name: 'اعتماد التوزيع وإعادة فحص الصفوف' })).toBeNull();
  expect(mocked.send).not.toHaveBeenCalled();
});
