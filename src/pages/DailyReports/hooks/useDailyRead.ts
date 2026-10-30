import { useCallback, useEffect, useRef, useState } from 'react';
import { useRequestGuard } from '../../../hooks/useRequestGuard';

/** Publish only the requested person/branch/period, including the render before its effect runs. */
export function useDailyRead<T>(key: string, read: () => Promise<T>, errorMessage: string) {
  const guard = useRequestGuard();
  const readRef = useRef(read);
  readRef.current = read;
  const keyRef = useRef(key);
  keyRef.current = key;
  const generation = useRef(0);
  const [result, setResult] = useState<{ key: string; data?: T; loading: boolean; error: boolean }>({ key, loading: true, error: false });
  const reload = useCallback(async () => {
    const request = guard.start();
    generation.current = request;
    setResult({ key, loading: true, error: false });
    try {
      const data = await readRef.current();
      if (guard.isCurrent(request)) setResult({ key, data, loading: false, error: false });
    } catch {
      if (guard.isCurrent(request)) setResult({ key, loading: false, error: true });
    }
  }, [guard, key]);
  useEffect(() => { void reload(); return () => guard.invalidate(); }, [guard, reload]);
  const current = result.key === key;
  const ready = current && !result.loading && !result.error && result.data !== undefined;
  const capture = () => {
    const request = generation.current;
    return () => keyRef.current === key && guard.isCurrent(request);
  };
  return { data: ready ? result.data : undefined, ready, loading: !current || result.loading,
    loadError: current && result.error ? errorMessage : null, reload, capture };
}
