import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crm-ai-refresh-secret",
};

type ProviderKey = "openrouter" | "groq" | "cloudflare" | "ocrspace" | "gemini" | "nararouter";

interface CachedModel {
  model_id: string;
  model_name: string | null;
  context_length: number | null;
}

interface ProviderRow {
  provider: ProviderKey;
  provider_type: "ai" | "ocr";
  api_key: string | null;
  account_id: string | null;
  default_model: string | null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchOpenRouter(apiKey: string): Promise<CachedModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data?.data) ? data.data : [])
    .filter((m: any) => {
      const p = m?.pricing?.prompt, c = m?.pricing?.completion;
      return (p === "0" || p === 0) && (c === "0" || c === 0);
    })
    .map((m: any) => ({ model_id: m.id, model_name: m.name ?? m.id, context_length: m.context_length ?? null }));
}

async function fetchGroq(apiKey: string): Promise<CachedModel[]> {
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data?.data) ? data.data : [])
    .filter((m: any) => typeof m?.id === "string")
    .map((m: any) => ({ model_id: m.id, model_name: m.id, context_length: m.context_window ?? null }));
}

async function fetchCloudflare(apiKey: string, accountId: string | null): Promise<CachedModel[]> {
  if (!accountId) throw new Error("Cloudflare Account ID غير موجود");
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Cloudflare AI HTTP ${res.status}`);
  const data = await res.json();
  if (data?.success === false) throw new Error(data?.errors?.[0]?.message || "Cloudflare AI error");
  return (Array.isArray(data?.result) ? data.result : [])
    .filter((m: any) => (m?.task?.name || "").toLowerCase().includes("text generation"))
    .map((m: any) => ({ model_id: m.name ?? m.id, model_name: m.description ?? m.name ?? m.id, context_length: null }));
}

async function fetchGemini(apiKey: string): Promise<CachedModel[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data?.models) ? data.models : [])
    .filter((m: any) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent") && !/embedding|aqa/i.test(m?.name || ""))
    .map((m: any) => ({
      model_id: String(m.name || "").replace(/^models\//, ""),
      model_name: m.displayName ?? m.name,
      context_length: m.inputTokenLimit ?? null,
    }));
}

async function fetchNaraRouter(apiKey: string): Promise<CachedModel[]> {
  const res = await fetch("https://router.bynara.id/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`NaraRouter HTTP ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data?.data) ? data.data : [])
    .filter((m: any) => typeof m?.id === "string" && m.id.trim())
    .map((m: any) => ({
      model_id: m.id,
      model_name: m.name ?? m.id,
      context_length: m.context_length ?? m.context_window ?? null,
    }));
}

const OCR_TEST_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAeCAIAAAD/+uoYAAABHklEQVR4nO3XIW6FMBjA8TIwxeAAxRFAP7UiQOLoAbgIEscBEOUCTbgBDiSXqGsCmmA6Qd7EAm+EvHZZ0p/6QtrkTwMkGEII8N98/HXAHTpaFR2tio5WRUer8jO66zqEEELIsqx9oJTato2e6roGAEzTlKZpHMdJkjDGDndJrBYnHMc5nHdRFDHGhBCUUozxi5UyWPdulXO+risAIMsy13XfeowXnN3N65Nu29b3/aIo+r4/2yXPpWgI4efTOI77xWVZCCFhGJZlebhLnjsnzTkfhuF79jzvbKUkdz55hmFgjBljAIB5noMgePcz+4tLL+K2bQihfX48HlVVNU2T5zmE0DRNQojEwCOG0H8uauhoVXS0KjpaFR2tio5W5Qu6b8cBll2PywAAAABJRU5ErkJggg==";

