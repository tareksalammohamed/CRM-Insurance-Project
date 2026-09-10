-- تجميع الوثائق القديمة التي تمثل مجموعة حماية واستثمار واحدة.
-- لا نغيّر أرقام الوثائق ولا مبالغها ولا أقساطها؛ نضيف فقط بيانات المجموعة
-- التي تعتمد عليها واجهتا الوثائق والتحصيل.
DO $migration$
DECLARE
  v_bucket record;
  v_policy record;
  v_group_id uuid;
  v_sequence integer;
  v_group_size integer;
  v_total_sum numeric;
BEGIN
  FOR v_bucket IN
    SELECT
      customer_id,
      owner_id,
      start_date,
      payment_method,
      premium_amount,
      count(*)::integer AS member_count,
      sum(sum_assured)::numeric AS total_sum
    FROM public.policies
    WHERE policy_type = 'protection_investment'
      AND policy_group_id IS NULL
      AND sum_assured IS NOT NULL
      AND sum_assured > 0
      AND sum_assured <= 50000
    GROUP BY customer_id, owner_id, start_date, payment_method, premium_amount
    HAVING count(*) > 1
       AND sum(sum_assured) > 50000
       AND count(*) FILTER (WHERE sum_assured = 50000) >= floor(sum(sum_assured) / 50000)
  LOOP
    v_group_id := gen_random_uuid();
    v_sequence := 0;
    v_group_size := v_bucket.member_count;
    v_total_sum := v_bucket.total_sum;

    FOR v_policy IN
      SELECT id
      FROM public.policies
      WHERE policy_type = 'protection_investment'
        AND policy_group_id IS NULL
        AND customer_id = v_bucket.customer_id
        AND owner_id = v_bucket.owner_id
        AND start_date = v_bucket.start_date
        AND payment_method = v_bucket.payment_method
        AND premium_amount = v_bucket.premium_amount
        AND sum_assured IS NOT NULL
        AND sum_assured > 0
        AND sum_assured <= 50000
      ORDER BY created_at, id
    LOOP
      v_sequence := v_sequence + 1;
      UPDATE public.policies
      SET policy_group_id = v_group_id,
          group_sequence = v_sequence,
          group_size = v_group_size,
          group_total_sum_assured = v_total_sum
      WHERE id = v_policy.id;
    END LOOP;
  END LOOP;
END;
$migration$;
