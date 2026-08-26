-- إصلاح فشل حفظ الوثيقة بعد قفل صلاحيات الدوال الداخلية.
-- create_policy_op هو نقطة الدخول الوحيدة من الواجهة، لذلك يعمل SECURITY DEFINER
-- ويستدعي الدوال الداخلية المقفولة، مع إبقاء تحقق المالك والعميل داخل شجرة المستخدم.

CREATE OR REPLACE FUNCTION public.create_policy_op(
    p_operation_id uuid,
    p_policy_number text,
    p_customer_id uuid,
    p_policy_type policy_type,
    p_start_date date,
    p_payment_method payment_method,
    p_premium_amount numeric,
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
  v_policy_id uuid;
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'يجب تسجيل الدخول قبل إصدار الوثيقة';
  END IF;

  IF p_owner_id IS NULL OR NOT (p_owner_id = ANY(get_user_subtree(v_actor_id))) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ليس لديك صلاحية إصدار وثيقة لهذا الوكيل';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM customers
    WHERE id = p_customer_id AND owner_id = p_owner_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'العميل غير تابع للوكيل المحدد أو ليس لديك صلاحية الوصول إليه';
  END IF;

  SELECT * INTO v_existing FROM sync_operations WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.status = 'success' THEN
      RETURN v_existing.result;
    ELSE
      RETURN jsonb_build_object('error', COALESCE(v_existing.error_message, 'فشلت العملية سابقاً'));
    END IF;
  END IF;

  BEGIN
    INSERT INTO policies (policy_number, customer_id, policy_type, start_date, payment_method, premium_amount, sum_assured, notes, owner_id)
    VALUES (p_policy_number, p_customer_id, p_policy_type, p_start_date, p_payment_method, p_premium_amount, p_sum_assured, p_notes, p_owner_id)
    RETURNING id INTO v_policy_id;

    PERFORM generate_installments(v_policy_id, p_start_date, p_payment_method, p_premium_amount);
    PERFORM mark_historical_installments_paid(v_policy_id, v_actor_id);
    PERFORM log_activity('policy_create'::action_type, 'policy', v_policy_id);

    INSERT INTO sync_operations (operation_id, operation_type, entity_type, entity_id, user_id, status, result)
    VALUES (p_operation_id, 'create_policy', 'policy', v_policy_id, v_actor_id, 'success',
            jsonb_build_object('policy_id', v_policy_id))
    ON CONFLICT (operation_id) DO NOTHING;

    RETURN jsonb_build_object('policy_id', v_policy_id);
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO sync_operations (operation_id, operation_type, entity_type, entity_id, user_id, status, error_message)
      VALUES (p_operation_id, 'create_policy', 'policy', NULL, v_actor_id, 'conflict', 'رقم الوثيقة مستخدم بالفعل')
      ON CONFLICT (operation_id) DO NOTHING;
      RETURN jsonb_build_object('conflict', true, 'error', 'رقم الوثيقة مستخدم بالفعل');
    WHEN OTHERS THEN
      INSERT INTO sync_operations (operation_id, operation_type, entity_type, entity_id, user_id, status, error_message)
      VALUES (p_operation_id, 'create_policy', 'policy', NULL, v_actor_id, 'failed', SQLERRM)
      ON CONFLICT (operation_id) DO NOTHING;
      RAISE;
  END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_policy_op(uuid, text, uuid, policy_type, date, payment_method, numeric, numeric, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_policy_op(uuid, text, uuid, policy_type, date, payment_method, numeric, numeric, text, uuid) TO authenticated;
