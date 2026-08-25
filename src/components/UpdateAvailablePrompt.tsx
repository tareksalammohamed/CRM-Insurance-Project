import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

const UPDATE_EVENT = 'crm:pwa-update-available';

type UpdateEventDetail = {
  registration?: ServiceWorkerRegistration;
};

export function UpdateAvailablePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let mounted = true;

    const showUpdate = (event?: Event) => {
      const detail = (event as CustomEvent<UpdateEventDetail> | undefined)?.detail;
      const nextRegistration = detail?.registration;

      if (!mounted) return;
      if (nextRegistration) setRegistration(nextRegistration);
      setVisible(true);
    };

    const checkWaitingWorker = async () => {
      const currentRegistration = await navigator.serviceWorker.getRegistration('/');
      if (!mounted || !currentRegistration?.waiting) return;
      setRegistration(currentRegistration);
      setVisible(true);
    };

    window.addEventListener(UPDATE_EVENT, showUpdate);
    void checkWaitingWorker();

    return () => {
      mounted = false;
      window.removeEventListener(UPDATE_EVENT, showUpdate);
    };
  }, []);

  const applyUpdate = async () => {
    setUpdating(true);

    const currentRegistration = registration ?? await navigator.serviceWorker.getRegistration('/');
    const waitingWorker = currentRegistration?.waiting;

    if (!waitingWorker) {
      setUpdating(false);
      setVisible(false);
      return;
    }

    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    waitingWorker.postMessage('SKIP_WAITING');
  };

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-4 z-[90] mx-auto max-w-xl md:left-auto md:right-6 md:mx-0 md:max-w-md"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-primary-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-secondary-900">تحديث جديد متاح</p>
              <p className="mt-1 text-sm leading-6 text-secondary-600">
                توجد نسخة أحدث من التطبيق. اضغط «تحديث الآن» لتشغيل آخر تحديث.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="rounded-lg p-1 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-700"
              aria-label="إخفاء إشعار التحديث"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={applyUpdate}
            disabled={updating}
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} aria-hidden="true" />
            {updating ? 'جارِ تطبيق التحديث...' : 'تحديث الآن'}
          </button>
        </div>
      </div>
    </div>
  );
}
