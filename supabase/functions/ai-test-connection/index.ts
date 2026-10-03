// Edge Function: ai-test-connection
// يختبر الاتصال بمزود ذكاء اصطناعي واحد (OpenRouter / Groq / Cloudflare AI)
// أو بمزود OCR واحد (OCR.Space)، باستخدام المفتاح المحفوظ فعلياً فى قاعدة
// البيانات (لا يُستقبل أي مفتاح من الفرونت إند مباشرة — القراءة والكتابة على
// المفتاح تتم فقط من هنا بصلاحية service_role، فلا يخرج المفتاح للمتصفح
// إطلاقاً).
//
// عند نجاح الاختبار: يجلب قائمة النماذج المجانية المتاحة لهذا المزود (لمزودي
// AI فقط — مزودو OCR لا يملكون قائمة نماذج)، ويحدّث كاش ai_provider_models +
// ai_settings.models_updated_at + يختار أول نموذج مجاني كـ default_model
// للمزود.
//
// لإضافة مزود جديد (AI أو OCR) مستقبلاً: أضف دالة test<Provider> جديدة +
// سجّلها فى TEST_HANDLERS أدناه فقط، دون أي تعديل فى منطق التحقق من الصلاحية
// أو تحديث قاعدة البيانات.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProviderKey = "openrouter" | "groq" | "cloudflare" | "ocrspace" | "gemini" | "nararouter" | "requesty";

const KNOWN_PROVIDERS: ProviderKey[] = ["openrouter", "groq", "cloudflare", "ocrspace", "gemini", "nararouter", "requesty"];

