import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCustomerFilters } from '../src/pages/Customers/hooks/useCustomerFilters';
import { usePolicyFilters } from '../src/pages/Policies/hooks/usePolicyFilters';
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });
for (const [name, useFilters] of [['customers', useCustomerFilters], ['policies', usePolicyFilters]] as const) {
  it(`${name}: new navigation replaces pending search and back does not resurrect a stale draft`, () => {
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[`/${name}?search=old&open=keep`]}>{children}</MemoryRouter>;
    const { result } = renderHook(() => ({ ...useFilters(), navigate: useNavigate() }), { wrapper });
    act(() => result.current.setLocalSearch('unfinished'));
    act(() => result.current.navigate(`/${name}?search=new&open=keep`));
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.localSearch).toBe('new');
    expect(result.current.searchQuery).toBe('new');
    act(() => result.current.navigate(-1));
    expect(result.current.localSearch).toBe('old');
    act(() => result.current.setLocalSearch('typed'));
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.searchQuery).toBe('typed');
    expect(result.current.searchParams.get('open')).toBe('keep');
  });
}
