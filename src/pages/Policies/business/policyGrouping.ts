import type { Policy } from '../../../lib/supabase';

// عنصر واحد فى قائمة عرض الوثائق: إما وثيقة عادية مفردة، أو مجموعة وثائق
// ناتجة عن التقسيم التلقائي لوثيقة "حماية واستثمار" (مبلغ تأمين > 50,000)
// بتُعرض كلها فى كارت واحد ذكي بدل ما تتفرّق كبطاقات منفصلة.
//
// ملحوظة: التجميع بيتم فقط بين الوثائق المحمّلة فعلياً فى الصفحة الحالية
// (نفس صفحة القائمة المقسَّمة/paginated) — لو مجموعة وثائق كبيرة (مثلاً 20
// وثيقة لمليون جنيه) اتقسمت بين صفحتين، هيظهر جزء منها فى كل صفحة. عملياً
// نادر الحدوث لأن كل وثائق المجموعة بتتسجل دفعة واحدة بنفس اللحظة فبيبقوا
// متتاليين فى الترتيب.
export type PolicyListEntry =
  | { kind: 'single'; key: string; policy: Policy }
  | { kind: 'group'; key: string; groupId: string; members: Policy[] };

export function groupPoliciesForDisplay(policies: Policy[]): PolicyListEntry[] {
  const handledGroupIds = new Set<string>();
  const entries: PolicyListEntry[] = [];

  for (const policy of policies) {
    const groupId = policy.policy_group_id;

    if (!groupId) {
      entries.push({ kind: 'single', key: policy.id, policy });
      continue;
    }

    if (handledGroupIds.has(groupId)) continue;
    handledGroupIds.add(groupId);

    const members = policies
      .filter((p) => p.policy_group_id === groupId)
      .sort((a, b) => (a.group_sequence ?? 0) - (b.group_sequence ?? 0));

    // احتياطاً: لو لأي سبب اتفلترت وثيقة واحدة بس من المجموعة فى هذه الصفحة
    // (نادر جداً)، بتُعرض كوثيقة مفردة عادية بدل كارت مجموعة من عنصر واحد
    if (members.length <= 1) {
      entries.push({ kind: 'single', key: policy.id, policy });
    } else {
      entries.push({ kind: 'group', key: groupId, groupId, members });
    }
  }

  return entries;
}
