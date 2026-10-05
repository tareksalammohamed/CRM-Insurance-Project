-- Run inside a transaction after the migration; always ROLLBACK afterwards.
-- Exercises actual RLS roles without changing business data.
CREATE TEMP TABLE collection_test_results (cases integer, rows_checked integer);
DO $$
DECLARE
  actor record; scope record; mode text; subtype text; month_date date;
  expected_ids uuid[]; actual_ids uuid[]; expected_count integer;
  response jsonb; item jsonb; pg integer; cases integer := 0; checked integer := 0;
BEGIN
  FOR actor IN SELECT DISTINCT ON (role) id, role FROM public.users WHERE is_active ORDER BY role, id LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', actor.id, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    FOR scope IN SELECT NULL::uuid branch_id, NULL::uuid owner_id, ''::text search
      UNION ALL SELECT NULL, actor.id, ''
      UNION ALL SELECT NULL, NULL, 'ا'
      UNION ALL SELECT (SELECT branch_id FROM public.policies WHERE branch_id IS NOT NULL LIMIT 1), NULL, ''
    LOOP
    FOREACH month_date IN ARRAY ARRAY[date '2026-10-01', date '2026-09-01'] LOOP
      FOREACH mode IN ARRAY ARRAY['month','overdue','paid'] LOOP
        FOREACH subtype IN ARRAY ARRAY['all','new','periodic'] LOOP
          SELECT coalesce(array_agg(i.id ORDER BY i.id), ARRAY[]::uuid[]),
            count(DISTINCT CASE WHEN p.policy_type = 'protection_investment' AND p.customer_id IS NOT NULL AND p.owner_id IS NOT NULL AND p.start_date IS NOT NULL
              THEN p.customer_id || ':' || p.owner_id || ':' || p.start_date || ':' || i.due_date ELSE i.id::text END)
          INTO expected_ids, expected_count
          FROM public.installments i JOIN public.policies p ON p.id=i.policy_id
          LEFT JOIN public.customers c ON c.id=p.customer_id
          LEFT JOIN public.users u ON u.id=p.owner_id
          WHERE p.status <> 'cancelled'
            AND (scope.branch_id IS NULL OR p.branch_id=scope.branch_id)
            AND (scope.owner_id IS NULL OR p.owner_id=ANY(public.get_user_subtree(scope.owner_id)))
            AND (scope.search='' OR p.policy_number ILIKE '%'||scope.search||'%' OR c.name ILIKE '%'||scope.search||'%' OR c.phone ILIKE '%'||scope.search||'%' OR c.national_id ILIKE '%'||scope.search||'%' OR u.name ILIKE '%'||scope.search||'%')
            AND (subtype='all' OR i.is_first=(subtype='new'))
            AND ((mode='month' AND i.status='pending' AND i.due_date >= month_date AND i.due_date < month_date + interval '1 month')
              OR (mode='overdue' AND i.status IN ('pending','overdue') AND i.due_date >= month_date - interval '2 months' AND i.due_date < month_date)
              OR (mode='paid' AND i.status='paid' AND EXISTS (SELECT 1 FROM public.payments py WHERE py.installment_id=i.id AND py.payment_month=month_date AND py.is_cancelled=false)));
          actual_ids := ARRAY[]::uuid[];
          FOR pg IN 1..greatest(1,ceil(expected_count/10.0)::integer) LOOP
            response := public.get_collection_page(mode,subtype,pg,scope.search,scope.branch_id,scope.owner_id,month_date);
            IF (response->>'totalCount')::integer <> expected_count OR (response->>'totalPages')::integer <> greatest(1,ceil(expected_count/10.0)::integer) THEN
              RAISE EXCEPTION 'Count mismatch: %, %, %',actor.role,mode,subtype;
            END IF;
            FOR item IN SELECT value FROM jsonb_array_elements(response->'installments') LOOP
              actual_ids := array_append(actual_ids,(item->>'id')::uuid);
              IF (item->>'paid_installments_count')::integer <> (SELECT count(*) FROM public.installments WHERE policy_id=(item->>'policy_id')::uuid AND status='paid') THEN
                RAISE EXCEPTION 'Paid count mismatch';
              END IF;
            END LOOP;
          END LOOP;
          SELECT coalesce(array_agg(x ORDER BY x),ARRAY[]::uuid[]) INTO actual_ids FROM unnest(actual_ids) x;
          IF actual_ids <> expected_ids THEN RAISE EXCEPTION 'Rows mismatch: %, %, %',actor.role,mode,subtype; END IF;
          cases := cases + 1; checked := checked + cardinality(actual_ids);
          response := public.get_collection_page(mode,subtype,100000,'',NULL,NULL,month_date);
          IF jsonb_array_length(response->'installments') <> 0 THEN RAISE EXCEPTION 'Out-of-range page not empty'; END IF;
        END LOOP;
      END LOOP;
    END LOOP;
    END LOOP;
    EXECUTE 'RESET ROLE';
  END LOOP;
  INSERT INTO collection_test_results VALUES(cases,checked);
END $$;
SELECT * FROM collection_test_results;