interface FreeModel {
  model_id: string;
  model_name: string | null;
  context_length: number | null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function testOpenRouter(apiKey: string): Promise<{ models: FreeModel[] }> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("مفتاح OpenRouter غير صحيح أو منتهي الصلاحية");
  }
  if (!res.ok) {
    throw new Error(`تعذر الاتصال بـ OpenRouter (HTTP ${res.status})`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : [];
  const free = list.filter((m: any) => {
    const prompt = m?.pricing?.prompt;
    const completion = m?.pricing?.completion;
    return (prompt === "0" || prompt === 0) && (completion === "0" || completion === 0);
  });
  return {
    models: free.map((m: any) => ({
      model_id: m.id,
      model_name: m.name ?? m.id,
      context_length: m.context_length ?? null,
    })),
  };
}

async function testGroq(apiKey: string): Promise<{ models: FreeModel[] }> {
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("مفتاح Groq غير صحيح أو منتهي الصلاحية");
  }
  if (!res.ok) {
    throw new Error(`تعذر الاتصال بـ Groq (HTTP ${res.status})`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : [];
  // كل نماذج Groq متاحة ضمن الحصة المجانية للحساب
  return {
    models: list.map((m: any) => ({
      model_id: m.id,
      model_name: m.id,
      context_length: m.context_window ?? null,
    })),
  };
}

async function testNaraRouter(apiKey: string): Promise<{ models: FreeModel[] }> {
  const res = await fetch("https://router.bynara.id/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const raw = await res.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

  if (res.status === 401) {
    throw new Error("مفتاح NaraRouter غير صحيح أو منتهي الصلاحية");
  }
  if (res.status === 403) {
    const providerMessage = data?.error?.message || data?.message;
    throw new Error(providerMessage
      ? `NaraRouter رفض الوصول للحساب: ${providerMessage}`
      : "NaraRouter رفض الوصول للحساب (403) — راجع متطلبات الحساب والخطة من إعدادات NaraRouter");
  }
  if (!res.ok) {
    const providerMessage = data?.error?.message || data?.message;
    throw new Error(providerMessage
      ? `تعذر الاتصال بـ NaraRouter (HTTP ${res.status}): ${providerMessage}`
      : `تعذر الاتصال بـ NaraRouter (HTTP ${res.status})`);
  }
  const list = Array.isArray(data?.data) ? data.data : [];
  return {
    models: list
      .filter((m: any) => typeof m?.id === "string" && m.id.trim())
      .map((m: any) => ({
        model_id: m.id,
        model_name: m.name ?? m.id,
        context_length: m.context_length ?? m.context_window ?? null,
      })),
  };
}


const REQUESTY_FREE_MODEL_IDS = new Set([
  "google/gemma-4-31b-it",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "meta/muse-glimmer-30b",
  "inclusionai/iling-3.0-tiny",
  "nvidia/nemotron-3.5-content-safety",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "poolside/laguna-m.1",
  "poolside/laguna-xs.2",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "mistral/leanstral-1-5",
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nemotron-3-nano-30b-a3b",
]);

function isRequestyFreeModel(model: any): boolean {
  const id = String(model?.id || "");
  const shortId = id.split("/").pop() || id;
  const knownFree = [...REQUESTY_FREE_MODEL_IDS].some((freeId) =>
    freeId === id || freeId.split("/").pop() === shortId
  );
  if (knownFree) return true;

  const pricing = model?.pricing ?? model?.price ?? {};
  const input = pricing?.prompt ?? pricing?.input ?? pricing?.input_price ?? model?.input_price;
  const output = pricing?.completion ?? pricing?.output ?? pricing?.output_price ?? model?.output_price;
  const zero = (v: unknown) => v === 0 || v === "0" || v === "0.0" || v === "0.000000";
  return model?.is_free === true || model?.free === true || (zero(input) && zero(output));
}

function requestyModelRank(model: any): number {
  const id = String(model?.id || "");
  if (id.includes("gemma-4-31b-it")) return 0;
  if (id.includes("nemotron-3.5-lightning")) return 1;
  if (/content-safety|laguna|leanstral/i.test(id)) return 10;
  return 5;
}

async function testRequesty(apiKey: string): Promise<{ models: FreeModel[] }> {
  const res = await fetch("https://router.requesty.ai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const raw = await res.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

  if (res.status === 401) {
    throw new Error("مفتاح Requesty غير صحيح أو منتهي الصلاحية");
  }
  if (res.status === 403) {
    const providerMessage = data?.error?.message || data?.message;
    throw new Error(providerMessage
      ? `Requesty رفض الوصول للحساب: ${providerMessage}`
      : "Requesty رفض الوصول للحساب (403) — راجع صلاحيات الحساب أو المفتاح");
  }
  if (!res.ok) {
    const providerMessage = data?.error?.message || data?.message;
    throw new Error(providerMessage
      ? `تعذر الاتصال بـ Requesty (HTTP ${res.status}): ${providerMessage}`
      : `تعذر الاتصال بـ Requesty (HTTP ${res.status})`);
  }

  const list = Array.isArray(data?.data) ? data.data : [];
  const free = list
    .filter(isRequestyFreeModel)
    .sort((a: any, b: any) => requestyModelRank(a) - requestyModelRank(b));

  if (free.length === 0) {
    throw new Error("تم الاتصال بـ Requesty لكن لم يتم العثور على نماذج مجانية متاحة لهذا المفتاح");
  }

  return {
    models: free.map((m: any) => ({
      model_id: m.id,
      model_name: m.name ?? m.id,
      context_length: m.context_length ?? m.context_window ?? null,
    })),
  };
}

async function testCloudflare(apiKey: string, accountId: string | null): Promise<{ models: FreeModel[] }> {
  if (!accountId) {
    throw new Error("مطلوب إدخال Cloudflare Account ID قبل اختبار الاتصال");
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error("مفتاح Cloudflare أو Account ID غير صحيح");
  }
  if (!res.ok) {
    throw new Error(`تعذر الاتصال بـ Cloudflare AI (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (data?.success === false) {
    const msg = data?.errors?.[0]?.message || "فشل التحقق من حساب Cloudflare";
    throw new Error(msg);
  }
  const list = Array.isArray(data?.result) ? data.result : [];
  const textGen = list.filter((m: any) => (m?.task?.name || "").toLowerCase().includes("text generation"));
  return {
    models: textGen.map((m: any) => ({
      model_id: m.name ?? m.id,
      model_name: m.description ?? m.name ?? m.id,
      context_length: null,
    })),
  };
}

async function testGemini(apiKey: string): Promise<{ models: FreeModel[] }> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (res.status === 401 || res.status === 403) {
    throw new Error("مفتاح Gemini (Google AI Studio) غير صحيح أو غير مفعّل");
  }
  if (!res.ok) {
    throw new Error(`تعذر الاتصال بـ Google AI Studio (HTTP ${res.status})`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.models) ? data.models : [];
  const usable = list.filter(
    (m: any) =>
      Array.isArray(m?.supportedGenerationMethods) &&
      m.supportedGenerationMethods.includes("generateContent") &&
      !/embedding|aqa/i.test(m?.name || "")
  );
  return {
    models: usable.map((m: any) => ({
      model_id: String(m.name || "").replace(/^models\//, ""),
      model_name: m.displayName ?? m.name,
      context_length: m.inputTokenLimit ?? null,
    })),
  };
}

// صورة اختبار ثابتة (60×30، خلفية بيضاء وكلمة "TEST" مرسومة فعلياً
// بالبكسلات — وليست بكسل واحد فارغ كما كانت سابقاً). الصورة الفارغة تماماً
// كانت تتسبب فى خطأ معالجة حقيقي من OCR.Space (E505 "Error during OCR")
// بغض النظر عن صلاحية المفتاح، لأن محرك الـ OCR لا يستطيع معالجة صورة بلا
// أي محتوى مرئي. تُستخدم فقط للتحقق من صلاحية مفتاح OCR.Space عبر استدعاء
// فعلي لواجهته، دون الحاجة لأي ملف من المستخدم — OCR.Space لا يوفر نقطة
// نهاية "تحقق من المفتاح" منفصلة.
const OCR_TEST_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAeCAIAAAD/+uoYAAABHklEQVR4nO3XIW6FMBjA8TIwxeAAxRFAP7UiQOLoAbgIEscBEOUCTbgBDiSXqGsCmmA6Qd7EAm+EvHZZ0p/6QtrkTwMkGEII8N98/HXAHTpaFR2tio5WRUer8jO66zqEEELIsqx9oJTato2e6roGAEzTlKZpHMdJkjDGDndJrBYnHMc5nHdRFDHGhBCUUozxi5UyWPdulXO+risAIMsy13XfeowXnN3N65Nu29b3/aIo+r4/2yXPpWgI4efTOI77xWVZCCFhGJZlebhLnjsnzTkfhuF79jzvbKUkdz55hmFgjBljAIB5noMgePcz+4tLL+K2bQihfX48HlVVNU2T5zmE0DRNQojEwCOG0H8uauhoVXS0KjpaFR2tio5W5Qu6b8cBll2PywAAAABJRU5ErkJggg==";

async function testOcrSpace(apiKey: string): Promise<{ models: FreeModel[] }> {
  const params = new URLSearchParams();
  params.set("apikey", apiKey);
  params.set("base64Image", OCR_TEST_IMAGE);
  params.set("language", "eng");
  params.set("isOverlayRequired", "false");
  params.set("scale", "true");
  // Engine 1 (وليس 2 المستخدم فى الاستخراج الفعلي من مستندات المستخدم):
  // أخف وأكثر تسامحاً، ويكفي تماماً لغرض التحقق من صلاحية المفتاح فقط.
  params.set("OCREngine", "1");

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("مفتاح OCR.Space غير صحيح أو غير مفعّل");
  }
  if (!res.ok) {
    throw new Error(`تعذر الاتصال بـ OCR.Space (HTTP ${res.status})`);
  }

  const data = await res.json();
  const exitCode = Number(data?.OCRExitCode);
  if (data?.IsErroredOnProcessing && exitCode !== 1) {
    const rawMessage = Array.isArray(data?.ErrorMessage)
      ? data.ErrorMessage.join(" ")
      : (data?.ErrorMessage || "فشل التحقق من مفتاح OCR.Space");
    if (/invalid api key|unregistered|inactive|suspended/i.test(rawMessage)) {
      throw new Error("مفتاح OCR.Space غير صحيح أو غير مفعّل");
    }
    throw new Error(rawMessage);
  }

  // OCR.Space لا يملك قائمة "نماذج" — النجاح هنا يعني فقط أن المفتاح صالح.
  return { models: [] };
}

// ----------------------------------------------------------------------------
// سجل دوال الاختبار: لإضافة مزود جديد (AI أو OCR) مستقبلاً، يكفي إضافة سطر
// واحد هنا فقط — دون أي تعديل فى بقية هذا الملف.
// ----------------------------------------------------------------------------
const TEST_HANDLERS: Record<ProviderKey, (apiKey: string, accountId: string | null) => Promise<{ models: FreeModel[] }>> = {
  openrouter: (apiKey) => testOpenRouter(apiKey),
  groq: (apiKey) => testGroq(apiKey),
  cloudflare: (apiKey, accountId) => testCloudflare(apiKey, accountId),
  ocrspace: (apiKey) => testOcrSpace(apiKey),
  gemini: (apiKey) => testGemini(apiKey),
  nararouter: (apiKey) => testNaraRouter(apiKey),
  requesty: (apiKey) => testRequesty(apiKey),
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "غير مصرح: لا يوجد رمز دخول" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerAuth?.user) {
      return jsonResponse({ error: "غير مصرح: جلسة غير صالحة" }, 401);
    }

    const { data: callerProfile } = await adminClient
      .from("users")
      .select("role, is_active, deleted_at")
      .eq("id", callerAuth.user.id)
      .maybeSingle();

    if (!callerProfile || !callerProfile.is_active || callerProfile.deleted_at || callerProfile.role !== "super_admin") {
      return jsonResponse({ error: "غير مصرح: هذا الإجراء متاح لمدير النظام (Super Admin) فقط" }, 403);
    }

    const body = await req.json();
    const provider = body?.provider as ProviderKey;

    if (!KNOWN_PROVIDERS.includes(provider)) {
      return jsonResponse({ error: "مزود خدمة غير معروف" }, 400);
    }

    const { data: providerRow, error: providerErr } = await adminClient
      .from("ai_providers")
      .select("api_key, account_id")
      .eq("provider", provider)
      .maybeSingle();

    if (providerErr || !providerRow) {
      return jsonResponse({ error: "تعذر العثور على إعدادات هذا المزود" }, 404);
    }

    if (!providerRow.api_key) {
      return jsonResponse({ error: "لا يوجد مفتاح API محفوظ لهذا المزود بعد" }, 400);
    }

    let result: { models: FreeModel[] };
    try {
      const handler = TEST_HANDLERS[provider];
      result = await handler(providerRow.api_key, providerRow.account_id);
    } catch (testErr) {
      const message = testErr instanceof Error ? testErr.message : "فشل اختبار الاتصال";
      await adminClient
        .from("ai_providers")
        .update({ status: "error", last_error: message, last_tested_at: new Date().toISOString() })
        .eq("provider", provider);

      return jsonResponse({ success: false, status: "error", error: message });
    }

    const now = new Date().toISOString();
    const topModel = result.models[0]?.model_id ?? null;

    await adminClient
      .from("ai_providers")
      .update({
        status: "active",
        last_error: null,
        last_tested_at: now,
        default_model: topModel,
      })
      .eq("provider", provider);

    // تحديث كاش النماذج المجانية لهذا المزود (حذف القديم ثم إدراج الجديد)
    await adminClient.from("ai_provider_models").delete().eq("provider", provider);
    if (result.models.length > 0) {
      await adminClient.from("ai_provider_models").insert(
        result.models.slice(0, 50).map((m) => ({
          provider,
          model_id: m.model_id,
          model_name: m.model_name,
          context_length: m.context_length,
          is_free: true,
          fetched_at: now,
        }))
      );
    }

    // لازم فلتر WHERE صريح حتى لو الجدول Singleton، لأن قاعدة بيانات المشروع
    // مضبوطة على رفض أي UPDATE بدون WHERE clause.
    const { error: settingsUpdateErr } = await adminClient
      .from("ai_settings")
      .update({ models_updated_at: now })
      .not("id", "is", null);

    if (settingsUpdateErr) {
      console.error("failed to update ai_settings.models_updated_at:", settingsUpdateErr.message);
    }

    return jsonResponse({ success: true, status: "active", models_found: result.models.length });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      500
    );
  }
});
