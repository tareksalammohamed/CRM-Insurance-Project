import { Plus } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';

interface CustomersHeaderProps {
  onAddCustomer: () => void;
}

export function CustomersHeader({ onAddCustomer }: CustomersHeaderProps) {
  return (
    <PageHeader
      title="طلبات التأمين"
      titleSuffix="بيانات العملاء"
      subtitle="إدارة طلبات التأمين ومتابعة بيانات العملاء"
      action={
        <button
          onClick={onAddCustomer}
          className="btn btn-primary w-full sm:w-auto shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة طلب تأمين</span>
        </button>
      }
      /* نفس الزر بشكل مدمج داخل الشريط الثابت أسفل الهيدر: يفضل ظاهر
         للمستخدم وهو بينزل ويتصفح الطلبات بدون رجوع لأعلى الصفحة */
      stickyAction={
        <button
          onClick={onAddCustomer}
          className="btn btn-primary shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة طلب تأمين</span>
        </button>
      }
    />
  );
}