async function testOcrSpace(apiKey: string): Promise<void> {
  const params = new URLSearchParams();
  params.set("apikey", apiKey);
  params.set("base64Image", OCR_TEST_IMAGE);
  params.set("language", "eng");
  params.set("isOverlayRequired", "false");
  params.set("scale", "true");
  params.set("OCREngine", "1");
  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`OCR.Space HTTP ${res.status}`);
  const data = await res.json();
  if (data?.IsErroredOnProcessing && Number(data?.OCRExitCode) !== 1) {
    const msg = Array.isArray(data?.ErrorMessage) ? data.ErrorMessage.join(" ") : (data?.ErrorMessage || "OCR.Space error");
    throw new Error(msg);
  }
}

async function authorize(req: Request, adminClient: ReturnType<typeof createClient>): Promise<boolean> {
  const receivedCronSecret = req.headers.get("x-crm-ai-refresh-secret");
  const { data: cfg } = await adminClient.rpc("get_ai_refresh_server_config");
  const expectedCronSecret = cfg?.crm_ai_refresh_secret;
  if (receivedCronSecret && expectedCronSecret && receivedCronSecret === expectedCronSecret) return true;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;
  const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await callerClient.auth.getUser();
  if (!auth?.user) return false;
  const { data: profile } = await adminClient.from("users").select("role,is_active,deleted_at").eq("id", auth.user.id).maybeSingle();
  return !!profile && profile.role === "super_admin" && profile.is_active && !profile.deleted_at;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (!(await authorize(req, adminClient))) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: providers, error } = await adminClient
      .from("ai_providers")
      .select("provider,provider_type,api_key,account_id,default_model")
      .not("api_key", "is", null)
      .order("provider_type", { ascending: true })
      .order("priority", { ascending: true });

    if (error) throw error;

    const results: Array<{ provider: string; success: boolean; models: number; error?: string }> = [];
    const now = new Date().toISOString();

    for (const row of (providers || []) as ProviderRow[]) {
      try {
        let models: CachedModel[] = [];
        if (row.provider === "ocrspace") {
          await testOcrSpace(row.api_key!);
        } else if (row.provider === "openrouter") {
          models = await fetchOpenRouter(row.api_key!);
        } else if (row.provider === "groq") {
          models = await fetchGroq(row.api_key!);
        } else if (row.provider === "cloudflare") {
          models = await fetchCloudflare(row.api_key!, row.account_id);
        } else if (row.provider === "gemini") {
          models = await fetchGemini(row.api_key!);
        } else if (row.provider === "nararouter") {
          models = await fetchNaraRouter(row.api_key!);
        }

        const available = models.slice(0, 100);
        const keepDefault = row.default_model && available.some((m) => m.model_id === row.default_model);
        const nextDefault = keepDefault ? row.default_model : (available[0]?.model_id ?? null);

        await adminClient.from("ai_providers").update({
          status: "active",
          last_error: null,
          last_tested_at: now,
          default_model: row.provider_type === "ai" ? nextDefault : null,
        }).eq("provider", row.provider);

        if (row.provider_type === "ai") {
          await adminClient.from("ai_provider_models").delete().eq("provider", row.provider);
          if (available.length) {
            const { error: insertError } = await adminClient.from("ai_provider_models").insert(
              available.map((m) => ({
                provider: row.provider,
                model_id: m.model_id,
                model_name: m.model_name,
                context_length: m.context_length,
                is_free: true,
                fetched_at: now,
              }))
            );
            if (insertError) throw insertError;
          }
        }
        results.push({ provider: row.provider, success: true, models: available.length });
      } catch (providerError) {
        const message = providerError instanceof Error ? providerError.message : "Unknown error";
        await adminClient.from("ai_providers").update({
          status: "error",
          last_error: message.slice(0, 500),
          last_tested_at: now,
        }).eq("provider", row.provider);
        results.push({ provider: row.provider, success: false, models: 0, error: message });
      }
    }

    await adminClient.from("ai_settings").update({ models_updated_at: now }).not("id", "is", null);
    return jsonResponse({
      success: true,
      refreshed_at: now,
      providers_total: results.length,
      providers_ok: results.filter((r) => r.success).length,
      providers_failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
