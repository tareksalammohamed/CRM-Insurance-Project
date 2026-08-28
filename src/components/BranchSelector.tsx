import { useRef, useState, useEffect } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useBranchContext } from '../lib/branchContext';
import { ROLE_LABELS } from '../lib/supabase';

// سلكتور فرع صغير فى الهيدر — يظهر فقط للمستخدمين اللي عندهم أكتر من وضع
// وظيفي (أكتر من فرع). الغالبية العظمى من المستخدمين (وضع وظيفي واحد بس)
// مش هيشوفوا الكومبوننت ده إطلاقًا (بيرجع null قبل أي render فعلي).
export function BranchSelector() {
  const { branches, hasMultipleBranches, currentBranchId, setCurrentBranchId } = useBranchContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (!hasMultipleBranches) return null;

  const current = branches.find((b) => b.branchId === currentBranchId);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-1.5 rounded-xl border border-secondary-200 bg-white px-2.5 md:px-3 transition-colors hover:bg-secondary-50"
        aria-label="اختيار الفرع"
      >
        <Building2 className="w-[18px] h-[18px] text-primary-600 flex-shrink-0" />
        <span className="hidden md:inline text-[13px] font-bold text-secondary-800 truncate max-w-[7.5rem]">
          {current?.branchName || 'اختر الفرع'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-secondary-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="dropdown-menu min-w-[13rem] max-w-[calc(100vw-1.5rem)] left-0 right-auto">
          <div className="px-3.5 py-2 mb-1 border-b border-secondary-200">
            <span className="text-[11px] font-bold text-secondary-500">الفرع الحالي</span>
          </div>
          {branches.map((b) => (
            <button
              key={b.branchId}
              onClick={() => {
                setCurrentBranchId(b.branchId);
                setOpen(false);
              }}
              className="dropdown-item flex items-center justify-between gap-2"
            >
              <span className="flex flex-col items-start min-w-0">
                <span className="text-[13px] font-bold text-secondary-900 truncate">{b.branchName}</span>
                <span className="text-[11px] font-semibold text-secondary-500">{ROLE_LABELS[b.role]}</span>
              </span>
              {b.branchId === currentBranchId && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
