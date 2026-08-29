import { supabase } from './supabase';

const DEFAULT_PUBLIC_KEY = 'BOR2AYSVatpPoGWAv8Grh0p79LT5tlUZGf16n4FC9FCtiA70HozaLxz0WOzKZu92oLrZImWZ3zRqYPwxUFvo5jA';
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined)?.trim() || DEFAULT_PUBLIC_KEY;

export type PushSubscriptionResult =
  | { status: 'subscribed' }
  | { status: 'unsupported' }
  | { status: 'denied' }
  | { status: 'needs-install' }
  | { status: 'error'; message: string };

// `applicationServerKey` لازم يكون `BufferSource` مدعوم بـ ArrayBuffer حقيقي
// (مش SharedArrayBuffer)، فبنبني الـ ArrayBuffer صراحةً بالحجم المطلوب وبنكتب
// فيه البايتات — نفس النتيجة الثنائية بالظبط، مع نوع صحيح بدون أي تأكيد نوع
// غير آمن.
function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let index = 0; index < rawData.length; index += 1) {
    bytes[index] = rawData.charCodeAt(index);
  }
  return bytes;
}

function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// ============================================================================
// فحص أن اشتراك المتصفح الحالي مربوط بنفس مفتاح VAPID الذى يوقّع به الخادم.
// لو المفتاح اختلف (تغيير مفاتيح / اشتراك قديم) فإرسال الخادم يُرفض بـ 403
// بصمت للأبد — لذلك نكتشف عدم التطابق ونعيد الاشتراك بالمفتاح الصحيح.
// ============================================================================
function subscriptionKeyMatches(subscription: PushSubscription): boolean {
  const currentKey = subscription.options?.applicationServerKey;
  // بعض المتصفحات القديمة لا تكشف المفتاح — لا نعيد الاشتراك بلا داعٍ
  if (!currentKey) return true;
  const existing = new Uint8Array(currentKey);
  const expected = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  if (existing.length !== expected.length) return false;
  for (let index = 0; index < existing.length; index += 1) {
    if (existing[index] !== expected[index]) return false;
  }
  return true;
}

// يرجع اشتراك متصفح صالح: يعيد استخدام الموجود لو مفتاحه صحيح، وإلا يلغيه
// وينشئ اشتراكًا جديدًا بالمفتاح الحالي.
async function ensureBrowserSubscription(registration: ServiceWorkerRegistration): Promise<PushSubscription> {
  let subscription = await registration.pushManager.getSubscription();

  if (subscription && !subscriptionKeyMatches(subscription)) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  return subscription;
}

// حفظ/تحديث الاشتراك فى قاعدة البيانات للمستخدم الحالي (upsert على endpoint)
async function saveSubscription(userId: string, subscription: PushSubscription): Promise<PushSubscriptionResult> {
  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return { status: 'error', message: 'بيانات اشتراك الجهاز غير مكتملة' };
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    expiration_time: subscription.expirationTime,
    user_agent: navigator.userAgent.slice(0, 500),
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  if (error) throw error;
  return { status: 'subscribed' };
}

export async function subscribeToPush(userId: string): Promise<PushSubscriptionResult> {
  if (!isPushSupported()) return { status: 'unsupported' };

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') return { status: 'denied' };

    const registration = await navigator.serviceWorker.ready;

    let subscription: PushSubscription;
    try {
      subscription = await ensureBrowserSubscription(registration);
    } catch (error) {
      if (isIosDevice() && error instanceof DOMException && error.name === 'NotAllowedError') {
        return { status: 'needs-install' };
      }
      throw error;
    }

    return await saveSubscription(userId, subscription);
  } catch (error) {
    console.error('Push subscription failed:', error);
    return { status: 'error', message: 'تعذر تفعيل إشعارات الهاتف حاليًا' };
  }
}

// ============================================================================
// مزامنة صامتة عند فتح التطبيق والإذن ممنوح بالفعل:
// - تعيد حفظ الاشتراك فى قاعدة البيانات لو صفّه اتحذف (endpoint منتهي اتنظّف،
//   أو جهاز مشترك اتسجّل عليه مستخدم آخر) — بدون أى Prompt أو إزعاج.
// - تصلح تلقائيًا الاشتراكات القديمة الموقّعة بمفتاح VAPID مختلف.
// - تحدّث last_seen_at حتى يعرف الخادم أن الجهاز ما زال نشطًا.
// بدون هذه المزامنة يظل الإذن «ممنوحًا» ظاهريًا بينما الدفع ميت بصمت.
// ============================================================================
export async function syncPushSubscription(userId: string): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await ensureBrowserSubscription(registration);
    await saveSubscription(userId, subscription);
  } catch (error) {
    // مزامنة تحسينية فى الخلفية — فشلها لا يجب أن يظهر للمستخدم أو يوقف شيئًا
    console.warn('Push subscription sync skipped:', error);
  }
}

export async function removePushSubscription(userId: string): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await supabase.from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}
