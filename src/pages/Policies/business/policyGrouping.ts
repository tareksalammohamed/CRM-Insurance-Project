import type { Policy } from '../../../lib/supabase';

// عنصر واحد فى قائمة عرض الوثائق: إما وثيقة عادية مفردة، أو مجموعة وثائق
// "حماية واستثمار" لنفس العميل ونفس الوكيل بتُعرض كلها فى كارت واحد ذكي بدل
// ما تتفرّق كبطاقات منفصلة.
export type PolicyListEntry =
  | { kind: 'single'; key: string; policy: Policy }
  | { kind: 'group'; key: string; groupId: string; members: Policy[] };

// قاعدة التجميع: أي وثائق من نوع "حماية واستثمار" تخص نفس العميل ونفس
// الوكيل بتتحسب مجموعة واحدة وتُعرض مع بعض تلقائياً — مفيش مفهوم "وثيقة
// أساسية ووثائق فرعية"، ومفيش شرط إنها اتصدرت مع بعض فى نفس اللحظة أو عن
// طريق نفس المصدر (إصدار يدوي أو استيراد بيانات) — العلاقة بس هي: نفس
// العميل + نفس الوكيل + نفس النوع.
function protectionInvestmentGroupKey(policy: Policy): string | null {
  if (policy.policy_type !== 'protection_investment') return null;
  if (!policy.customer_id || !policy.owner_id) return null;
  return `${policy.customer_id}:${policy.owner_id}`;
}

// ملحوظة: التجميع بيتم فقط بين الوثائق المحمّلة فعلياً فى الصفحة الحالية
// (نفس صفحة القائمة المقسَّمة/paginated) — لو وثائق نفس العميل والوكيل
// اتفرّقت بين صفحتين، هيظهر جزء منها فى كل صفحة.
export function groupPoliciesForDisplay(policies: Policy[]): PolicyListEntry[] {
  const handledGroupKeys = new Set<string>();
  const entries: PolicyListEntry[] = [];

  for (const policy of policies) {
    const groupKey = protectionInvestmentGroupKey(policy);

    if (!groupKey) {
      entries.push({ kind: 'single', key: policy.id, policy });
      continue;
    }

    if (handledGroupKeys.has(groupKey)) continue;
    handledGroupKeys.add(groupKey);

    const members = policies.filter((p) => protectionInvestmentGroupKey(p) === groupKey);

    if (members.length <= 1) {
      entries.push({ kind: 'single', key: policy.id, policy });
    } else {
      entries.push({ kind: 'group', key: groupKey, groupId: groupKey, members });
    }
  }

  return entries;
}
