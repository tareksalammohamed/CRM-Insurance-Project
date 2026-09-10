-- أرقام وثائق المجموعة يدخلها المستخدم بالكامل؛ لا تتم إضافة لاحقات تلقائية.
DROP FUNCTION IF EXISTS public.create_policy_group_op(uuid, text, uuid, policy_type, date, payment_method, numeric, numeric, numeric, text, uuid);

CREATE OR REPLACE FUNCTION public.create_policy_group_op(
    p_operation_id uuid,
    p_policy_numbers text[],
    p_customer_id uuid,
    p_policy_type policy_type,
    p_start_date date,
    p_payment_method payment_method,
    p_premium_amount numeric,
    p_remainder_premium_amount numeric,
    p_sum_assured numeric,
    p_notes text,
    p_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing sync_operations;
  v_actor_id uuid := auth.uid();
  v_max_per_policy CONSTANT numeric := 50000;
  v_full_count int;
  v_remainder numeric;
  v_total_count int;
  v_group_id uuid;
  v_policy_id uuid;
  v_policy_ids uuid[] := ARRAY[]::uuid[];
  v_chunk_amount numeric;
  v_chunk_premium numeric;
  i int;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'يجب تسجيل الدخول قبل إصدار الوثيقة'; END IF;
  IF p_owner_id IS NULL OR NOT (p_owner_id = ANY(get_user_subtree(v_actor_id))) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ليس لديك صلاحية إصدار وثيقة لهذا الوكيل'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND owner_id = p_owner_id) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'العميل غير تابع للوكيل المحدد أو ليس لديك صلاحية الوصول إليه'; END IF;
  IF p_sum_assured IS NULL OR p_sum_assured <= v_max_per_policy THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'التقسيم التلقائي يُستخدم فقط عندما يتجاوز مبلغ التأمين 50,000 جنيه'; END IF;

  v_full_count := floor(p_sum_assured / v_max_per_policy)::int;
  v_remainder := round(p_sum_assured - (v_full_count * v_max_per_policy), 2);
  v_total_count := v_full_count + CASE WHEN v_remainder > 0 THEN 1 ELSE 0 END;
  IF p_policy_numbers IS NULL OR array_length(p_policy_numbers, 1) <> v_total_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'يجب إدخال رقم مستقل لكل وثيقة';
  END IF;
  FOR i IN 1..v_total_count LOOP
    IF NULLIF(btrim(p_policy_numbers[i]), '') IS NULL THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'رقم كل وثيقة مطلوب'; END IF;
    IF p_policy_numbers[i] = ANY(p_policy_numbers[1:i-1]) THEN RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'أرقام وثائق المجموعة يجب أن تكون مختلفة'; END IF;
  END LOOP;

  SELECT * INTO v_existing FROM sync_operations WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.status = 'success' THEN RETURN v_existing.result;
    ELSE RETURN jsonb_build_object('error', COALESCE(v_existing.error_message, 'فشلت العملية سابقاً')); END IF;
  END IF;

  v_group_id := gen_random_uuid();
  BEGIN
    FOR i IN 1..v_total_count LOOP
      IF i <= v_full_count THEN v_chunk_amount := v_max_per_policy; v_chunk_premium := p_premium_amount;
      ELSE v_chunk_amount := v_remainder; v_chunk_premium := COALESCE(p_remainder_premium_amount, p_premium_amount); END IF;
      INSERT INTO policies (policy_number, customer_id, policy_type, start_date, payment_method, premium_amount, sum_assured, notes, owner_id, policy_group_id, group_sequence, group_size, group_total_sum_assured)
      VALUES (btrim(p_policy_numbers[i]), p_customer_id, p_policy_type, p_start_date, p_payment_method, v_chunk_premium, v_chunk_amount, p_notes, p_owner_id, v_group_id, i, v_total_count, p_sum_assured)
      RETURNING id INTO v_policy_id;
      v_policy_ids := array_append(v_policy_ids, v_policy_id);
      PERFORM generate_installments(v_policy_id, p_start_date, p_payment_method, v_chunk_premium);
      PERFORM mark_historical_installments_paid(v_policy_id, v_actor_id);
      PERFORM log_activity('policy_create'::action_type, 'policy', v_policy_id);
    END LOOP;
    INSERT INTO sync_operations (operation_id, operation_type, entity_type, entity_id, user_id, status, result)
    VALUES (p_operation_id, 'create_policy_group', 'policy', v_policy_ids[1], v_actor_id, 'success', jsonb_build_object('policy_group_id', v_group_id, 'policy_ids', to_jsonb(v_policy_ids), 'count', v_total_count))
    ON CONFLICT (operation_id) DO NOTHING;
    RETURN jsonb_build_object('policy_group_id', v_group_id, 'policy_ids', to_jsonb(v_policy_ids), 'count', v_total_count);
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO sync_operations (operation_id, operation_type, entity_type, entity_id, user_id, status, error_message)
    VALUES (p_operation_id, 'create_policy_group', 'policy', NULL, v_actor_id, 'conflict', 'رقم الوثيقة مستخدم بالفعل') ON CONFLICT (operation_id) DO NOTHING;
    RETURN jsonb_build_object('conflict', true, 'error', 'رقم الوثيقة مستخدم بالفعل');
  WHEN OTHERS THEN
    INSERT INTO sync_operations (operation_id, operation_type, entity_type, entity_id, user_id, status, error_message)
    VALUES (p_operation_id, 'create_policy_group', 'policy', NULL, v_actor_id, 'failed', SQLERRM) ON CONFLICT (operation_id) DO NOTHING;
    RAISE;
  END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_policy_group_op(uuid, text[], uuid, policy_type, date, payment_method, numeric, numeric, numeric, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_policy_group_op(uuid, text[], uuid, policy_type, date, payment_method, numeric, numeric, numeric, text, uuid) FROM anon, public;
