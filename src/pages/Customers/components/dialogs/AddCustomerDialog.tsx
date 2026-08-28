import { useRef } from 'react';
import clsx from 'clsx';
import { X, User as UserIcon, Phone, MapPin, AlertCircle, ShieldCheck, UserCog } from 'lucide-react';
import type { UseFormRegister, UseFormHandleSubmit, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { MARITAL_STATUS_LABELS, PAYMENT_METHOD_LABELS, type User } from '../../../../lib/supabase';
import type { CustomerFormData, CustomerWithRelations } from '../../types';
import { AgentCombobox } from '../AgentCombobox';
import { ExtractDataButton } from '../../../../features/customerDataExtraction/components/ExtractDataButton';
import { useDialogBehavior } from '../../../../hooks/useDialogBehavior';

interface CustomerFormDialogProps {
  editingCustomer: CustomerWithRelations | null;
  isManagerRole: boolean;
  agents: any[];
  user: User | null | undefined;
  register: UseFormRegister<CustomerFormData>;
  handleSubmit: UseFormHandleSubmit<CustomerFormData>;
  onSubmit: (data: CustomerFormData) => void | Promise<void>;
  errors: FieldErrors<CustomerFormData>;
  ownerIdValue: string | undefined;
  setValue: UseFormSetValue<CustomerFormData>;
  saving: boolean;
  onClose: () => void;
}

// نفس مودال "إضافة/تعديل عميل" الموجود فى index.tsx الأصلي بالضبط — الصفحة
// الأصلية تستخدم مودال واحد مشترك للإضافة والتعديل (العنوان ونص الزر فقط هما
// اللي بيتغيروا حسب editingCustomer)، فمكوّن EditCustomerDialog يعيد
// استخدام نفس هذا المكوّن بدل تكرار نفس الفورم فى ملفين منفصلين.
export function CustomerFormDialog({
  editingCustomer,
  isManagerRole,
  agents,
  user,
  register,
  handleSubmit,
  onSubmit,
  errors,
  ownerIdValue,
  setValue,
  saving,
  onClose,
}: CustomerFormDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);


  // Escape للإغلاق + قفل تمرير الخلفية + إرجاع التركيز للعنصر المُستدعى
  useDialogBehavior(onClose);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-form-shell animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-form-header flex items-center justify-between gap-3 p-4 md:p-5 border-b border-secondary-200">
          <div className="min-w-0">
            <h3 className="text-[15px] md:text-base font-extrabold text-secondary-900 tracking-tight">
              {editingCustomer ? 'تعديل العميل' : 'إضافة عميل جديد'}
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
          {!editingCustomer && <ExtractDataButton formRef={formRef} setValue={setValue} />}

          {/* ===== مجموعة: بيانات العميل الأساسية ===== */}
          <div className="form-section">
            <div className="form-section-head">
              <p className="form-section-title">
                <UserIcon />
                بيانات العميل
              </p>
              <p className="form-section-note">الاسم مطلوب، وباقي البيانات تساعد فى المتابعة والتواصل</p>
            </div>

            <div className="form-grid">
              <div className="form-group form-col-full">
                <label className="input-label" htmlFor="cf-name">الاسم *</label>
                <div className="relative">
                  <input
                    id="cf-name"
                    {...register('name')}
                    aria-invalid={!!errors.name}
                    className={clsx('input-field pl-10', errors.name && 'border-error-500')}
                    placeholder="أدخل اسم العميل"
                  />
                  <UserIcon className="input-icon" />
                </div>
                {errors.name && (
                  <p className="input-error" role="alert">
                    <AlertCircle />
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="cf-nid">الرقم القومي</label>
                <input
                  id="cf-nid"
                  {...register('national_id')}
                  className="input-field"
                  placeholder="أدخل الرقم القومي"
                  dir="ltr"
                />
                <span className="input-hint">14 رقمًا كما هو مدوّن فى البطاقة</span>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="cf-phone">رقم الهاتف</label>
                <div className="relative">
                  <input
                    id="cf-phone"
                    {...register('phone')}
                    type="tel"
                    inputMode="tel"
                    className="input-field pl-10"
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                  />
                  <Phone className="input-icon" />
                </div>
              </div>

              <div className="form-group form-col-full">
                <label className="input-label" htmlFor="cf-address">العنوان</label>
                <div className="relative">
                  <input
                    id="cf-address"
                    {...register('address')}
                    className="input-field pl-10"
                    placeholder="أدخل العنوان"
                  />
                  <MapPin className="input-icon" />
                </div>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="cf-birth">تاريخ الميلاد</label>
                <input id="cf-birth" {...register('birth_date')} type="date" className="input-field" />
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="cf-occupation">المهنة</label>
                <input
                  id="cf-occupation"
                  {...register('occupation')}
                  className="input-field"
                  placeholder="أدخل المهنة"
                />
              </div>

              <div className="form-group form-col-full">
                <label className="input-label" htmlFor="cf-marital">الحالة الاجتماعية</label>
                <select id="cf-marital" {...register('marital_status')} className="input-field">
                  <option value="">اختر الحالة</option>
                  {Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ===== بيانات طلب التأمين — بتتحفظ مع العميل وتُستخدم لاحقاً لتعبئة
               مبلغ التأمين وطريقة السداد تلقائياً عند إصدار وثيقة له ===== */}
          <div className="form-section">
            <div className="form-section-head">
              <p className="form-section-title">
                <ShieldCheck />
                بيانات طلب التأمين
              </p>
              <p className="form-section-note">
                تُستخدم لتعبئة الوثيقة تلقائيًا عند الإصدار لهذا العميل
              </p>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="input-label" htmlFor="cf-insurance">مبلغ التأمين *</label>
                <div className="relative">
                  <input
                    id="cf-insurance"
                    {...register('insurance_amount', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    aria-invalid={!!errors.insurance_amount}
                    className={clsx('input-field pl-14', errors.insurance_amount && 'border-error-500')}
                    placeholder="أدخل مبلغ التأمين"
                  />
                  <span className="input-suffix">جنيه</span>
                </div>
                {errors.insurance_amount && (
                  <p className="input-error" role="alert">
                    <AlertCircle />
                    {errors.insurance_amount.message}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="cf-paymethod">طريقة السداد *</label>
                <select
                  id="cf-paymethod"
                  {...register('payment_method')}
                  aria-invalid={!!errors.payment_method}
                  className={clsx('input-field', errors.payment_method && 'border-error-500')}
                >
                  <option value="">اختر طريقة السداد</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {errors.payment_method && (
                  <p className="input-error" role="alert">
                    <AlertCircle />
                    {errors.payment_method.message}
                  </p>
                )}
              </div>

              <div className="form-group form-col-full">
                <label className="input-label" htmlFor="cf-deposit">العربون *</label>
                <div className="relative">
                  <input
                    id="cf-deposit"
                    {...register('deposit_amount', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    aria-invalid={!!errors.deposit_amount}
                    className={clsx('input-field pl-14', errors.deposit_amount && 'border-error-500')}
                    placeholder="أدخل قيمة العربون"
                  />
                  <span className="input-suffix">جنيه</span>
                </div>
                {errors.deposit_amount && (
                  <p className="input-error" role="alert">
                    <AlertCircle />
                    {errors.deposit_amount.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {isManagerRole && (
            <div className="form-section">
              <div className="form-section-head">
                <p className="form-section-title">
                  <UserCog />
                  المسؤولية
                </p>
              </div>
              <div className="form-group">
                <label className="input-label">الوكيل المسؤول *</label>
                <input type="hidden" {...register('owner_id')} />
                <AgentCombobox
                  agents={agents}
                  value={ownerIdValue || ''}
                  onChange={(id) => setValue('owner_id', id, { shouldValidate: true })}
                  currentUserId={user?.id}
                  placeholder="اختر الوكيل"
                  hasError={!!errors.owner_id}
                />
                {agents.length === 0 && (
                  <span className="input-hint">لا يوجد أعضاء في فريقك حالياً</span>
                )}
                {errors.owner_id && (
                  <p className="input-error" role="alert">
                    <AlertCircle />
                    {errors.owner_id.message}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="modal-actions flex justify-end gap-2.5 pt-3.5 border-t border-secondary-200">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              إلغاء
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'جاري الحفظ…' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// alias مطابق لاسم الملف — يُستخدم فى حالة "إضافة عميل جديد" (editingCustomer === null)
export const AddCustomerDialog = CustomerFormDialog;
