-- تصحيح: لا يجوز اعتبار وثيقة أكبر من 50,000 جزءاً من مجموعة التقسيم.
-- نفك أي مجموعة تحتوي على وثيقة مخالفة ونترك السجلات الأصلية كما هي
-- دون تغيير مبالغ التأمين أو الأقساط أو أرقام الوثائق.
UPDATE public.policies
SET policy_group_id = NULL,
    group_sequence = NULL,
    group_size = NULL,
    group_total_sum_assured = NULL
WHERE policy_group_id IN (
  SELECT policy_group_id
  FROM public.policies
  WHERE policy_group_id IS NOT NULL
  GROUP BY policy_group_id
  HAVING bool_or(COALESCE(sum_assured, 0) > 50000)
);
