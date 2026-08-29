import { DollarSign, Layers } from 'lucide-react';

type YearMode = 'year1' | 'year2';

interface CollectionTabsProps {
  yearMode: YearMode;
  onChange: (mode: YearMode) => void;
}

/**
 * تبديل بصري فقط بين مساري التحصيل. لا يدمج أي بيانات أو حسابات:
 * السنة الأولى تستخدم الأقساط الأصلية، والسنوات اللاحقة تستخدم مسارها المنفصل.
 *
 * التمييز البصري للمسار النشط لا يعتمد على اللون وحده: سطح أبيض مرتفع + حد
 * بلون الهوية + نقطة حالة + aria-selected — فيبقى واضحًا لكل المستخدمين.
 */
export function CollectionTabs({ yearMode, onChange }: CollectionTabsProps) {
  const tabs: Array<{
    id: YearMode;
    title: string;
    description: string;
    icon: typeof DollarSign;
  }> = [
    {
      id: 'year1',
      title: 'السنة الأولى',
      description: 'الأقساط والحسابات الأساسية',
      icon: DollarSign,
    },
    {
      id: 'year2',
      title: 'السنة الثانية وما بعدها',
      description: 'تحصيل منفصل للسنوات اللاحقة',
      icon: Layers,
    },
  ];

  return (
    <div role="tablist" aria-label="اختيار مسار التحصيل" className="col-segment">
      {tabs.map(({ id, title, description, icon: Icon }) => {
        const isActive = yearMode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className="col-segment-btn"
          >
            <span className="col-segment-icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="col-segment-text">
              <span className="col-segment-title">{title}</span>
              <span className="col-segment-desc">{description}</span>
            </span>
            {isActive && <span className="col-segment-dot" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
