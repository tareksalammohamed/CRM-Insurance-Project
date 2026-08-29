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

export async function subscribeToPush(userId: string): Promise<PushSubscriptionResult> {
  if (!isPushSupported()) return { status: 'unsupported' };

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') return { status: 'denied' };

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch (error) {
        if (isIosDevice() && error instanceof DOMException && error.name === 'NotAllowedError') {
          return { status: 'needs-install' };
        }
        throw error;
      }
    }

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
  } catch (error) {
    console.error('Push subscription failed:', error);
    return { status: 'error', message: 'تعذر تفعيل إشعارات الهاتف حاليًا' };
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
