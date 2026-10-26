export type AdaptiveRead = <T>(task: () => Promise<T>, priority?: number, valid?: () => boolean) => Promise<T>;
const timings: { at: number; ms: number }[] = [];

/** Hints are optional; observed task latency provides a conservative fallback. */
export function readConcurrency(): number {
  const connection = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean; downlink?: number; rtt?: number };
  }).connection;
  if (connection?.saveData || ['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '') ||
      (connection?.rtt ?? 0) >= 400 || ((connection?.downlink ?? 0) > 0 && connection!.downlink! < 1)) return 1;
  const recent = timings.filter(row => Date.now() - row.at < 120000).map(row => row.ms).sort((a, b) => a - b);
  if (recent.length >= 2 && recent[Math.floor(recent.length / 2)] >= 1500) return 1;
  return connection?.effectiveType === '4g' ? 4 : 2;
}

export function createReadQueue(limit: () => number = readConcurrency) {
  let active = 0;
  let scheduled = false;
  type Job = { priority: number; start: () => void; cancel: () => void; valid?: () => boolean };
  const jobs: Job[] = [];
  const cancelled = () => Object.assign(new Error('تم إلغاء قراءة قديمة'), { name: 'AbortError' });
  const pump = () => {
    scheduled = false;
    jobs.sort((a, b) => a.priority - b.priority);
    while (jobs.length && active < Math.max(1, limit())) {
      const job = jobs.shift()!;
      if (job.valid && !job.valid()) { job.cancel(); continue; }
      active += 1; job.start();
    }
  };
  const schedule = () => { if (!scheduled) { scheduled = true; queueMicrotask(pump); } };
  const read: AdaptiveRead = (task, priority = 1, valid) => new Promise((resolve, reject) => {
    jobs.push({ priority, valid, cancel: () => reject(cancelled()), start: () => {
      const start = performance.now();
      Promise.resolve().then(task).then(resolve, reject).finally(() => {
        timings.push({ at: Date.now(), ms: performance.now() - start });
        if (timings.length > 6) timings.shift();
        active -= 1; schedule();
      });
    } });
    schedule();
  });
  return { read, cancelPending: () => { for (const job of jobs.splice(0)) job.cancel(); } };
}

export const directRead: AdaptiveRead = task => task();

export const isAbortedRead = (error: unknown) => error instanceof Error && error.name === 'AbortError';
