-- Read-only pagination of display groups. Existing table RLS remains authoritative.
CREATE OR REPLACE FUNCTION public.get_collection_page(
  p_filter text, p_sub_type text, p_page integer, p_search text,
  p_branch_id uuid, p_owner_id uuid, p_month date
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_owners uuid[];
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_filter NOT IN ('month','overdue','paid') OR p_filter IS NULL
     OR p_sub_type NOT IN ('all','new','periodic') OR p_sub_type IS NULL
     OR p_page IS NULL OR p_page < 1 OR p_month IS NULL THEN
    RAISE EXCEPTION 'Invalid collection filters';
  END IF;
  IF p_owner_id IS NOT NULL THEN
    v_owners := CASE WHEN p_branch_id IS NULL
      THEN public.get_user_subtree(p_owner_id)
      ELSE public.get_user_subtree_branch_aware(p_owner_id, p_branch_id) END;
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT i.id, i.policy_id, i.due_date,
      CASE WHEN p.policy_type = 'protection_investment'
        AND p.customer_id IS NOT NULL AND p.owner_id IS NOT NULL AND p.start_date IS NOT NULL
        THEN 'group:' || p.customer_id || ':' || p.owner_id || ':' || p.start_date || ':' || i.due_date
        ELSE 'single:' || i.id END AS group_key
    FROM public.installments i
    JOIN public.policies p ON p.id = i.policy_id
    LEFT JOIN public.customers c ON c.id = p.customer_id
    LEFT JOIN public.users u ON u.id = p.owner_id
    WHERE p.status <> 'cancelled'
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (p_owner_id IS NULL OR p.owner_id = ANY(v_owners))
      AND (p_sub_type = 'all' OR i.is_first = (p_sub_type = 'new'))
      AND (coalesce(trim(p_search), '') = ''
        OR p.policy_number ILIKE '%' || trim(p_search) || '%'
        OR c.name ILIKE '%' || trim(p_search) || '%'
        OR c.phone ILIKE '%' || trim(p_search) || '%'
        OR c.national_id ILIKE '%' || trim(p_search) || '%'
        OR u.name ILIKE '%' || trim(p_search) || '%')
      AND (
        (p_filter = 'month' AND i.status = 'pending'
          AND i.due_date >= v_month AND i.due_date < v_month + interval '1 month')
        OR (p_filter = 'overdue' AND i.status IN ('pending','overdue')
          AND i.due_date >= v_month - interval '2 months' AND i.due_date < v_month)
        OR (p_filter = 'paid' AND i.status = 'paid' AND EXISTS (
          SELECT 1 FROM public.payments pay WHERE pay.installment_id = i.id
            AND pay.payment_month = v_month AND pay.is_cancelled = false))
      )
  ), groups AS MATERIALIZED (
    SELECT group_key, min(due_date) AS due_date FROM matched GROUP BY group_key
  ), page_groups AS (
    SELECT group_key FROM groups ORDER BY due_date, group_key
    LIMIT 10 OFFSET ((p_page::bigint - 1) * 10)
  ), page_rows AS MATERIALIZED (
    SELECT m.* FROM matched m JOIN page_groups g USING (group_key)
  ), paid_counts AS (
    SELECT i.policy_id, count(*) AS paid_count FROM public.installments i
    WHERE i.status = 'paid' AND i.policy_id IN (SELECT policy_id FROM page_rows)
    GROUP BY i.policy_id
  )
  SELECT jsonb_build_object(
    'totalCount', (SELECT count(*) FROM groups),
    'totalPages', greatest(1, (SELECT ceil(count(*) / 10.0)::integer FROM groups)),
    'installments', coalesce((
      SELECT jsonb_agg(to_jsonb(i) || jsonb_build_object(
        'policy', to_jsonb(p) || jsonb_build_object(
          'customer', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name', c.name, 'phone', c.phone, 'national_id', c.national_id) END,
          'owner', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('name', u.name) END),
        'paid_installments_count', coalesce(pc.paid_count, 0))
        ORDER BY r.due_date, r.group_key, i.id)
      FROM page_rows r
      JOIN public.installments i ON i.id = r.id
      JOIN public.policies p ON p.id = i.policy_id
      LEFT JOIN public.customers c ON c.id = p.customer_id
      LEFT JOIN public.users u ON u.id = p.owner_id
      LEFT JOIN paid_counts pc ON pc.policy_id = i.policy_id
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_collection_page(text,text,integer,text,uuid,uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_collection_page(text,text,integer,text,uuid,uuid,date) TO authenticated;
