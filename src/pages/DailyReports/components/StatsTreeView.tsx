import { SearchInput } from '../../../components/forms/SearchInput';
import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronLeft, Users, Phone, CalendarCheck2, UserPlus } from 'lucide-react';
import { getRoleBadgeClass } from '../../Users/business/roleHierarchy';
import type { StatsTreeNode } from '../types';

interface NodeRowProps {
  node: StatsTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: StatsTreeNode) => void;
  searchContext?: string;
}

function NodeRow({ node, depth, selectedId, onSelect, searchContext }: NodeRowProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = searchContext === undefined && node.children.length > 0;
  const isSelected = selectedId === node.userId;

  return (
    <div>
      <div className={`daily-team-node ${isSelected ? 'daily-team-node-selected' : ''}`} style={{ '--node-depth': Math.min(depth, 3) } as CSSProperties}>
        <div className="flex items-center gap-1 min-w-0">
          {hasChildren ? (
            <button type="button" aria-label={`${expanded ? 'طي' : 'توسيع'} فريق ${node.name}`} aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)} className="daily-node-toggle text-secondary-500 shrink-0">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          ) : <span className="w-3 shrink-0" />}
          <button type="button" onClick={() => onSelect(node)} aria-pressed={isSelected} className="daily-node-select min-w-0 flex-1 text-start">
            <span className="block text-sm font-bold text-secondary-900 break-words">{node.name}</span>
            <span className={`badge border mt-1 ${getRoleBadgeClass(node.role)}`}>{node.roleLabel}</span>
            {searchContext && <span className="mt-1 block text-xs text-secondary-500 break-words">{searchContext}</span>}
            {node.own !== null && node.own.entriesCount === 0 && <span className="mt-1 block text-xs text-secondary-500">لا توجد تقارير مسجلة خلال الفترة</span>}
          </button>
        </div>
        <div className="daily-node-metrics">
          {[
            { label: 'مكالمات', value: node.subtree.callsActual, icon: Phone },
            { label: 'مواعيد', value: node.subtree.appointmentsActual, icon: CalendarCheck2 },
            { label: 'طلبات تأمين', value: node.subtree.newClients, icon: UserPlus },
          ].map(({ label, value, icon: Icon }) => (
            <span key={label} className="daily-node-metric">
              <span className="inline-flex items-center gap-1 text-secondary-500"><Icon aria-hidden="true" className="w-3 h-3" />{label}</span>
              <b className="text-secondary-900 tabular-nums">{value}</b>
            </span>
          ))}
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <NodeRow key={child.userId} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

interface StatsTreeViewProps {
  nodes: StatsTreeNode[];
  selectedId: string | null;
  onSelect: (node: StatsTreeNode) => void;
}

/** شجرة هرمية قابلة للطي/التوسيع لإحصائيات الفريق — كل عقدة تعرض إجمالي
 * نطاقها (هي + كل من تحتها)، والضغط عليها يختارها لعرض تفاصيلها بجانبها */
export function StatsTreeView({ nodes, selectedId, onSelect }: StatsTreeViewProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('ar');
  const matches = useMemo(() => {
    const found: { node: StatsTreeNode; context: string }[] = [];
    function visit(list: StatsTreeNode[], path: string[]) {
      for (const node of list) {
        if (`${node.name} ${node.roleLabel}`.toLocaleLowerCase('ar').includes(query)) found.push({ node, context: path.join(' / ') });
        visit(node.children, [...path, node.name]);
      }
    }
    if (query) visit(nodes, []);
    return found;
  }, [nodes, query]);
  if (nodes.length === 0) {
    return (
      <div className="card text-center py-8 text-secondary-400 flex flex-col items-center gap-2">
        <Users className="w-6 h-6" />
        لا يوجد أفراد فى نطاقك حالياً
      </div>
    );
  }

  return (
    <div className="card daily-team-tree space-y-2">
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-secondary-900">الفريق وتفاصيل الأفراد</h3>
        <SearchInput value={search} onChange={setSearch} placeholder="ابحث بالاسم أو الوظيفة داخل الفريق…" />
        {query && <p className="text-xs text-secondary-500" role="status">{matches.length} نتيجة · الإجماليات والطباعة تشمل النطاق الكامل</p>}
      </div>
      <div className="daily-team-tree-list max-h-[60dvh] overflow-y-auto overscroll-contain" role="region" aria-label="أفراد الفريق" tabIndex={0}>
        <div hidden={!!query}>
          {nodes.map(node => <NodeRow key={node.userId} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />)}
        </div>
        {query && matches.map(({ node, context }) => <NodeRow key={node.userId} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} searchContext={context} />)}
        {query && matches.length === 0 && <p className="py-6 text-center text-sm text-secondary-500">لا يوجد اسم أو وظيفة مطابقة للبحث</p>}
      </div>
    </div>
  );
}
