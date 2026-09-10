import type { InstallmentWithRelations } from '../types';

// عنصر واحد فى قائمة التحصيل: إما قسط مفرد عادي، أو مجموعة أقساط لنفس
// تاريخ الاستحقاق تخص وثائق ناتجة عن التقسيم التلقائي لوثيقة "حماية
// واستثمار" (policy_group_id واحد) — بتتجمّع فى كارت واحد بدل ما يضطر
// المستخدم يسدّد كل وثيقة لوحدها (راجع pages/Policies/business/policySplit.ts).
//
// التجميع بيتم فقط بين الأقساط المحمّلة فعلياً فى الصفحة الحالية من قائمة
// التحصيل (نفس تقسيم الصفحات الموجود أصلاً) — مجموعة كبيرة جداً (أكتر من
// حجم الصفحة) ممكن يظهر جزء منها فى صفحة والباقي فى التالية.
export type CollectionListEntry =
  | { kind: 'single'; key: string; installment: InstallmentWithRelations }
  | {
      kind: 'group';
      key: string;
      groupId: string;
      dueDate: string;
      members: InstallmentWithRelations[];
    };

export function groupInstallmentsForDisplay(installments: InstallmentWithRelations[]): CollectionListEntry[] {
  const handledGroupKeys = new Set<string>();
  const entries: CollectionListEntry[] = [];

  for (const installment of installments) {
    const groupId = installment.policy.policy_group_id;

    if (!groupId) {
      entries.push({ kind: 'single', key: installment.id, installment });
      continue;
    }

    // التجميع بمعرّف المجموعة + تاريخ الاستحقاق معاً: كل وثائق المجموعة
    // بتاريخ استحقاق واحد لنفس الشهر بيتجمّعوا فى كارت واحد لكل شهر استحقاق
    const groupKey = `${groupId}:${installment.due_date}`;

    if (handledGroupKeys.has(groupKey)) continue;
    handledGroupKeys.add(groupKey);

    const members = installments.filter(
      (i) => i.policy.policy_group_id === groupId && i.due_date === installment.due_date
    );

    if (members.some((member) => Number(member.policy.sum_assured || 0) > 50000)) {
      members.forEach((member) => entries.push({ kind: 'single', key: member.id, installment: member }));
      continue;
    }

    if (members.length <= 1) {
      entries.push({ kind: 'single', key: installment.id, installment });
    } else {
      entries.push({ kind: 'group', key: groupKey, groupId, dueDate: installment.due_date, members });
    }
  }

  return entries;
}
