-- مبلغ التأمين والقسط الصافي لكل وثيقة فرعية فى مجموعة "حماية واستثمار"
-- بيدخلهم المستخدم بنفسه بالكامل (زي أرقام الوثائق بالظبط) — مفيش أي تقسيم
-- تلقائي ثابت (50,000 + الباقي) جوه الدالة نفسها بعد كده. الدالة بتتحقق فقط
-- من: عدد الوثائق وثيقتين على الأقل، كل وحدة > 0 ولا تتجاوز 50,000، ومجموع
-- كل الوحدات يساوي مبلغ التأمين الإجمالي بالظبط.
-- تنظيف أي نسخة سابقة متبقية من الدالة (الإصدار الأول كان بيولّد رقم الوثيقة
-- تلقائياً بلاحقة "-1"، "-2"... — بديل هذا التاريخ بالكامل الآن)
DROP FUNCTION IF EXISTS public.create_policy_group_op(uuid, text, uuid, policy_type, date, payment_method, numeric, numeric, numeric, text, uuid);
DROP FUNCTION IF EXISTS public.create_policy_group_op(uuid, text[], uuid, policy_type, date, payment_method, numeric, numeric, numeric, text, uuid);

CREATE OR REPLACE FUNCTION public.create_policy_group_op(
    p_operation_id uuid,
    p_policy_numbers text[],
    p_sum_assured_chunks numeric[],
    p_premium_amounts numeric[],
    p_customer_id uuid,
    p_policy_type policy_type,
    p_start_date date,
    p_payment_method payment_method,
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
  v_total_count int;
  v_group_id uuid;
  v_policy_id uuid;
  v_policy_ids uuid[] := ARRAY[]::uuid[];
  v_sum_check numeric := 0;
  i int;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'يجب تسجيل الدخول قبل إصدار الوثيقة'; END IF;
  IF p_owner_id IS NULL OR NOT (p_owner_id = ANY(get_user_subtree(v_actor_id))) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ليس لديك صلاحية إصدار وثيقة لهذا الوكيل'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND owner_id = p_owner_id) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'العميل غير تابع للوكيل المحدد أو ليس لديك صلاحية الوصول إليه'; END IF;
  IF p_sum_assured IS NULL OR p_sum_assured <= v_max_per_policy THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'التقسيم يُستخدم فقط عندما يتجاوز مبلغ التأمين 50,000 جنيه'; END IF;

  v_total_count := COALESCE(array_length(p_policy_numbers, 1), 0);
  IF v_total_count < 2 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'يجب تقسيم مبلغ التأمين على وثيقتين على الأقل';
  END IF;
  IF COALESCE(array_length(p_sum_assured_chunks, 1), 0) <> v_total_count
     OR COALESCE(array_length(p_premium_amounts, 1), 0) <> v_total_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'بيانات الوثائق الفرعية غير مكتملة';
  END IF;

  FOR i IN 1..v_total_count LOOP
    IF NULLIF(btrim(p_policy_numbers[i]), '') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'رقم كل وثيقة مطلوب';
    END IF;
    IF p_policy_numbers[i] = ANY(p_policy_numbers[1:i-1]) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'أرقام وثائق المجموعة يجب أن تكون مختلفة';
    END IF;
    IF p_sum_assured_chunks[i] IS NULL OR p_sum_assured_chunks[i] <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'مبلغ التأمين لكل وثيقة فرعية يجب أن يكون أكبر من صفر';
    END IF;
    IF p_sum_assured_chunks[i] > v_max_per_policy THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'مبلغ التأمين لكل وثيقة فرعية يجب ألا يتجاوز 50,000 جنيه';
    END IF;
    IF p_premium_amounts[i] IS NULL OR p_premium_amounts[i] <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'قيمة القسط الصافي مطلوبة لكل وثيقة فرعية';
    END IF;
    v_sum_check := v_sum_check + p_sum_assured_chunks[i];
  END LOOP;

  IF round(v_sum_check, 2) <> round(p_sum_assured, 2) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'مجموع مبالغ التأمين للوثائق الفرعية يجب أن يساوي مبلغ التأمين الإجمالي بالضبط';
  END IF;

  SELECT * INTO v_existing FROM sync_operations WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.status = 'success' THEN RETURN v_existing.result;
    ELSE RETURN jsonb_build_object('error', COALESCE(v_existing.error_message, 'فشلت العملية سابقاً')); END IF;
  END IF;

  v_group_id := gen_random_uuid();
  BEGIN
    FOR i IN 1..v_total_count LOOP
      INSERT INTO policies (
        policy_number, customer_id, policy_type, start_date, payment_method,
        premium_amount, sum_assured, notes, owner_id,
        policy_group_id, group_sequence, group_size, group_total_sum_assured
      )
      VALUES (
        btrim(p_policy_numbers[i]), p_customer_id, p_policy_type, p_start_date, p_payment_method,
        p_premium_amounts[i], p_sum_assured_chunks[i], p_notes, p_owner_id,
        v_group_id, i, v_total_count, p_sum_assured
      )
      RETURNING id INTO v_policy_id;
      v_policy_ids := array_append(v_policy_ids, v_policy_id);
      PERFORM generate_installments(v_policy_id, p_start_date, p_payment_method, p_premium_amounts[i]);
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

GRANT EXECUTE ON FUNCTION public.create_policy_group_op(uuid, text[], numeric[], numeric[], uuid, policy_type, date, payment_method, numeric, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_policy_group_op(uuid, text[], numeric[], numeric[], uuid, policy_type, date, payment_method, numeric, text, uuid) FROM anon, public;
