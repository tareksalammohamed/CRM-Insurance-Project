vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-only-key'); });
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkspaceSearch } from '../src/features/workspace/WorkspaceSearch';
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
afterEach(cleanup);
it('respects administrative/operational separation and role restrictions', () => {
  const { unmount } = render(<MemoryRouter><WorkspaceSearch role="super_admin" onClose={vi.fn()} /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: /التحصيل والسداد/ })).toBeNull();
  expect(screen.getByRole('button', { name: /إعدادات النظام/ })).toBeTruthy();
  unmount();
  render(<MemoryRouter><WorkspaceSearch role="premium_agent" onClose={vi.fn()} /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: /إعدادات النظام/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /تقارير العمل اليومية/ })).toBeNull();
});
it('finds pages by work terminology and encodes explicit data searches', () => {
  const close = vi.fn();
  render(<MemoryRouter><WorkspaceSearch role="agent" onClose={close} /><Location /></MemoryRouter>);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'أقساط' } });
  expect(screen.getByRole('button', { name: /التحصيل والسداد/ })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'طارق & محمد' } });
  fireEvent.click(screen.getByRole('button', { name: /في العملاء/ }));
  expect(screen.getByRole('status').textContent).toBe('/customers?search=' + encodeURIComponent('طارق & محمد'));
  expect(close).toHaveBeenCalledTimes(1);
});
