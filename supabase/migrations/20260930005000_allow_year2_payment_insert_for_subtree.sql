-- السماح للمستخدم بتسجيل تحصيل السنة الثانية لوثائق فريقه،
-- مع الاحتفاظ بأن paid_by_user_id يجب أن يساوي المستخدم الحالي.
-- هذا يتوافق مع عرض صفحة التحصيل الهرمي لوثائق الفريق.
DROP POLICY IF EXISTS "year2_payments_insert_owner" ON public.year2_payments;
DROP POLICY IF EXISTS "year2_payments_insert_hierarchy" ON public.year2_payments;

CREATE POLICY "year2_payments_insert_hierarchy" ON public.year2_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    paid_by_user_id = auth.uid()
    AND policy_id IN (
      SELECT id
      FROM public.policies
      WHERE owner_id IN (SELECT unnest(public.get_user_subtree(auth.uid())))
    )
  );
