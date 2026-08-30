import { Plus } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';

interface PoliciesHeaderProps {
  onAddPolicy: () => void;
}

export function PoliciesHeader({ onAddPolicy }: PoliciesHeaderProps) {
  return (
    <PageHeader
      title="الوثائق"
      subtitle="إدارة وثائق التأمين ومتابعة حالتها"
      action={
        <button
          onClick={onAddPolicy}
          className="btn btn-primary w-full sm:w-auto shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>إصدار وثيقة</span>
        </button>
      }
      /* نفس الزر بشكل مدمج داخل الشريط الثابت أسفل الهيدر: يفضل ظاهر
         للمستخدم وهو بينزل ويتصفح الوثائق بدون رجوع لأعلى الصفحة */
      stickyAction={
        <button
          onClick={onAddPolicy}
          className="btn btn-primary shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إصدار وثيقة</span>
        </button>
      }
    />
  );
}
