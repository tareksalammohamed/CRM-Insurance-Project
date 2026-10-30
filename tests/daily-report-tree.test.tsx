import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StatsTreeView } from '../src/pages/DailyReports/components/StatsTreeView';
import { StatsSummaryCard } from '../src/pages/DailyReports/components/StatsSummaryCard';
import { EMPTY_STATS_AGGREGATE, type StatsTreeNode } from '../src/pages/DailyReports/types';
vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
const aggregate = { ...EMPTY_STATS_AGGREGATE, entriesCount: 3, callsActual: 42 };
const leaf: StatsTreeNode = { userId: 'agent', name: 'أحمد محمد', role: 'agent', roleLabel: 'وكيل', roleLevel: 1, own: aggregate, subtree: aggregate, ownEntries: [], children: [] };
const root: StatsTreeNode = { ...leaf, userId: 'leader', name: 'طارق سلام', role: 'group_leader', roleLabel: 'رئيس مجموعة', own: null, children: [leaf] };
afterEach(cleanup);
it('finds a descendant directly while retaining original full-scope nodes and aggregates', () => {
  const select = vi.fn(); const original = JSON.stringify(root);
  render(<StatsTreeView nodes={[root]} selectedId={null} onSelect={select} />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'أحمد' } });
  const results = screen.getByRole('region', { name: 'أفراد الفريق' });
  fireEvent.click(within(results).getByRole('button', { name: /أحمد محمد وكيل طارق سلام/ }));
  expect(select).toHaveBeenCalledExactlyOnceWith(leaf); expect(select.mock.calls[0][0]).toBe(leaf);
  expect(JSON.stringify(root)).toBe(original);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'رئيس مجموعة' } });
  fireEvent.click(within(results).getByRole('button', { name: /طارق سلام رئيس مجموعة/ }));
  expect(select.mock.calls[1][0]).toBe(root); expect(root.children).toHaveLength(1);
});
it('distinguishes no matching search from an empty team and preserves expanded rows after clearing', () => {
  render(<StatsTreeView nodes={[root]} selectedId={null} onSelect={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'طي فريق طارق سلام' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'MISSING' } });
  expect(screen.getByText('لا يوجد اسم أو وظيفة مطابقة للبحث')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'مسح البحث' }));
  expect(screen.getByRole('button', { name: 'توسيع فريق طارق سلام' }).getAttribute('aria-expanded')).toBe('false');
});
it('describes aggregate counts as daily reports and quality counts as reports', () => {
  render(<StatsSummaryCard aggregate={aggregate} />);
  expect(screen.getByText('3 تقرير يومي مسجل')).toBeTruthy();
  expect(screen.getByText('عدد التقارير اليومية لكل تقييم')).toBeTruthy();
  expect(screen.queryByText('3 يومًا مسجلًا')).toBeNull();
});
