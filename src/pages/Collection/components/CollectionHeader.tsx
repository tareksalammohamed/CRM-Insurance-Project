import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PageHeader } from '../../../components/layout/PageHeader';

// رأس الصفحة
export function CollectionHeader({ month }: { month?: string }) {
  return (
    <PageHeader
      title="التحصيل والسداد"
      titleSuffix="مركز عمليات التحصيل"
      subtitle={`متابعة الأقساط والتحصيلات — ${format(month ? new Date(`${month}T12:00:00`) : new Date(), 'MMMM yyyy', { locale: ar })}`}
    />
  );
}
