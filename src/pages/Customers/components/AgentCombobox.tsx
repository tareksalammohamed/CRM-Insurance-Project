import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Check, User as UserIcon, X, UserX } from 'lucide-react';
import clsx from 'clsx';
import { ROLE_LABELS, type UserRole } from '../../../lib/supabase';
import { AppBottomSheet } from '../../../components/ui/AppBottomSheet';

export interface AgentOption {
  id: string;
  name: string;
  role: UserRole;
  is_active?: boolean;
}

interface AgentComboboxProps {
  agents: AgentOption[];
  value: string; // '' أو 'all' أو معرّف الوكيل
  onChange: (id: string) => void;
  currentUserId?: string;
  placeholder?: string;
  hasError?: boolean;
  // لو true، بيظهر خيار "الكل" أعلى القائمة (يُستخدم فى لوحة الفلاتر فقط)
  includeAllOption?: boolean;
  allOptionLabel?: string;
  // عنوان الشيت السفلي عند الفتح
  sheetTitle?: string;
}

// خيارات فلتر "الدرجة الوظيفية" داخل القائمة — لتسهيل الوصول للوكيل المطلوب
// بين مجموعة كبيرة من أعضاء الفريق. "وكيل" يشمل agent وpremium_agent معاً.
const JOB_LEVEL_OPTIONS: { value: 'all' | UserRole; label: string }[] = [
  { value: 'all', label: 'كل الدرجات' },
  { value: 'general_supervisor', label: ROLE_LABELS.general_supervisor },
  { value: 'supervisor', label: ROLE_LABELS.supervisor },
  { value: 'group_leader', label: ROLE_LABELS.group_leader },
  { value: 'agent', label: 'وكيل' },
];

function matchesJobLevel(role: UserRole, level: 'all' | UserRole): boolean {
  if (level === 'all') return true;
  if (level === 'agent') return role === 'agent' || role === 'premium_agent';
  return role === level;
}

// قائمة احترافية لاختيار الوكيل: بحث فوري أثناء الكتابة بالاسم، تصفية حسب
// الدرجة الوظيفية (مراقب عام / مراقب / رئيس مجموعة / وكيل)، وتمرير سريع
// لقائمة قابلة للتمرير بدلاً من select طويل غير عملي.
// القائمة نفسها بتترندر فى شيت سفلي عام (AppBottomSheet) بدل قائمة absolute
// جوه الصفحة — كده مبتتقصّش ولا بتمنع السكرول مهما كان طول القائمة أو مكان
// الحقل فى الصفحة.
export function AgentCombobox({
  agents, value, onChange, currentUserId, placeholder = 'اختر الوكيل',
  hasError, includeAllOption, allOptionLabel = 'جميع الوكلاء', sheetTitle = 'اختر من الفريق',
}: AgentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [jobLevel, setJobLevel] = useState<'all' | UserRole>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setJobLevel('all');
    }
  }, [open]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      if (!matchesJobLevel(a.role, jobLevel)) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q);
    });
  }, [agents, search, jobLevel]);

  const selectedAgent = value && value !== 'all' ? agents.find((a) => a.id === value) : null;
  const displayLabel = value === 'all'
    ? allOptionLabel
    : selectedAgent
      ? `${selectedAgent.name}${selectedAgent.id === currentUserId ? ' (أنا)' : ''}`
      : '';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          'input-field flex items-center justify-between gap-2 text-right w-full',
          hasError && 'border-error-500'
        )}
      >
        <span className={clsx('truncate', !displayLabel && 'text-secondary-400')}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-secondary-400 shrink-0" />
      </button>

      {open && (
        <AppBottomSheet title={sheetTitle} onClose={() => setOpen(false)}>
          <div className="px-4 pb-2 space-y-2 sm:px-5">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم..."
                className="input-field pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-0.5 -mx-0.5 px-0.5">
              {JOB_LEVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setJobLevel(opt.value)}
                  className={clsx(
                    'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    jobLevel === opt.value
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-secondary-200 text-secondary-600 hover:border-primary-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
            {includeAllOption && (
              <button
                type="button"
                onClick={() => { onChange('all'); setOpen(false); }}
                className={clsx(
                  'w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-right hover:bg-secondary-50 sm:px-5',
                  value === 'all' && 'bg-primary-50 text-primary-700 font-medium'
                )}
              >
                <span>{allOptionLabel}</span>
                {value === 'all' && <Check className="w-4 h-4 shrink-0" />}
              </button>
            )}
            {filteredAgents.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-secondary-400">
                لا يوجد وكلاء مطابقين
              </div>
            ) : (
              filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => { onChange(agent.id); setOpen(false); }}
                  className={clsx(
                    'w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-right hover:bg-secondary-50 sm:px-5',
                    value === agent.id && 'bg-primary-50 text-primary-700 font-medium',
                    agent.is_active === false && 'opacity-70'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <UserIcon className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                    <span className="truncate">
                      {agent.name}{agent.id === currentUserId ? ' (أنا)' : ''}
                    </span>
                    {agent.is_active === false && (
                      <span className="badge badge-secondary text-[10px] shrink-0 flex items-center gap-1">
                        <UserX className="w-3 h-3" /> غير نشط
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-secondary-400">{ROLE_LABELS[agent.role]}</span>
                    {value === agent.id && <Check className="w-4 h-4" />}
                  </span>
                </button>
              ))
            )}
          </div>
        </AppBottomSheet>
      )}
    </div>
  );
}
