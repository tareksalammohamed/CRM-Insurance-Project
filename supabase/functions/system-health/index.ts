import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) return json({ error: "غير مصرح" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: auth, error: authError } = await callerClient.auth.getUser();
    if (authError || !auth?.user) return json({ error: "جلسة غير صالحة" }, 401);

    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("role,is_active,deleted_at")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "super_admin" ||
      !profile.is_active ||
      profile.deleted_at
    ) {
      return json({ error: "غير مصرح: هذه الصفحة للمشرف الأعلى فقط" }, 403);
    }

    const [{ data, error }, { data: usage, error: usageError }] = await Promise.all([
      adminClient.rpc("get_system_health", {
        p_caller_id: auth.user.id,
      }),
      adminClient.rpc("get_ai_usage_summary", {
        p_caller_id: auth.user.id,
        p_days: 31,
      }),
    ]);

    if (error) throw error;
    if (usageError) throw usageError;

    return json({
      success: true,
      data: {
        ...data,
        ai: {
          ...(data?.ai || {}),
          usage,
        },
      },
    });
  } catch (err) {
    return json(
      { success: false, error: err instanceof Error ? err.message : "تعذر تحميل حالة النظام" },
      500
    );
  }
});
