-- Expose Web Push secrets only to the service_role used by the dispatcher.
-- Browser roles receive no EXECUTE privilege on this function.

CREATE OR REPLACE FUNCTION public.get_web_push_server_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
    SELECT COALESCE(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
      FROM vault.decrypted_secrets
     WHERE name IN (
         'crm_vapid_public_jwk',
         'crm_vapid_private_jwk',
         'crm_push_webhook_secret',
         'crm_vapid_contact'
     );
$$;

REVOKE ALL ON FUNCTION public.get_web_push_server_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_web_push_server_config() FROM anon;
REVOKE ALL ON FUNCTION public.get_web_push_server_config() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_web_push_server_config() TO service_role;
