import { useEffect, useRef } from 'react';

/** Only the newest request may publish results, including after unmount. */
export function useRequestGuard() {
  const generation = useRef(0);
  const guard = useRef({
    start: () => ++generation.current,
    isCurrent: (request: number) => request === generation.current,
    invalidate: () => { generation.current += 1; },
  }).current;
  useEffect(() => () => guard.invalidate(), [guard]);
  return guard;
}
