/**
 * يهرب النص قبل إدخاله في HTML يتم إنشاؤه كنص (مثل نافذة الطباعة).
 * لا يُستخدم لعرض React العادي؛ React يهرب النصوص تلقائياً.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
