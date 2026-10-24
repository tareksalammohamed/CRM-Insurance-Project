import { useState } from 'react';
import { MessageSquare, CalendarClock, X } from 'lucide-react';
import { AppDialog } from '../../components/ui/AppDialog';
import { useAuth } from '../../hooks/useAuth';
import { useBranchContext } from '../../lib/branchContext';
import { FollowupForm } from './FollowupForm';
import { FollowupList } from './FollowupList';
import type { PromiseContext } from './model';
export function FollowupPanel({ customerId, context, initiallyOpen = false }: { customerId: string; context?: PromiseContext; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [visited, setVisited] = useState(initiallyOpen);
  const [revision, setRevision] = useState(0);
  const [section, setSection] = useState<'history' | 'add'>(context ? 'add' : 'history');
  const [formVisited, setFormVisited] = useState(!!context);
  const { user } = useAuth(); const { currentBranchId } = useBranchContext();
  return <section className="space-y-3" aria-label={context ? 'وعود السداد' : 'متابعة العميل'}>
    {!initiallyOpen && <button type="button" className="btn btn-secondary w-full justify-between" onClick={() => { setVisited(true); setOpen(v => !v); }} aria-expanded={open}><MessageSquare className="w-4 h-4" />{context ? 'وعود السداد والسجل' : 'سجل متابعة العميل'}<span>{open ? 'إخفاء' : 'فتح'}</span></button>}
    {visited && <div hidden={!open} key={`${user?.id}:${currentBranchId}:${customerId}:${context?.installmentId || context?.policyId || ''}`}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="اختيار قسم المتابعة">
          <button type="button" className={`btn btn-sm ${section === 'history' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={section === 'history'} onClick={() => setSection('history')}>السجل والمتابعات</button>
          <button type="button" className={`btn btn-sm ${section === 'add' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={section === 'add'} onClick={() => { setFormVisited(true); setSection('add'); }}>{context ? 'إضافة وعد سداد' : 'إضافة متابعة'}</button>
        </div>
        <div hidden={section !== 'add'}>
          {formVisited && <FollowupForm customerId={customerId} context={context} onSaved={() => setRevision(v => v + 1)} />}
        </div>
        <div hidden={section !== 'history'}>
          {section === 'history' && open && <FollowupList customerId={customerId} policyId={context?.policyId} installmentId={context?.installmentId} revision={revision} />}
        </div>
      </div>
    </div>}
  </section>;
}

export function FollowupWorkspaceButton() {
  const [open, setOpen] = useState(false); const { user } = useAuth(); const { currentBranchId } = useBranchContext();
  return <><button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}><CalendarClock className="w-4 h-4" />متابعات العملاء ووعود السداد</button>
    {open && <AppDialog onClose={() => setOpen(false)} ariaLabel="متابعات العملاء ووعود السداد" className="max-w-2xl modal-form-shell">
      <div className="modal-form-header p-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-secondary-900">متابعات العملاء ووعود السداد</h3><p className="text-xs text-secondary-600">ضمن نطاق العملاء والفريق المتاح لك</p></div><button className="icon-button" aria-label="إغلاق" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button></div>
      <div className="modal-form-scroll p-4"><FollowupList key={`${user?.id}:${currentBranchId}`} onNavigate={() => setOpen(false)} /></div>
    </AppDialog>}
  </>;
}
export function PromiseDialog({ customerId, customerName, context, onClose }: { customerId: string; customerName: string; context: PromiseContext; onClose: () => void }) {
  return <AppDialog onClose={onClose} ariaLabel={`وعد سداد ${customerName}`} className="max-w-xl modal-form-shell"><div className="modal-form-header p-4 flex justify-between items-center gap-2"><h3 className="font-bold text-secondary-900">متابعة السداد — {customerName}</h3><button onClick={onClose} className="icon-button" aria-label="إغلاق"><X className="w-5 h-5" /></button></div><div className="modal-form-scroll p-4"><FollowupPanel customerId={customerId} context={context} initiallyOpen /></div></AppDialog>;
}
