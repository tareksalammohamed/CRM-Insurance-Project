import { LoadNotice } from '../../components/feedback/LoadNotice';
import type { useOperationalMonth } from './useOperationalMonth';

export function OperationalMonthNotice({ period }: { period: ReturnType<typeof useOperationalMonth> }) {
  if (period.error) return <LoadNotice message={period.error} loading={period.loading} onRetry={period.retry} />;
  if (!period.ready) return <p role="status" className="card text-sm text-secondary-500">جارٍ تحديد شهر العمل…</p>;
  return null;
}

export function OperationalMonthHint({ period }: { period: ReturnType<typeof useOperationalMonth> }) {
  if (!period.ready || !period.extendedUntil || !period.isCurrentMonth) return null;
  const month = period.automaticMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  const until = new Date(`${period.extendedUntil}T12:00:00`).toLocaleDateString('ar-EG');
  return <p className="text-xs font-semibold text-primary-700" role="status">شهر العمل: {month} · الإقفال ممتد حتى نهاية {until}</p>;
}
