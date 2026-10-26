import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Installment, Policy } from '../src/lib/supabase';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), error: vi.fn() }));
vi.mock('../src/pages/Collection/services/collectionService', () => ({ fetchPolicyInstallments: mocks.fetch }));
vi.mock('../src/lib/notify', () => ({ useNotify: () => ({ error: mocks.error }) }));
import { usePolicyInstallmentsModal } from '../src/pages/Collection/hooks/usePolicyInstallmentsModal';
const deferred = () => { let resolve!: (rows: Installment[]) => void; const promise = new Promise<Installment[]>(done => { resolve = done; }); return { promise, resolve }; };
const policy = (id: string) => ({ id, policy_number: id } as Policy);
const installment = (policy_id: string) => ({ id: policy_id, policy_id } as Installment);
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('keeps the latest policy installments when the previous read finishes late', async () => {
  const old = deferred(); const next = deferred(); mocks.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const { result } = renderHook(usePolicyInstallmentsModal);
  act(() => result.current.handleOpenPolicyDetails(policy('old')));
  act(() => result.current.handleOpenPolicyDetails(policy('new')));
  await act(async () => next.resolve([installment('new')]));
  await act(async () => old.resolve([installment('old')]));
  expect(result.current.selectedPolicy?.id).toBe('new');
  expect(result.current.policyInstallments[0].policy_id).toBe('new');
});
it('clears previous rows and exposes a retryable error if the next read fails', async () => {
  mocks.fetch.mockResolvedValueOnce([installment('old')]).mockRejectedValueOnce(new Error('network failed')).mockResolvedValueOnce([installment('new')]);
  const { result } = renderHook(usePolicyInstallmentsModal);
  await act(async () => result.current.handleOpenPolicyDetails(policy('old')));
  await act(async () => result.current.handleOpenPolicyDetails(policy('new')));
  expect(result.current.policyInstallments).toEqual([]); expect(result.current.loadError).toContain('تعذر تحميل');
  await act(async () => result.current.loadPolicyInstallments('new'));
  expect(result.current.policyInstallments[0].policy_id).toBe('new'); expect(result.current.loadError).toBeNull();
});
it('ignores reads that finish after the dialog closes', async () => {
  const pending = deferred(); mocks.fetch.mockReturnValue(pending.promise);
  const { result } = renderHook(usePolicyInstallmentsModal);
  act(() => result.current.handleOpenPolicyDetails(policy('old')));
  act(() => result.current.setShowPolicyModal(false));
  await act(async () => pending.resolve([installment('old')]));
  expect(result.current.policyInstallments).toEqual([]);
});
