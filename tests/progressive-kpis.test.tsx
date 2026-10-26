import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardKPIs } from '../src/pages/Dashboard/components/DashboardKPIs';
import type { CancellationSummary } from '../src/pages/Cancellations/types';
afterEach(cleanup);
it('distinguishes unloaded cancellation indicators from a genuinely zero result', () => {
  const { rerender } = render(<MemoryRouter><DashboardKPIs stats={null} selectedMonth={new Date()} cancellationSummary={null} cancellationLoading /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'عرض صفحة الإلغاءات' }).textContent).toContain('—');
  expect(screen.getAllByText('جاري تحميل الإلغاءات...')).toHaveLength(2);
  rerender(<MemoryRouter><DashboardKPIs stats={null} selectedMonth={new Date()} cancellationSummary={{ cancellationRate: 0, cancelledValue: 0 } as CancellationSummary} /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'عرض صفحة الإلغاءات' }).textContent).toContain('0%');
});
