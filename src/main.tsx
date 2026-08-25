import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// تسجيل Service Worker قياسي للعمل كـ PWA (Offline Cache + تحديث تلقائي)
if ('serviceWorker' in navigator) {
  const UPDATE_EVENT = 'crm:pwa-update-available';

  const announceUpdate = (registration: ServiceWorkerRegistration) => {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { registration } }));
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // اطلب فحصًا صريحًا عند فتح التطبيق؛ هذا مهم للأجهزة التي تحتفظ
        // بتبويب PWA مفتوح لفترة طويلة ولا تفحص التحديث سريعًا.
        void registration.update();

        // إذا كانت النسخة الجديدة وصلت أثناء غياب الصفحة، أعلن عنها عند الفتح.
        if (registration.waiting && navigator.serviceWorker.controller) {
          announceUpdate(registration);
        }

        // لا نفعّل النسخة الجديدة تلقائيًا؛ الإشعار داخل التطبيق هو الذي
        // يرسل SKIP_WAITING بعد ضغط المستخدم على «تحديث الآن».
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              announceUpdate(registration);
            }
          });
        });
      })
      .catch(() => {
        // فشل تسجيل الـ Service Worker لا يجب أن يوقف عمل التطبيق
      });
  });
}
