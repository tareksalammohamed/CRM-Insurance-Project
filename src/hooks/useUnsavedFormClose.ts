import { useCallback, useEffect, useRef } from 'react';
import { useNotify } from '../lib/notify';

/** Protect explicit form dismissal without intercepting a successful save. No draft data is persisted. */
export function useUnsavedFormClose({ dirty, saving, onClose }: { dirty: boolean; saving: boolean; onClose: () => void }) {
  const notify = useNotify();
  const current = useRef({ dirty, saving, onClose });
  current.current = { dirty, saving, onClose };
  const asking = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);
  return useCallback(async () => {
    if (current.current.saving || asking.current) return;
    if (!current.current.dirty) { current.current.onClose(); return; }
    asking.current = true;
    try {
      const discard = await notify.confirm({
        title: 'تعديلات لم تُحفظ',
        message: 'عند إغلاق النموذج ستفقد التعديلات التي لم تحفظها. هل تريد تجاهلها؟',
        confirmLabel: 'تجاهل التعديلات وإغلاق',
        cancelLabel: 'العودة للنموذج',
      });
      if (discard && mounted.current && !current.current.saving) current.current.onClose();
    } finally { asking.current = false; }
  }, [notify]);
}
