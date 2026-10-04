-- AI usage accounting: actual application-side request/token telemetry.
-- This records only calls made through ai-gateway. Token counters are populated
-- when the upstream provider returns official usage metadata.

CREATE TABLE IF NOT EXISTS public.ai_provider_usage_daily (
  usage_date date NOT NULL DEFAULT current_date,
  provider text NOT NULL REFERENCES public.ai_providers(provider) ON DELETE CASCADE,
  model text NOT NULL,
  purpose text NOT NULL DEFAULT 'general',
  request_count bigint NOT NULL DEFAULT 0,
  success_count bigint NOT NULL DEFAULT 0,
  failure_count bigint NOT NULL DEFAULT 0,
  capacity_error_count bigint NOT NULL DEFAULT 0,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  latency_ms_sum bigint NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usage_date, provider, model, purpose)
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_daily_provider_date
  ON public.ai_provider_usage_daily(provider, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_daily_date
  ON public.ai_provider_usage_daily(usage_date DESC);

ALTER TABLE public.ai_provider_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_provider_usage_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_provider_usage_daily TO service_role;

DROP POLICY IF EXISTS ai_provider_usage_no_client_access ON public.ai_provider_usage_daily;
CREATE POLICY ai_provider_usage_no_client_access
  ON public.ai_provider_usage_daily FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.record_ai_provider_usage(
  p_provider text,
  p_model text,
  p_purpose text,
  p_success boolean,
  p_capacity_error boolean DEFAULT false,
  p_prompt_tokens bigint DEFAULT 0,
  p_completion_tokens bigint DEFAULT 0,
  p_total_tokens bigint DEFAULT 0,
  p_latency_ms integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_provider_usage_daily (
    usage_date, provider, model, purpose,
    request_count, success_count, failure_count, capacity_error_count,
    prompt_tokens, completion_tokens, total_tokens, latency_ms_sum, last_used_at
  )
  VALUES (
    current_date,
    p_provider,
    COALESCE(NULLIF(p_model, ''), 'unknown'),
    COALESCE(NULLIF(p_purpose, ''), 'general'),
    1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    CASE WHEN p_capacity_error THEN 1 ELSE 0 END,
    GREATEST(COALESCE(p_prompt_tokens, 0), 0),
    GREATEST(COALESCE(p_completion_tokens, 0), 0),
    GREATEST(COALESCE(p_total_tokens, 0), 0),
    GREATEST(COALESCE(p_latency_ms, 0), 0),
    now()
  )
  ON CONFLICT (usage_date, provider, model, purpose)
  DO UPDATE SET
    request_count = public.ai_provider_usage_daily.request_count + 1,
    success_count = public.ai_provider_usage_daily.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    failure_count = public.ai_provider_usage_daily.failure_count + CASE WHEN p_success THEN 0 ELSE 1 END,
    capacity_error_count = public.ai_provider_usage_daily.capacity_error_count + CASE WHEN p_capacity_error THEN 1 ELSE 0 END,
    prompt_tokens = public.ai_provider_usage_daily.prompt_tokens + GREATEST(COALESCE(p_prompt_tokens, 0), 0),
    completion_tokens = public.ai_provider_usage_daily.completion_tokens + GREATEST(COALESCE(p_completion_tokens, 0), 0),
    total_tokens = public.ai_provider_usage_daily.total_tokens + GREATEST(COALESCE(p_total_tokens, 0), 0),
    latency_ms_sum = public.ai_provider_usage_daily.latency_ms_sum + GREATEST(COALESCE(p_latency_ms, 0), 0),
    last_used_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_provider_usage(
  text,text,text,boolean,boolean,bigint,bigint,bigint,integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_provider_usage(
  text,text,text,boolean,boolean,bigint,bigint,bigint,integer
) TO service_role;

CREATE OR REPLACE FUNCTION public.get_ai_usage_summary(
  p_caller_id uuid,
  p_days integer DEFAULT 31
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := current_date - (LEAST(GREATEST(COALESCE(p_days, 31), 1), 365) - 1);
  v_result jsonb;
BEGIN
  IF p_caller_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_caller_id
      AND role = 'super_admin'
      AND is_active = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  SELECT jsonb_build_object(
    'from_date', v_from,
    'to_date', current_date,
    'today', jsonb_build_object(
      'requests', COALESCE(sum(request_count) FILTER (WHERE usage_date = current_date), 0),
      'successes', COALESCE(sum(success_count) FILTER (WHERE usage_date = current_date), 0),
      'failures', COALESCE(sum(failure_count) FILTER (WHERE usage_date = current_date), 0),
      'capacity_errors', COALESCE(sum(capacity_error_count) FILTER (WHERE usage_date = current_date), 0),
      'prompt_tokens', COALESCE(sum(prompt_tokens) FILTER (WHERE usage_date = current_date), 0),
      'completion_tokens', COALESCE(sum(completion_tokens) FILTER (WHERE usage_date = current_date), 0),
      'total_tokens', COALESCE(sum(total_tokens) FILTER (WHERE usage_date = current_date), 0)
    ),
    'period', jsonb_build_object(
      'requests', COALESCE(sum(request_count), 0),
      'successes', COALESCE(sum(success_count), 0),
      'failures', COALESCE(sum(failure_count), 0),
      'capacity_errors', COALESCE(sum(capacity_error_count), 0),
      'prompt_tokens', COALESCE(sum(prompt_tokens), 0),
      'completion_tokens', COALESCE(sum(completion_tokens), 0),
      'total_tokens', COALESCE(sum(total_tokens), 0)
    ),
    'providers', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.requests DESC, x.provider)
      FROM (
        SELECT
          provider,
          sum(request_count)::bigint AS requests,
          sum(success_count)::bigint AS successes,
          sum(failure_count)::bigint AS failures,
          sum(capacity_error_count)::bigint AS capacity_errors,
          sum(prompt_tokens)::bigint AS prompt_tokens,
          sum(completion_tokens)::bigint AS completion_tokens,
          sum(total_tokens)::bigint AS total_tokens,
          round(
            CASE WHEN sum(request_count) > 0
              THEN (sum(latency_ms_sum)::numeric / sum(request_count))
              ELSE 0 END
          )::bigint AS avg_latency_ms,
          max(last_used_at) AS last_used_at
        FROM public.ai_provider_usage_daily
        WHERE usage_date >= v_from
        GROUP BY provider
      ) x
    ), '[]'::jsonb),
    'models', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.requests DESC, x.provider, x.model)
      FROM (
        SELECT
          provider,
          model,
          sum(request_count)::bigint AS requests,
          sum(success_count)::bigint AS successes,
          sum(failure_count)::bigint AS failures,
          sum(capacity_error_count)::bigint AS capacity_errors,
          sum(total_tokens)::bigint AS total_tokens,
          round(
            CASE WHEN sum(request_count) > 0
              THEN (sum(latency_ms_sum)::numeric / sum(request_count))
              ELSE 0 END
          )::bigint AS avg_latency_ms,
          max(last_used_at) AS last_used_at
        FROM public.ai_provider_usage_daily
        WHERE usage_date >= v_from
        GROUP BY provider, model
        ORDER BY requests DESC
        LIMIT 50
      ) x
    ), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.usage_date)
      FROM (
        SELECT
          usage_date,
          sum(request_count)::bigint AS requests,
          sum(success_count)::bigint AS successes,
          sum(failure_count)::bigint AS failures,
          sum(capacity_error_count)::bigint AS capacity_errors,
          sum(total_tokens)::bigint AS total_tokens
        FROM public.ai_provider_usage_daily
        WHERE usage_date >= v_from
        GROUP BY usage_date
      ) x
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.ai_provider_usage_daily
  WHERE usage_date >= v_from;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_usage_summary(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_usage_summary(uuid, integer)
  TO service_role;
