-- Smart, branch-aware data import wrapper.
-- Keeps the mature import_policy_row business logic intact, but validates the
-- selected agent by ID inside the current branch/hierarchy and pins the created
-- policy to that branch.

CREATE OR REPLACE FUNCTION public.import_policy_row_v2(
    p_customer_name text,
    p_national_id text,
    p_phone text,
    p_address text,
    p_birth_date date,
    p_occupation text,
    p_marital_status text,
    p_agent_name text,
    p_agent_id uuid,
    p_policy_number text,
    p_policy_type text,
    p_sum_assured numeric,
    p_premium_amount numeric,
    p_payment_method text,
    p_start_date date,
    p_notes text,
    p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_agent_id uuid;
    v_agent_name text;
    v_result jsonb;
    v_policy_id uuid;
    v_result_agent_id uuid;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول';
    END IF;

    IF p_branch_id IS NOT NULL
       AND NOT (v_caller_id = ANY(public.get_user_subtree_branch_aware(v_caller_id, p_branch_id))) THEN
        RAISE EXCEPTION 'ليس لديك صلاحية الاستيراد إلى الفرع المحدد';
    END IF;

    IF p_agent_id IS NOT NULL THEN
        SELECT u.id, u.name
          INTO v_agent_id, v_agent_name
          FROM public.users u
         WHERE u.id = p_agent_id
           AND u.is_active = true
           AND u.deleted_at IS NULL
           AND u.role IN ('agent', 'premium_agent')
           AND u.id = ANY(
             CASE
               WHEN p_branch_id IS NULL THEN public.get_user_subtree(v_caller_id)
               ELSE public.get_user_subtree_branch_aware(v_caller_id, p_branch_id)
             END
           )
           AND (
             p_branch_id IS NULL
             OR EXISTS (
               SELECT 1
                 FROM public.user_branch_roles ubr
                WHERE ubr.user_id = u.id
                  AND ubr.branch_id = p_branch_id
             )
           )
         LIMIT 1;
    ELSE
        SELECT u.id, u.name
          INTO v_agent_id, v_agent_name
          FROM public.users u
         WHERE btrim(lower(u.name)) = btrim(lower(p_agent_name))
           AND u.is_active = true
           AND u.deleted_at IS NULL
           AND u.role IN ('agent', 'premium_agent')
           AND u.id = ANY(
             CASE
               WHEN p_branch_id IS NULL THEN public.get_user_subtree(v_caller_id)
               ELSE public.get_user_subtree_branch_aware(v_caller_id, p_branch_id)
             END
           )
           AND (
             p_branch_id IS NULL
             OR EXISTS (
               SELECT 1
                 FROM public.user_branch_roles ubr
                WHERE ubr.user_id = u.id
                  AND ubr.branch_id = p_branch_id
             )
           )
         ORDER BY u.created_at
         LIMIT 1;
    END IF;

    IF v_agent_id IS NULL THEN
        RAISE EXCEPTION 'الوكيل المحدد غير متاح ضمن فريقك في الفرع الحالي';
    END IF;

    v_result := public.import_policy_row(
        p_customer_name,
        p_national_id,
        p_phone,
        p_address,
        p_birth_date,
        p_occupation,
        p_marital_status,
        v_agent_name,
        p_policy_number,
        p_policy_type,
        p_sum_assured,
        p_premium_amount,
        p_payment_method,
        p_start_date,
        p_notes
    );

    v_result_agent_id := NULLIF(v_result->>'agent_id', '')::uuid;
    IF v_result_agent_id IS DISTINCT FROM v_agent_id THEN
        RAISE EXCEPTION 'يوجد أكثر من وكيل بنفس الاسم؛ اختر الوكيل من القائمة لتحديده بدقة';
    END IF;

    v_policy_id := NULLIF(v_result->>'policy_id', '')::uuid;
    IF p_branch_id IS NOT NULL AND v_policy_id IS NOT NULL THEN
        UPDATE public.policies
           SET branch_id = p_branch_id
         WHERE id = v_policy_id
           AND owner_id = v_agent_id;
    END IF;

    RETURN v_result || jsonb_build_object(
        'branch_id', p_branch_id,
        'agent_id', v_agent_id,
        'agent_name', v_agent_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.import_policy_row_v2(
    text,text,text,text,date,text,text,text,uuid,text,text,numeric,numeric,text,date,text,uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_policy_row_v2(
    text,text,text,text,date,text,text,text,uuid,text,text,numeric,numeric,text,date,text,uuid
) TO authenticated, service_role;

COMMENT ON FUNCTION public.import_policy_row_v2(
    text,text,text,text,date,text,text,text,uuid,text,text,numeric,numeric,text,date,text,uuid
) IS 'Branch-aware import wrapper: validates the selected agent by ID/hierarchy, reuses import_policy_row business rules, and pins the new policy to the selected branch.';
