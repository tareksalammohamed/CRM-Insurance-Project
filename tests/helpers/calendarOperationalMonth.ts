import { useMemo, useState } from 'react';
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
export function useOperationalMonth() {
  const automaticMonth = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1), []);
  const [selectedMonth, setSelectedMonth] = useState(automaticMonth);
  return { ready: true, selectedMonth, setSelectedMonth, selectedKey: key(selectedMonth), automaticMonth,
    automaticKey: key(automaticMonth), resetMonth: () => setSelectedMonth(automaticMonth),
    isCurrentMonth: key(selectedMonth) === key(automaticMonth), extendedUntil: null, error: null, loading: false, retry: () => {} };
}
