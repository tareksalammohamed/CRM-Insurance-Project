vi.hoisted(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test'); });
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PoliciesFilters } from '../src/pages/Policies/components/PoliciesFilters';
import { CustomerFilters } from '../src/pages/Customers/components/CustomerFilters';
import { CollectionFilters } from '../src/pages/Collection/components/CollectionFilters';
import { PeriodControls } from '../src/pages/DailyReports/components/PeriodControls';
afterEach(cleanup);
it('keeps policy choices as drafts until the existing Apply button is used', () => {
  const status = vi.fn(); const type = vi.fn(); const month = vi.fn(); const apply = vi.fn(); const reset = vi.fn();
  render(<PoliciesFilters statusDraft="all" onStatusDraftChange={status} typeDraft="all" onTypeDraftChange={type} monthDraft="all" onMonthDraftChange={month} monthOptions={[{ value: '2026-10', label: 'أكتوبر 2026' }]} onApply={apply} onReset={reset} />);
  fireEvent.click(screen.getByRole('button', { name: 'حالة الوثيقة: جميع الحالات' }));
  fireEvent.click(screen.getByRole('button', { name: 'ملغى' }));
  fireEvent.click(screen.getByRole('button', { name: 'نوع الوثيقة: جميع الأنواع' }));
  fireEvent.click(screen.getByRole('button', { name: 'معاش واطمئنان' }));
  fireEvent.click(screen.getByRole('button', { name: 'الشهر: كل الشهور' }));
  fireEvent.click(screen.getByRole('button', { name: 'أكتوبر 2026' }));
  expect(status).toHaveBeenCalledExactlyOnceWith('cancelled'); expect(type).toHaveBeenCalledExactlyOnceWith('pension_peace'); expect(month).toHaveBeenCalledExactlyOnceWith('2026-10');
  expect(apply).not.toHaveBeenCalled(); expect(reset).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'تطبيق' })); expect(apply).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'إعادة تعيين' })); expect(reset).toHaveBeenCalledOnce();
});
it('preserves the expired customer status and draft semantics', () => {
  const status = vi.fn(); const apply = vi.fn();
  render(<CustomerFilters statusDraft="all" onStatusDraftChange={status} agentDraft="all" onAgentDraftChange={vi.fn()} monthDraft="all" onMonthDraftChange={vi.fn()} monthOptions={[]} isManagerRole={false} agents={[]} user={null} onApply={apply} onReset={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'حالة العميل: جميع الحالات' }));
  fireEvent.click(screen.getByRole('button', { name: 'طلبات تالفة (60 يومًا بدون وثائق)' }));
  expect(status).toHaveBeenCalledExactlyOnceWith('expired'); expect(apply).not.toHaveBeenCalled();
});
it('preserves first-year collection subtype values without applying a draft', () => {
  const subtype = vi.fn(); const apply = vi.fn();
  render(<CollectionFilters quickFilter="month" onQuickFilterSelect={vi.fn()} showFilters quickFilterDraft="month" onQuickFilterDraftChange={vi.fn()} subTypeDraft="all" onSubTypeDraftChange={subtype} teamMembers={[]} ownerFilterDraft="all" onOwnerFilterDraftChange={vi.fn()} currentUserId="u" onResetFilters={vi.fn()} onApplyFilters={apply} isInitialLoading={false} totalCount={12} loading={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'نوع التحصيل: الكل (إنتاج جديد + تحصيل دوري)' }));
  fireEvent.click(screen.getByRole('button', { name: 'تحصيل دوري فقط' }));
  expect(subtype).toHaveBeenCalledExactlyOnceWith('periodic'); expect(apply).not.toHaveBeenCalled();
});
it('changes daily period through the existing callback without changing the explicit dates', () => {
  const change = vi.fn(); const range = vi.fn();
  render(<PeriodControls periodType="day" onPeriodTypeChange={change} start={new Date('2026-10-01T00:00:00')} end={new Date('2026-10-30T00:00:00')} onRangeChange={range} />);
  fireEvent.click(screen.getByRole('button', { name: /نوع الفترة:/ }));
  fireEvent.click(screen.getByRole('button', { name: 'شهر' }));
  expect(change).toHaveBeenCalledExactlyOnceWith('month'); expect(range).not.toHaveBeenCalled();
  expect((screen.getByLabelText('من') as HTMLInputElement).value).toBe('2026-10-01');
  expect((screen.getByLabelText('إلى') as HTMLInputElement).value).toBe('2026-10-30');
});
