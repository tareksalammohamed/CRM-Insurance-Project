import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '../utils';

interface DashboardChartsProps {
  totalPolicies: number;
  policyStatusData: { name: string; value: number; color: string }[];
  chartData: { production: number; collection: number };
}

// ألوان الرسم مشتقّة من هوية التطبيق (أخضر عميق / تيل) بدل الأزرق العام،
// عشان الرسوم تبقى امتداد بصري للهوية مش عنصر غريب عنها.
const PRODUCTION_COLOR = '#087f5b';
const COLLECTION_COLOR = '#0f5b59';

// تنسيق موحّد لكل Tooltip فى اللوحة — RTL + نفس حدود وظلال الكروت.
const TOOLTIP_STYLE = {
  direction: 'rtl' as const,
  borderRadius: '0.75rem',
  border: '1px solid #cddcd4',
  boxShadow: '0 8px 24px -8px rgb(13 41 37 / 0.16)',
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '0.5rem 0.625rem',
};

const TOOLTIP_ITEM_STYLE = { color: '#0d2925', fontWeight: 700 };

export function DashboardCharts({ totalPolicies, policyStatusData, chartData }: DashboardChartsProps) {
  const combined = chartData.production + chartData.collection;
  const productionShare = combined > 0 ? Math.round((chartData.production / combined) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
      <div className="card chart-panel">
        <div className="chart-panel-head">
          <div className="min-w-0">
            <h3 className="chart-panel-title">حالة الوثائق</h3>
            <p className="chart-panel-note">توزيع المحفظة حسب الحالة</p>
          </div>
          <div className="chart-panel-total">
            <span>الإجمالي</span>
            <strong>{totalPolicies || 0}</strong>
          </div>
        </div>

        <div className="chart-canvas h-40 md:h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={policyStatusData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={66}
                paddingAngle={3}
                strokeWidth={0}
                dataKey="value"
              >
                {policyStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any) => [value, name]}
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-center">
            <span className="chart-center-value">{totalPolicies || 0}</span>
            <span className="chart-center-label">وثيقة</span>
          </div>
        </div>

        <div className="chart-legend">
          {policyStatusData.map((entry) => (
            <div key={entry.name} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ backgroundColor: entry.color }} />
              <span className="chart-legend-name">{entry.name}</span>
              <span className="chart-legend-value">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card chart-panel">
        <div className="chart-panel-head">
          <div className="min-w-0">
            <h3 className="chart-panel-title">الإنتاج والتحصيل</h3>
            <p className="chart-panel-note">مقارنة مصادر التحصيل هذا الشهر</p>
          </div>
          <div className="chart-panel-total">
            <span>الإجمالي</span>
            <strong>{formatCurrency(combined)}</strong>
          </div>
        </div>

        <div className="chart-canvas h-40 md:h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'الإنتاج الجديد', value: chartData.production, color: PRODUCTION_COLOR },
                  { name: 'التحصيل الدوري', value: chartData.collection, color: COLLECTION_COLOR }
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={66}
                paddingAngle={3}
                strokeWidth={0}
              >
                <Cell fill={PRODUCTION_COLOR} />
                <Cell fill={COLLECTION_COLOR} />
              </Pie>
              <Tooltip
                formatter={(value: any) => formatCurrency(value)}
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-center">
            <span className="chart-center-value">{productionShare}%</span>
            <span className="chart-center-label">إنتاج جديد</span>
          </div>
        </div>

        <div className="chart-legend">
          <div className="chart-legend-item">
            <span className="chart-legend-dot" style={{ backgroundColor: PRODUCTION_COLOR }} />
            <span className="chart-legend-name">الإنتاج الجديد</span>
            <span className="chart-legend-value">{formatCurrency(chartData.production)}</span>
          </div>
          <div className="chart-legend-item">
            <span className="chart-legend-dot" style={{ backgroundColor: COLLECTION_COLOR }} />
            <span className="chart-legend-name">التحصيل الدوري</span>
            <span className="chart-legend-value">{formatCurrency(chartData.collection)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
