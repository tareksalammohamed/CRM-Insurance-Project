import { useEffect, useMemo } from 'react';
import { createReadQueue } from '../lib/adaptiveReads';

/** A visit/account/branch owns its queue; page read lifecycles belong here; user writes never use this queue. */
export function useAdaptiveReads(context: string) {
  const queue = useMemo(() => ({ context, ...createReadQueue() }), [context]);
  useEffect(() => () => queue.cancelPending(), [queue]);
  return queue.read;
}
