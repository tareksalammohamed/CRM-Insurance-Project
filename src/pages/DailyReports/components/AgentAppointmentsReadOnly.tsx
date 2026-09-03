import { useEffect, useState } from 'react';
import { Loader2, MapPin, Clock, CheckCircle2, ExternalLink } from 'lucide-react';

import { fetchAgentAppointments } from '../services/appointmentCheckinsService';
import type { AgentAppointmentCheckin } from '../types';

interface AgentAppointmentsReadOnlyProps {
  agentId: string;
  /** بداية/نهاية الفترة المختارة فى صفحة الإحصائيات المجمّعة (yyyy-MM-dd) */
  startDate: string;
  endDate: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** عرض للقراءة فقط لمواعيد الإيجنت وحالة تسجيل الموقع خلال الفترة المختارة
 * — تُستخدم من المراقب/المراقب العام/مدير التطوير عند النزول لفرد بعينه فى
 * شجرة الإحصائيات المجمّعة (بدون صلاحية إضافة أو حذف، دي بس لرئيس المجموعة) */
export function AgentAppointmentsReadOnly({ agentId, startDate, endDate }: AgentAppointmentsReadOnlyProps) {
  const [appointments, setAppointments] = useState<AgentAppointmentCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const dayStart = new Date(`${startDate}T00:00:00`).toISOString();
    const dayEnd = new Date(`${endDate}T23:59:59.999`).toISOString();
    fetchAgentAppointments(agentId, dayStart, dayEnd)
      .then((data) => { if (!cancelled) setAppointments(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentId, startDate, endDate]);

  if (loading) {
    return (
      <div className="text-sm text-secondary-400 flex items-center gap-1.5">
        <Loader2 className="w-4 h-4 animate-spin" /> جارِ التحميل...
      </div>
    );
  }

  if (appointments.length === 0) {
    return <p className="text-sm text-secondary-400 text-center py-4">لا توجد مواعيد مسجّلة لهذه الفترة</p>;
  }

  return (
    <div className="stack-list">
      {appointments.map((a) => {
        const hasLocation = !!a.checked_in_at && a.latitude != null && a.longitude != null;
        return (
          <div key={a.id} className="stack-row">
            <div className="stack-row-head">
              <span className="stack-row-title min-w-0">
                <Clock className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                <span className="truncate">{formatDateTime(a.appointment_time)}</span>
                <span className="text-secondary-500 font-medium truncate">{a.client_name}</span>
              </span>
            </div>
            <div className="stack-row-actions">
              {hasLocation ? (
                <a
                  href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge badge-success flex items-center gap-1.5 w-fit hover:brightness-95"
                  title="فتح الموقع فى خرائط جوجل"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  تم تسجيل الموقع
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : a.checked_in_at ? (
                <span className="badge badge-success flex items-center gap-1.5 w-fit">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> تم تسجيل الموقع
                </span>
              ) : (
                <span className="text-xs text-secondary-400">بانتظار وصول الإيجنت</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
