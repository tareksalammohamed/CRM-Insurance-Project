import { ROLE_LABELS, type UserRole } from '../../../lib/supabase';
import type { SupervisorAgg } from '../types';
import { fmt } from '../utils';
import samarElhawarySignature from '../assets/samar-elhawary-signature.png';

// ── الشرط: مذكرة "صرف فرق التنسيب" التلقائية ──────────────────────────
// المراقب يستحق مذكرة تلقائية لو (وبس لو) كان عنده 3 رؤساء مجموعات بالظبط
// وحقق 151% أو أكتر من هدفه الشهري. الشرطين ثابتان بقرار صريح من الإدارة.
export const MEMO_MIN_GROUP_LEADERS = 3;
export const MEMO_MIN_ACHIEVEMENT_RATE = 151;

export function qualifiesForRecommendationMemo(sv: SupervisorAgg): boolean {
  return sv.directGroupLeaderCount === MEMO_MIN_GROUP_LEADERS
    && sv.target > 0
    && sv.achievementRate >= MEMO_MIN_ACHIEVEMENT_RATE;
}

// نفس ROLE_LABELS المستخدمة فى باقي التقرير، لكن بصيغة نكرة (بدون "ال")
// لأنها بتيجي هنا بعد "السيد/ ..." أو "مقدمه لسيادتكم" كوصف — "مراقب بفرع
// طنطا 3" مش "المراقب بفرع طنطا 3".
function indefiniteRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role].replace(/^ال/, '');
}

// التوقيع اليدوي المعتمد لسمر يُستخدم في مذكرة فرق التنسيب
// ويظهر أسفل اسمها مباشرةً داخل مساحة التوقيع.
export function RecommendationMemo({
  supervisor, branchName, monthLabel, printDate, branding, pageNumber,
}: {
  supervisor: SupervisorAgg;
  branchName?: string;
  monthLabel: string;
  printDate: string;
  branding: { company_name: string; company_logo_url: string | null };
  pageNumber: number;
}) {
  const hasSupervisorSignature = Boolean(supervisor.generalSupervisorName);
  const generalSupervisorRoleLabel = indefiniteRoleLabel('general_supervisor');
  const scopeLabel = branchName ? ` ${branchName}` : '';

  return (
    <div className="pr-page-break pr-memo-page">
      <div className="pr-company-flat">
        {branding.company_logo_url && <img src={branding.company_logo_url} alt={branding.company_name} />}
        <span>{branding.company_name}</span>
      </div>
      <div className="pr-memo-title">مذكرة صرف فرق التنسيب</div>
      <div className="pr-memo-sub">تقرير تقفيل الشهر — {monthLabel}</div>
      <div className="pr-memo-title-rule" />

      <div className="pr-memo-salutation">السيد الأستاذ/ عضو مجلس الإدارة المنتدب</div>
      <div className="pr-memo-greeting">تحية طيبة وبعد،،،</div>

      <div className="pr-memo-body">
        برجاء التكرم بالموافقة على صرف فرق التنسيب للسيد/ <b>{supervisor.name}</b> – {indefiniteRoleLabel(supervisor.role)}
        {branchName ? <> بفرع <b>{branchName}</b></> : null}
        ، وذلك نظرًا لتحقيقه هدف قدره (<b>{fmt(supervisor.total)}</b>) بنسبة تحقيق (<b>{supervisor.achievementRate}</b>)% عن شهر (<b>{monthLabel}</b>).
      </div>

      <div className="pr-memo-closing">وتفضلوا بقبول فائق الاحترام والتقدير،،،</div>

      <div className="pr-memo-sign-block">
        <div className="pr-memo-sign-label">مقدمه لسيادتكم</div>
        <div className="pr-memo-sign-role">{generalSupervisorRoleLabel}{scopeLabel}</div>
        <div className="pr-memo-sign-name">{supervisor.generalSupervisorName || '\u00A0'}</div>

        {hasSupervisorSignature ? (
          <>
            <div className="pr-memo-signature-slot">
              <img src={samarElhawarySignature} alt="" className="pr-memo-sign-img" />
            </div>
            <div className="pr-memo-sign-date">التاريخ: {printDate}</div>
          </>
        ) : (
          <>
            <div className="pr-memo-sign-line" />
            <div className="pr-memo-sign-date">التاريخ: {printDate}</div>
          </>
        )}
      </div>

      <div className="pr-footer">
        {branding.company_name} · تقرير تقفيل الشهر — {monthLabel} · صفحة {pageNumber}
      </div>
    </div>
  );
}
