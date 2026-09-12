import type { InstallmentWithRelations } from '../types';

// عنصر واحد فى قائمة التحصيل: إما قسط مفرد عادي، أو مجموعة أقساط لنفس
// تاريخ الاستحقاق تخص وثائق "حماية واستثمار" لنفس العميل ونفس الوكيل —
// بتتجمّع فى كارت واحد بدل ما يضطر المستخدم يسدّد كل وثيقة لوحدها (نفس
// قاعدة التجميع الموجودة فى pages/Policies/business/policyGrouping.ts).
export type CollectionListEntry =
  | { kind: 'single'; key: string; installment: InstallmentWithRelations }
  | {
      kind: 'group';
      key: string;
      groupId: string;
      dueDate: string;
      members: InstallmentWithRelations[];
    };

function protectionInvestmentGroupKey(installment: InstallmentWithRelations): string | null {
  const policy = installment.policy;
  if (!policy || policy.policy_type !== 'protection_investment') return null;
  if (!policy.customer_id || !policy.owner_id) return null;
  return `${policy.customer_id}:${policy.owner_id}`;
}

// التجميع بيتم فقط بين الأقساط المحمّلة فعلياً فى الصفحة الحالية من قائمة
// التحصيل (نفس تقسيم الصفحات الموجود أصلاً) — مجموعة كبيرة جداً (أكتر من
// حجم الصفحة) ممكن يظهر جزء منها فى صفحة والباقي فى التالية.
export function groupInstallmentsForDisplay(installments: InstallmentWithRelations[]): CollectionListEntry[] {
  const handledGroupKeys = new Set<string>();
  const entries: CollectionListEntry[] = [];

  for (const installment of installments) {
    const baseKey = protectionInvestmentGroupKey(installment);

    if (!baseKey) {
      entries.push({ kind: 'single', key: installment.id, installment });
      continue;
    }

    // التجميع بمعرّف العميل+الوكيل + تاريخ الاستحقاق معاً: كل وثائق نفس
    // العميل بتاريخ استحقاق واحد لنفس الشهر بيتجمّعوا فى كارت واحد لكل شهر
    const groupKey = `${baseKey}:${installment.due_date}`;

    if (handledGroupKeys.has(groupKey)) continue;
    handledGroupKeys.add(groupKey);

    const members = installments.filter(
      (i) => protectionInvestmentGroupKey(i) === baseKey && i.due_date === installment.due_date
    );

    if (members.length <= 1) {
      entries.push({ kind: 'single', key: installment.id, installment });
    } else {
      entries.push({ kind: 'group', key: groupKey, groupId: baseKey, dueDate: installment.due_date, members });
    }
  }

  return entries;
}
