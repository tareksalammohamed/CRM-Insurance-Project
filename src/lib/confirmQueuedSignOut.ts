import { getQueueItems } from './offlineQueue';
import type { NotifyConfirmOptions } from './notify';

export async function confirmQueuedSignOut(userId: string, confirm: (options: NotifyConfirmOptions) => Promise<boolean>): Promise<boolean> {
  const items = (await getQueueItems()).filter(item => item.userId === userId);
  if (!items.length) return true;
  const failed = items.filter(item => item.lastError).length;
  return confirm({
    title: 'عمليات لم تكتمل مزامنتها',
    message: `يوجد ${items.length} عملية محفوظة على هذا الجهاز لم تُؤكَّد مزامنتها مع الخادم${failed ? `، منها ${failed} عملية واجهت خطأ في آخر محاولة` : ''}.`,
    warning: 'تسجيل الخروج يحذف هذه العمليات المحلية لحماية بيانات الحساب. ابقَ في التطبيق واتصل بالإنترنت حتى تتأكد من المزامنة، أو أكّد الخروج وحذفها.',
    confirmLabel: 'خروج وحذف العمليات المحلية',
    cancelLabel: 'البقاء ومتابعة المزامنة',
  });
}
