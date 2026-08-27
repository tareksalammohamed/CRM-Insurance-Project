import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotify } from '../lib/notify';
import { isPushSupported, subscribeToPush } from '../lib/pushNotifications';

const DISMISS_KEY = 'crm-push-prompt-dismissed';

export function PushNotificationPrompt() {
  const { user } = useAuth();
  const notify = useNotify();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !isPushSupported() || Notification.permission !== 'default') {
      setVisible(false);
      return;
    }

    setVisible(sessionStorage.getItem(DISMISS_KEY) !== '1');
  }, [user]);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const enable = async () => {
    if (!user || saving) return;
    setSaving(true);
    const result = await subscribeToPush(user.id);
    setSaving(false);

    if (result.status === 'subscribed') {
      notify.success('تم تفعيل إشعارات الهاتف لهذا الجهاز');
      setVisible(false);
      return;
    }

    if (result.status === 'needs-install') {
      notify.error('على iPhone ثبّت التطبيق على الشاشة الرئيسية أولًا ثم فعّل الإشعارات');
      return;
    }

    if (result.status === 'denied') {
      notify.error('تم رفض الإشعارات. يمكنك السماح بها من إعدادات المتصفح');
      setVisible(false);
      return;
    }

    notify.error(result.status === 'error' ? result.message : 'هذا المتصفح لا يدعم إشعارات الهاتف');
  };

  return (
    <aside className="push-prompt fixed bottom-24 left-3 right-3 z-40 md:bottom-6 md:left-auto md:right-6 md:w-[23rem] rounded-2xl border border-primary-100 bg-white p-4 shadow-elevated" aria-live="polite">
      <button
        type="button"
        className="absolute left-2 top-2 icon-button !min-h-9 !min-w-9"
        onClick={dismiss}
        aria-label="إغلاق تنبيه الإشعارات"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pl-7">
        <span className="push-prompt-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-extrabold text-secondary-900">فعّل إشعارات الهاتف</p>
          <p className="mt-1 text-xs leading-6 text-secondary-500">اعرف الإشعارات المهمة حتى لو التطبيق مغلق.</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="btn btn-primary flex-1" onClick={enable} disabled={saving}>
          {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <CheckCircle2 className="h-4 w-4" />}
          {saving ? 'جارٍ التفعيل...' : 'تفعيل الإشعارات'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={dismiss}>لاحقًا</button>
      </div>
    </aside>
  );
}
