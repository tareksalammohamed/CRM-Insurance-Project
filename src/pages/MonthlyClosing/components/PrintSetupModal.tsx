import { Printer, ImageDown, Loader2 } from 'lucide-react';
import type { Branch } from '../../../features/branches/types';
import { DialogPortal } from '../../../components/ui/DialogPortal';
import { useDialogBehavior } from '../../../hooks/useDialogBehavior';

interface PrintSetupModalProps {
  branchName: string;
  setBranchName: (name: string) => void;
  printBranches: Branch[];
  printClosingDate: string;
  setPrintClosingDate: (date: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  /** حفظ نفس التقرير كصور PNG بدل الطباعة (اختيارى) */
  onSaveImage?: () => void;
  savingImage?: boolean;
}

// مودال إدخال اسم الفرع وتاريخ التقفيل قبل الطباعة
export function PrintSetupModal({
  branchName,
  setBranchName,
  printBranches,
  printClosingDate,
  setPrintClosingDate,
  onClose,
  onConfirm,
  onSaveImage,
  savingImage = false,
}: PrintSetupModalProps) {

  // Escape للإغلاق + قفل تمرير الخلفية + إرجاع التركيز للعنصر المُستدعى
  useDialogBehavior(savingImage ? undefined : onClose);

  const disabled = !branchName.trim() || !printClosingDate || savingImage;

  return (
    /*
     * DialogPortal ضرورى هنا: صفحة إقفال الشهر جذرها <div class="space-y-6
     * animate-fadeIn">، والأنيميشن ده بيستخدم transform مع fill-mode: both —
     * يعنى الـtransform فاضل مطبَّق على العنصر للأبد بعد انتهاء الأنيميشن.
     * أى عنصر بـposition: fixed جوه أب بيحمل transform بيتموضع بالنسبة للأب
     * (containing block) مش بالنسبة للشاشة. وصفحة الإقفال طويلة جدًا (جداول
     * كل الوكلاء)، فالـoverlay كان بيتمدد على طول الصفحة كلها والمحتوى
     * بيتمركز فى نصها → زرار "طباعة" و"إلغاء" يظهروا تحت أوى خارج الشاشة.
     *
     * الرندر داخل document.body بيخرج المودال من الحاوية المتحركة فيتموضع
     * بالنسبة للشاشة دائمًا، وده نفس النمط المستخدم فى ConfirmActionModal
     * وباقى نوافذ التطبيق.
     */
    <DialogPortal>
      <div className="modal-overlay print-setup-modal" onClick={savingImage ? undefined : onClose}>
        <div
          className="modal-content print-setup-content max-w-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4 text-center">بيانات التقرير المطبوع</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">اسم الفرع</label>
                <select
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="input-field w-full"
                  autoFocus
                >
                  <option value="" disabled>اختر الفرع...</option>
                  {printBranches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">تاريخ التقفيل</label>
                <input
                  type="date"
                  value={printClosingDate}
                  onChange={(e) => setPrintClosingDate(e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              <button onClick={onClose} disabled={savingImage} className="btn btn-secondary">إلغاء</button>
              <button
                onClick={onConfirm}
                disabled={disabled}
                className="btn btn-primary"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة</span>
              </button>
              {onSaveImage && (
                <button
                  onClick={onSaveImage}
                  disabled={disabled}
                  className="btn btn-success disabled:opacity-70"
                >
                  {savingImage
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ImageDown className="w-4 h-4" />}
                  <span>{savingImage ? 'جارٍ الحفظ...' : 'حفظ كصورة'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
