import { useCallback, useEffect, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

/** URL changes (including header navigation/back) supersede a pending local draft. */
export function useDebouncedUrlSearch(searchQuery: string, setSearchParams: SetURLSearchParams, onApplied: () => void) {
  const [draft, setDraft] = useState({ source: searchQuery, value: searchQuery });
  useEffect(() => { setDraft({ source: searchQuery, value: searchQuery }); }, [searchQuery]);
  const localSearch = draft.source === searchQuery ? draft.value : searchQuery;
  const setLocalSearch = useCallback((value: string) => setDraft({ source: searchQuery, value }), [searchQuery]);
  useEffect(() => {
    if (localSearch === searchQuery) return;
    const timer = setTimeout(() => {
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        if (localSearch) next.set('search', localSearch); else next.delete('search');
        return next;
      }, { replace: true });
      onApplied();
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, setSearchParams, onApplied]);
  return { localSearch, setLocalSearch };
}
