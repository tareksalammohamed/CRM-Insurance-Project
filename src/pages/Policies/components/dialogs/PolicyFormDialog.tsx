import { useRef } from 'react';
import clsx from 'clsx';
import { X, ChevronDown, Phone, AlertCircle, FileText, Wallet, StickyNote } from 'lucide-react';
import type { UseFormRegister, UseFormHandleSubmit, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { POLICY_TYPE_LABELS, PAYMENT_METHOD_LABELS, type Policy } from '../../../../lib/supabase';
import type { PolicyFormData } from '../../types';
import type { CustomerPickerItem } from '../../services/policiesService';
import { ExtractPolicyDataButton } from '../../../../features/policyDocumentExtraction/components/ExtractPolicyDataButton';

interface PolicyFormDialogProps {
  editingPolicy: Policy | null;
  presetCustomerId: string | null;
  selectedCustomer: CustomerPickerItem | null;
  // لما تبقى true: مبلغ التأمين وطريقة السداد اترصدوا تلقائياً من بيانات
  // "طلب التأمين" المسجلة مع العميل المختار، فيتقفلوا للعرض فقط (راجع
  // usePolicyActions.customerDefaultsLocked)
  customerDefaultsLocked?: boolean;
  onOpenCustomerPicker: () => void;
  register: UseFormRegister<PolicyFormData>;
  handleSubmit: UseFormHandleSubmit<PolicyFormData>;
  onSubmit: (data: PolicyFormData) => void | Promise<void>;
  errors: FieldErrors<PolicyFormData>;
  setValue: UseFormSetValue<PolicyFormData>;
  saving: boolean;
  onClose: () => void;
}

// نفس مودال "إصدار/تعديل وثيقة" الموجود فى index.tsx الأصلي بالضبط — مودال
// واحد مشترك للإصدار والتعديل (العنوان ونص الزر فقط هما اللي بيتغيروا حسب
// editingPolicy)، بدون أي تغيير فى الحقول أو الـ Validation. الإضافة
// الوحيدة هى زر "استخراج بيانات الوثيقة بالذكاء الاصطناعي" أعلى النموذج،
// ويظهر فقط عند إصدار وثيقة جديدة (مش عند التعديل).
export function PolicyFormDialog({
  editingPolicy,
  presetCustomerId,
  selectedCustomer,
  customerDefaultsLocked,
  onOpenCustomerPicker,
  register,
  handleSubmit,
  onSubmit,
  errors,
  setValue,
  saving,
  onClose,
}: PolicyFormDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-form-shell max-w-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-form-header flex items-center justify-between gap-3 p-4 md:p-5 border-b border-secondary-200">
          <div className="min-w-0">
            <h3 className="text-[15px] md:text-base font-extrabold text-secondary-900 tracking-tight">
              {editingPolicy ? 'تعديل الوثيقة' : 'إصدار وثيقة جديدة'}
            </h3>
            <p className="text-[11px] font-semibold text-secondary-400 mt-0.5">
              الحقول المعلَّمة بـ * مطلوبة
            </p>
          </div>
          <button onClick={onClose} className="icon-button shrink-0" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="modal-form-scroll p-4 md:p-5 space-y-4">
          {!editingPolicy && <ExtractPolicyDataButton formRef={formRef} setValue={setValue} />}

          {/* ===== مجموعة: هوية الوثيقة ===== */}
          <div className="form-section">
            <div className="form-section-head">
              <p className="form-section-title">
                <FileText />
                هوية الوثيقة
              </p>
              <p className="form-section-note">رقم الوثيقة والعميل التابعة له ونوعها وتاريخ بدايتها</p>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="input-label" htmlFor="pf-number">رقم الوثيقة *</label>
                <input
                  id="pf-number"
                  {...register('policy_number')}
                  dir="ltr"
                  aria-invalid={!!errors.policy_number}
                  className={clsx('input-field font-mono', errors.policy_number && 'border-error-500')}
                  placeholder="أدخل رقم الوثيقة"
                />
                {errors.policy_number && (
                  <p className="input-error" role="alert">
                    <AlertCircle />
                    {errors.policy_number.message}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="input-label">العميل *</label>
                <input type="hidden" {...register('customer_id')} />
                <button
                  type="button"
                  disabled={!!presetCustomerId}
                  onClick={onOpenCustomerPicker}
                  aria-invalid={!!errors.customer_id}
                  className={clsx(
                    'input-field flex items-center justify-between gap-2 text-right',
                    errors.customer_id && 'border-error-500',
                    presetCustomerId && 'bg-secondary-50 text-secondary-600 cursor-not-allowed'
                  )}
                >
                  {selectedCustomer ? (
                    <span className="min-w-0 flex-1 flex flex-col items-start">
                      <span className="truncate font-bold text-secondary-900 text-[13px]">
                        {selectedCustomer.name}
                      </span>
                      {selectedCustomer.phone && (
                        <span className="text-[11px] font-semibold text-secondary-500 flex items-center gap-1" dir="ltr">
                          <Phone className="w-3 h-3" />
                          {selectedCustomer.phone}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-secondary-400">اختر العميل</span>
                  )}
                  {!presetCustomerId && (
                    <ChevronDown className="w-4 h-4 text-secondary-400 shrink-0" />
                  )}
                </button>
                {presetCustomerId && (
                  <span className="input-hint">
                    تم تحديد العميل من صفحة العملاء — الوثيقة ستكون تابعة لنفس وكيله تلقائياً
                  </span>
                )}
                {errors.customer_id && (
                  <p className="input-error" role="alert">
                    <AlertCircle />
                    {errors.customer_id.message}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="pf-type">نوع الوثيقة *</label>
                <select id="pf-type" {...register('policy_type')} className="input-field">
                  {Object.entries(POLICY_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="pf-start">تاريخ البداية *</label>
                <input
                  id="pf-start"
                  {...register('start_date')}
                  type="date"
                  aria-invalid={!!errors.start_date}
                  className={clsx('input-field', errors.start_date && 'border-error-500')}
                />
                {errors.start_date && (
                  <p className="input-error" role="alert">
                    <AlertCircle />
                    {errors.start_date.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ===== مجموعة: القيم المالية ===== */}
          <div className="form-section">
            <div className="form-section-head">
              <p className="form-section-title">
                <Wallet />
                القيم المالية
              </p>
              <p className="form-section-note">القسط الصافي ومبلغ التأمين وطريقة السداد</p>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="input-label" htmlFor="pf-paymethod">طريقة السداد *</label>
                {customerDefaultsLocked ? (
                  <>
                    <input type="hidden" {...register('payment_method')} />
                    <div className="input-field bg-secondary-50 text-secondary-600 cursor-not-allowed">
                      {PAYMENT_METHOD_LABELS[selectedCustomer!.payment_method as keyof typeof PAYMENT_METHOD_LABELS]}
                    </div>
                    <span className="input-hint">تم تعبئتها تلقائياً من بيانات طلب التأمين الخاصة بالعميل</span>
                  </>
                ) : (
                  <select id="pf-paymethod" {...register('payment_method')} className="input-field">
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="pf-premium">قيمة القسط الصافي *</label>
                <div className="relative">
                  <input
                    id="pf-premium"
                    {...register('premium_amount', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    aria-invalid={!!errors.premium_amount}
                    className={clsx('input-field pl-14', errors.premium_amount && 'border-error-500')}
                    placeholder="أدخل قيمة القسط الصافي"
                  />
                  <span className="input-suffix">جنيه</span>
                </div>
                {errors.premium_amount && (
                  <p className="input-error" role="alert">
                    <AlertCircle />
                    {errors.premium_amount.message}
                  </p>
                )}
              </div>

              <div className="form-group form-col-full">
                <label className="input-label" htmlFor="pf-sum">
                  مبلغ التأمين {!editingPolicy && '*'}
                </label>
                {customerDefaultsLocked ? (
                  <>
                    <input type="hidden" {...register('sum_assured', { valueAsNumber: true })} />
                    <div className="relative">
                      <div className="input-field pl-14 bg-secondary-50 text-secondary-600 cursor-not-allowed">
                        {selectedCustomer!.insurance_amount}
                      </div>
                      <span className="input-suffix">جنيه</span>
                    </div>
                    <span className="input-hint">تم تعبئته تلقائياً من بيانات طلب التأمين الخاصة بالعميل</span>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <input
                        id="pf-sum"
                        {...register('sum_assured', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        inputMode="numeric"
                        aria-invalid={!!errors.sum_assured}
                        className={clsx('input-field pl-14', errors.sum_assured && 'border-error-500')}
                        placeholder="أدخل مبلغ التأمين"
                      />
                      <span className="input-suffix">جنيه</span>
                    </div>
                    {errors.sum_assured && (
                      <p className="input-error" role="alert">
                        <AlertCircle />
                        {errors.sum_assured.message}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ===== مجموعة: ملاحظات ===== */}
          <div className="form-section">
            <div className="form-section-head">
              <p className="form-section-title">
                <StickyNote />
                ملاحظات
              </p>
            </div>
            <div className="form-group">
              <label className="input-label sr-only" htmlFor="pf-notes">ملاحظات</label>
              <textarea
                id="pf-notes"
                {...register('notes')}
                className="input-field min-h-[80px] resize-none"
                placeholder="أدخل ملاحظات (اختياري)"
              />
            </div>
          </div>

          <div className="modal-actions flex justify-end gap-2.5 pt-3.5 border-t border-secondary-200">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              إلغاء
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'جاري الحفظ…' : editingPolicy ? 'حفظ التعديلات' : 'إصدار الوثيقة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
