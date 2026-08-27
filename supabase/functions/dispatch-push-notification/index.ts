import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const jsonHeaders = { "Content-Type": "application/json" };

type PushConfig = {
  crm_vapid_public_jwk?: string;
  crm_vapid_private_jwk?: string;
  crm_push_webhook_secret?: string;
  crm_vapid_contact?: string;
};

type DispatchPayload = {
  notification_id?: string;
};

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function getNotificationUrl(entityType: string | null, entityId: string | null): string {
  if (!entityId && entityType !== "monthly_closing") return "/";
  switch (entityType) {
    case "policy":
      return entityId ? `/policies/${entityId}` : "/policies";
    case "customer":
      return "/customers";
    case "installment":
      return "/collection";
    case "user":
      return "/users";
    case "monthly_closing":
      return "/monthly-closing";
    default:
      return "/";
  }
}

function isExpiredSubscriptionError(error: unknown): boolean {
  return error instanceof webpush.PushMessageError
    && (error.response.status === 404 || error.response.status === 410);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const payload = await req.json() as DispatchPayload;
    if (!payload.notification_id) return response({ error: "notification_id is required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return response({ error: "Server configuration is incomplete" }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const receivedSecret = req.headers.get("x-crm-push-secret");
    const { data: config, error: configError } = await admin.rpc("get_web_push_server_config");
    if (configError) throw configError;
    const pushConfig = (config ?? {}) as PushConfig;
    if (!pushConfig.crm_push_webhook_secret || !receivedSecret || receivedSecret !== pushConfig.crm_push_webhook_secret) {
      return response({ error: "Unauthorized" }, 401);
    }
    if (!pushConfig.crm_vapid_public_jwk || !pushConfig.crm_vapid_private_jwk || !pushConfig.crm_vapid_contact) {
      throw new Error("Web Push VAPID configuration is incomplete");
    }

    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id, user_id, title, message, entity_type, entity_id")
      .eq("id", payload.notification_id)
      .maybeSingle();

    if (notificationError) throw notificationError;
    if (!notification) return response({ ok: true, skipped: "notification_not_found" });

    const vapidKeys = await webpush.importVapidKeys({
      publicKey: JSON.parse(pushConfig.crm_vapid_public_jwk),
      privateKey: JSON.parse(pushConfig.crm_vapid_private_jwk),
    });
    const applicationServer = await webpush.ApplicationServer.new({
      contactInformation: pushConfig.crm_vapid_contact,
      vapidKeys,
    });

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notification.user_id)
      .limit(50);

    if (subscriptionsError) throw subscriptionsError;
    if (!subscriptions?.length) return response({ ok: true, sent: 0 });

    const message = JSON.stringify({
      title: notification.title,
      body: notification.message,
      notification_id: notification.id,
      url: getNotificationUrl(notification.entity_type, notification.entity_id),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `crm-notification-${notification.id}`,
    });

    let sent = 0;
    let removed = 0;
    for (const subscription of subscriptions) {
      try {
        const subscriber = applicationServer.subscribe({
          endpoint: subscription.endpoint,
          keys: { auth: subscription.auth, p256dh: subscription.p256dh },
        });
        await subscriber.pushTextMessage(message, {
          urgency: webpush.Urgency.High,
          ttl: 86400,
        });
        sent += 1;
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
          removed += 1;
        } else {
          console.error("Push delivery failed", subscription.id, error);
        }
      }
    }

    return response({ ok: true, sent, removed });
  } catch (error) {
    console.error("Push dispatch failed", error);
    return response({ error: "Push dispatch failed" }, 500);
  }
});
