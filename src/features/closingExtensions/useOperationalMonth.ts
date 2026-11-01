import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOperationalMonth } from './operationalMonthService';

const monthDate = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1);
};
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

/** Only automatic financial display periods follow an explicit company extension.
 * Historical/manual choices stay intact. Expired/unknown context never guesses. */
export function useOperationalMonth(userId: string | undefined) {
  const query = useQuery({ queryKey: ['operational-month', userId], enabled: !!userId,
    queryFn: () => fetchOperationalMonth(userId!), staleTime: 60_000,
    refetchInterval: 60_000, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always' });
  const [, tick] = useState(0);
  const refetch = query.refetch;
  useEffect(() => {
    if (!query.data) return;
    const delay = query.data.expiresAt - Date.now();
    if (delay <= 0) { void refetch({ cancelRefetch: false }); return; }
    const timer = window.setTimeout(() => { tick(value => value + 1); void refetch({ cancelRefetch: false }); }, delay + 50);
    return () => window.clearTimeout(timer);
  }, [query.data, refetch]);
  const ready = !!query.data && query.data.expiresAt > Date.now();
  const automaticKey = query.data?.reporting_month ?? monthKey(new Date());
  const [manual, setManual] = useState<{ userId: string; month: string } | null>(null);
  // Configuring an extension often starts from a manually selected prior month.
  // Once that choice becomes the operational current month, resume auto rollover.
  useEffect(() => {
    setManual(previous => previous && previous.userId === userId && previous.month === automaticKey ? null : previous);
  }, [automaticKey, userId]);
  const selectedKey = manual && manual.userId === userId ? manual.month : automaticKey;
  const selectedMonth = useMemo(() => monthDate(selectedKey), [selectedKey]);
  const automaticMonth = useMemo(() => monthDate(automaticKey), [automaticKey]);
  const setSelectedMonth = useCallback((update: SetStateAction<Date>) => {
    setManual(previous => {
      const before = previous && previous.userId === userId ? previous.month : automaticKey;
      const next = monthKey(typeof update === 'function' ? update(monthDate(before)) : update);
      return next === automaticKey ? null : { userId: userId!, month: next };
    });
  }, [automaticKey, userId]);
  return { ready, selectedMonth, selectedKey, automaticMonth, automaticKey, setSelectedMonth,
    resetMonth: () => setManual(null), isCurrentMonth: selectedKey === automaticKey,
    extendedUntil: query.data?.extended_until ?? null,
    error: !ready && query.isError ? 'تعذر تحديد شهر العمل؛ أعد المحاولة لضمان عرض الشهر الصحيح.' : null,
    loading: query.isFetching, retry: () => { void query.refetch(); } };
}
