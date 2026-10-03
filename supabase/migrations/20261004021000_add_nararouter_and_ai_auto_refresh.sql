-- NaraRouter provider + automatic provider/model catalog refresh.
-- The refresh endpoint is protected by a random secret kept only in Supabase Vault.
-- Browser roles never receive the secret and cannot execute the server-config RPC.

ALTER TABLE public.ai_providers DROP CONSTRAINT IF EXISTS ai_providers_provider_check;
ALTER TABLE public.ai_providers
  ADD CONSTRAINT ai_providers_provider_check
  CHECK (provider IN ('openrouter', 'groq', 'cloudflare', 'ocrspace', 'gemini', 'nararouter'));

ALTER TABLE public.ai_provider_models DROP CONSTRAINT IF EXISTS ai_provider_models_provider_check;
ALTER TABLE public.ai_provider_models
  ADD CONSTRAINT ai_provider_models_provider_check
  CHECK (provider IN ('openrouter', 'groq', 'cloudflare', 'ocrspace', 'gemini', 'nararouter'));

INSERT INTO public.ai_providers (provider, display_name, enabled, priority, provider_type)
VALUES ('nararouter', 'NaraRouter', false, 5, 'ai')
ON CONFLICT (provider) DO UPDATE
SET display_name = EXCLUDED.display_name,
    provider_type = 'ai';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'crm_ai_refresh_secret'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'crm_ai_refresh_secret',
      'Shared secret used only by pg_cron to invoke ai-refresh-models'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_ai_refresh_server_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT COALESCE(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  FROM vault.decrypted_secrets
  WHERE name = 'crm_ai_refresh_secret';
$$;

REVOKE ALL ON FUNCTION public.get_ai_refresh_server_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ai_refresh_server_config() FROM anon;
REVOKE ALL ON FUNCTION public.get_ai_refresh_server_config() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_refresh_server_config() TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_ai_provider_refresh()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'crm_ai_refresh_secret'
   LIMIT 1;

  IF v_secret IS NULL OR length(v_secret) < 32 THEN
    RAISE EXCEPTION 'AI refresh secret is missing';
  END IF;

  SELECT net.http_post(
    url := 'https://mqprutudyyzghpiiopqo.supabase.co/functions/v1/ai-refresh-models',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-crm-ai-refresh-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_ai_provider_refresh() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_ai_provider_refresh() FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_ai_provider_refresh() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_ai_provider_refresh() TO service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'ai-provider-model-refresh';

SELECT cron.schedule(
  'ai-provider-model-refresh',
  '17 */6 * * *',
  $$SELECT public.enqueue_ai_provider_refresh();$$
);

COMMENT ON FUNCTION public.enqueue_ai_provider_refresh() IS
'Queues a protected Edge Function call that refreshes all configured AI/OCR providers and their cached model catalogs. Scheduled every 6 hours by pg_cron.';
