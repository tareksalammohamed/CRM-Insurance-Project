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
  let isReloadingForWorker = false;

  // بعد تفعيل نسخة جديدة، أعد تحميل الصفحة مرة واحدة حتى لا تستمر جلسة
  // الـPWA الحالية في تشغيل JavaScript القديم من الذاكرة.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloadingForWorker) return;
    isReloadingForWorker = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // اطلب فحصًا صريحًا عند فتح التطبيق؛ هذا مهم للأجهزة التي تحتفظ
        // بتبويب PWA مفتوح لفترة طويلة ولا تفحص التحديث سريعًا.
        void registration.update();

        // التحقق من وجود تحديث جديد وتفعيله تلقائيًا فور توفره
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch(() => {
        // فشل تسجيل الـ Service Worker لا يجب أن يوقف عمل التطبيق
      });
  });
}
