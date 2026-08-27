-- Web Push subscriptions and database-to-edge dispatch hook.
-- No existing notification business logic is changed; this only mirrors new rows
-- to the push sender when a user has opted in on a device.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    expiration_time bigint,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
    ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
    ON public.push_subscriptions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
    ON public.push_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own
    ON public.push_subscriptions FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
    ON public.push_subscriptions FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enqueue_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
    v_webhook_secret text;
BEGIN
    SELECT decrypted_secret
      INTO v_webhook_secret
      FROM vault.decrypted_secrets
     WHERE name = 'crm_push_webhook_secret'
     LIMIT 1;

    IF v_webhook_secret IS NULL OR length(v_webhook_secret) < 16 THEN
        RETURN NEW;
    END IF;

    PERFORM net.http_post(
        url := 'https://mqprutudyyzghpiiopqo.supabase.co/functions/v1/dispatch-push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-crm-push-secret', v_webhook_secret
        ),
        body := jsonb_build_object('notification_id', NEW.id),
        timeout_milliseconds := 2000
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Push dispatch enqueue failed: %', SQLERRM;
        RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_push_notification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_push_notification() FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_push_notification() FROM authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_push_notification ON public.notifications;
CREATE TRIGGER trg_enqueue_push_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_push_notification();
