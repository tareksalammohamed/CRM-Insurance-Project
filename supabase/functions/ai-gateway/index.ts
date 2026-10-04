// Edge Function: ai-gateway
// ============================================================================
// نقطة الدخول المركزية الوحيدة لأي ميزة تعتمد على الذكاء الاصطناعي فى
// التطبيق (Provider Manager). تُستخدم حالياً من ميزات استخراج البيانات
// (إضافة عميل / إصدار وثيقة / استيراد بيانات)، وأي ميزة قادمة يجب أن تمر
// من هنا أيضاً — بنفس الشكل تماماً: ترسل messages فقط، ولا تعرف اسم أي
// مزود أو طريقة عمله.
//
// المسؤوليات:
//   - التأكد من أن المنظومة مفعّلة (ai_settings.ai_enabled).
//   - عند وجود صور ضمن الرسائل (استخراج بيانات من صورة/PDF): محاولة
//     استخراج النص أولاً عبر أفضل مزود OCR متاح ومفعّل (OCR.Space حالياً)،
//     ثم إرسال النص الناتج كنص عادي لأفضل مزود AI متاح لتحليله وتحويله
//     لـ JSON منظم — بدلاً من إرسال الصورة نفسها للنموذج (أدق وأرخص).
//   - إذا كان OCR غير متاح/غير مفعّل/بلا مفتاح/فشل الاستخراج: ينتقل تلقائياً
//     ودون أي تدخل من المستدعي لإرسال الصور مباشرة لأحد نماذج AI التى تدعم
//     الصور (Vision) — بالضبط السلوك الأصلي قبل إضافة دعم OCR.
//   - اختيار أفضل مزود AI متاح تلقائياً (enabled + status=active) حسب
//     الأولوية، واختيار أفضل نموذج مجاني مناسب (default_model المخزّن).
//   - عند حدوث أي خطأ أو انتهاء حصة مع مزود (AI أو OCR): تسجيل الخطأ
//     والانتقال تلقائياً للمزود التالي فى الترتيب (Automatic Failover) دون
//     تدخل من المستدعي، ودون أن يتوقف التطبيق بسبب تعطل أي خدمة.
//
// قابلية التوسع (Provider Manager):
//   لإضافة مزود AI جديد: أضف دالة call<Provider> + سجّلها فى AI_PROVIDERS.
//   لإضافة مزود OCR جديد: أضف دالة call<Provider> + سجّلها فى OCR_PROVIDERS.
//   لا حاجة لأي تعديل آخر فى هذا الملف، ولا فى أي صفحة أو Business Logic
//   بالفرونت إند — الصفحات تستدعي askAI() فقط وتستلم { success, content }.
//
// طلب الإدخال المتوقع (بدون أي تغيير عن السابق):
//   { messages: [{ role: 'user' | 'system' | 'assistant',
//                  content: string | Array<{ type: 'text', text: string }
//                                          | { type: 'image_url', image_url: { url: string } }> }],
//     max_tokens?: number, temperature?: number }
//
// الاستجابة (بدون أي تغيير عن السابق؛ ocr_provider حقل إضافي اختياري فقط):
//   { success: true, provider, model, content, ocr_provider? }
//   { success: false, error }
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ChatContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
}

function hasImageContent(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) => Array.isArray(m.content) && m.content.some((part) => part.type === "image_url")
  );
}

// ============================================================================
// AI Provider Manager — مزودو توليد النصوص / تحليل الصور (Vision)
// ============================================================================

interface AIProviderRow {
  provider: string;
  api_key: string | null;
  account_id: string | null;
  default_model: string | null;
  priority: number;
}

interface AIProviderRuntimeStats {
  provider: string;
  consecutive_failures: number;
  avg_latency_ms: number | null;
  cooldown_until: string | null;
  last_runtime_error?: string | null;
}

interface AIProviderModelRow {
  provider: string;
  model_id: string;
}

interface AIAttemptError {
  provider: string;
  model: string | null;
  message: string;
}

function runtimeCooldownSeconds(message: string): number {
  if (/HTTP\s*429|rate.?limit|quota|too many requests/i.test(message)) return 10 * 60;
  if (/HTTP\s*5\d\d|timeout|timed out|network|fetch failed|aborted/i.test(message)) return 2 * 60;
  if (/HTTP\s*(401|403)/i.test(message)) return 30 * 60;
  return 5 * 60;
}

function isPersistentProviderError(message: string): boolean {
  return /HTTP\s*(401|403)/i.test(message);
}

function isCapacityError(message: string): boolean {
  return /HTTP\s*429|rate.?limit|too many requests|quota|resource exhausted|insufficient.*(?:credit|quota)|credit.*(?:exhaust|limit)|balance.*(?:low|empty|insufficient)/i.test(message);
}

function isTransientProviderError(message: string): boolean {
  return /HTTP\s*5\d\d|timeout|timed out|network|fetch failed|aborted/i.test(message);
}

function modelCandidates(provider: AIProviderRow, models: AIProviderModelRow[]): string[] {
  const cached = models
    .filter((row) => row.provider === provider.provider)
    .map((row) => row.model_id)
    .filter(Boolean);

  const unique = Array.from(new Set([
    ...(provider.default_model ? [provider.default_model] : []),
    ...cached,
  ]));

  // لا نريد تحويل فشل مزود واحد إلى عشرات الاستدعاءات. نجرب النموذج
  // الافتراضي ثم حتى 3 بدائل حديثة من الكاش قبل الانتقال للمزود التالي.
  return unique.slice(0, 4);
}

async function recordProviderRuntime(
  adminClient: ReturnType<typeof createClient>,
  provider: string,
  success: boolean,
  latencyMs: number,
  error: string | null = null
) {
  const cooldownSeconds = success ? 0 : runtimeCooldownSeconds(error || "");
  await adminClient.rpc("record_ai_provider_runtime", {
    p_provider: provider,
    p_success: success,
    p_latency_ms: latencyMs,
    p_error: error,
    p_cooldown_seconds: cooldownSeconds,
  });
}

function orderProvidersByRuntime(
  providers: AIProviderRow[],
  stats: AIProviderRuntimeStats[]
): AIProviderRow[] {
  const statsByProvider = new Map(stats.map((row) => [row.provider, row]));
  const now = Date.now();

  return [...providers].sort((a, b) => {
    const sa = statsByProvider.get(a.provider);
    const sb = statsByProvider.get(b.provider);

    const aCooling = sa?.cooldown_until ? new Date(sa.cooldown_until).getTime() > now : false;
    const bCooling = sb?.cooldown_until ? new Date(sb.cooldown_until).getTime() > now : false;
    if (aCooling !== bCooling) return aCooling ? 1 : -1;

    const score = (provider: AIProviderRow, stat?: AIProviderRuntimeStats) =>
      (provider.priority * 1000)
      + ((stat?.consecutive_failures || 0) * 250)
      + ((stat?.avg_latency_ms || 0) / 10);

    return score(a, sa) - score(b, sb);
  });
}

type AICallFn = (
  row: AIProviderRow,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number
) => Promise<string>;

async function callOpenRouter(apiKey: string, model: string, messages: ChatMessage[], maxTokens: number, temperature: number) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) throw new Error(`OpenRouter: HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter: استجابة فارغة");
  return content as string;
}

async function callGroq(apiKey: string, model: string, messages: ChatMessage[], maxTokens: number, temperature: number) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) throw new Error(`Groq: HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq: استجابة فارغة");
  return content as string;
}

async function callRequesty(apiKey: string, model: string, messages: ChatMessage[], maxTokens: number, temperature: number) {
  const res = await fetch("https://router.requesty.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://crm-insurance-project.vercel.app",
      "X-Title": "Insurance CRM",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let providerMessage = raw;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      providerMessage = parsed?.error?.message || parsed?.message || raw;
    } catch { /* keep raw */ }
    throw new Error(`Requesty: HTTP ${res.status}${providerMessage ? ` — ${String(providerMessage).slice(0, 240)}` : ""}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Requesty: استجابة فارغة");
  return content as string;
}

async function callNaraRouter(apiKey: string, model: string, messages: ChatMessage[], maxTokens: number, temperature: number) {
  const res = await fetch("https://router.bynara.id/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) {
    const details = await res.text().catch(() => "");
    throw new Error(`NaraRouter: HTTP ${res.status}${details ? ` — ${details.slice(0, 240)}` : ""}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("NaraRouter: استجابة فارغة");
  return content as string;
}

async function callCloudflare(apiKey: string, accountId: string, model: string, messages: ChatMessage[]) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    }
  );
  if (!res.ok) throw new Error(`Cloudflare AI: HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.result?.response;
  if (!content) throw new Error("Cloudflare AI: استجابة فارغة");
  return content as string;
}

// Gemini (Google AI Studio) يستخدم شكل طلب مختلف عن باقي المزودين (OpenAI
// Compatible): رسائل الدور 'system' تُنقَل لحقل systemInstruction منفصل،
// و'assistant' تصبح 'model'، والصور تُرسَل كـ inline_data (mime_type + base64
// بدون بادئة data:...;base64,). Gemini 1.5 يقرأ الصور مباشرة ضمن نفس الطلب،
// فلا يحتاج أي خطوة OCR منفصلة قبله.
function toGeminiRequest(messages: ChatMessage[]) {
  let systemText = "";
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

  for (const m of messages) {
    const partsFromContent = (): Array<Record<string, unknown>> => {
      if (typeof m.content === "string") return [{ text: m.content }];
      const parts: Array<Record<string, unknown>> = [];
      for (const part of m.content) {
        if (part.type === "text" && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === "image_url" && part.image_url?.url) {
          const match = /^data:([^;]+);base64,(.+)$/.exec(part.image_url.url);
          if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
        }
      }
      return parts;
    };

    if (m.role === "system") {
      const text = typeof m.content === "string" ? m.content : m.content.map((p) => p.text || "").join("\n");
      systemText += `${text}\n`;
      continue;
    }

    contents.push({ role: m.role === "assistant" ? "model" : "user", parts: partsFromContent() });
  }

  return {
    contents,
    systemInstruction: systemText.trim() ? { parts: [{ text: systemText.trim() }] } : undefined,
  };
}

async function callGemini(apiKey: string, model: string, messages: ChatMessage[], maxTokens: number, temperature: number) {
  const { contents, systemInstruction } = toGeminiRequest(messages);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(systemInstruction ? { systemInstruction } : {}),
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini: HTTP ${res.status}`);
  const data = await res.json();
  const content = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p?.text || "")
    .join("");
  if (!content) throw new Error("Gemini: استجابة فارغة");
  return content as string;
}

// سجل مزودي AI: "supportsVision" يحدد إن كان المزود يُستبعد تلقائياً عندما
// تحتوي الرسائل صوراً ولم ينجح استخراج OCR (نفس سلوك Cloudflare الأصلي،
// لكن الآن كقاعدة عامة قابلة لإعادة الاستخدام مع أي مزود مستقبلي).
const AI_PROVIDERS: Record<string, { supportsVision: boolean; call: AICallFn }> = {
  openrouter: {
    supportsVision: true,
    call: (row, messages, maxTokens, temperature) =>
      callOpenRouter(row.api_key!, row.default_model!, messages, maxTokens, temperature),
  },
  groq: {
    supportsVision: true,
    call: (row, messages, maxTokens, temperature) =>
      callGroq(row.api_key!, row.default_model!, messages, maxTokens, temperature),
  },
  cloudflare: {
    supportsVision: false,
    call: async (row, messages) => {
      if (!row.account_id) throw new Error("لا يوجد Account ID");
      return callCloudflare(row.api_key!, row.account_id, row.default_model!, messages);
    },
  },
  gemini: {
    supportsVision: true,
    call: (row, messages, maxTokens, temperature) =>
      callGemini(row.api_key!, row.default_model!, messages, maxTokens, temperature),
  },
  nararouter: {
    // NaraRouter يضم نماذج متعددة بقدرات مختلفة؛ لا نفترض أن النموذج
    // الافتراضي يدعم الصور. بعد OCR يمكن استخدامه للنص بشكل طبيعي.
    supportsVision: false,
    call: (row, messages, maxTokens, temperature) =>
      callNaraRouter(row.api_key!, row.default_model!, messages, maxTokens, temperature),
  },
  requesty: {
    // Requesty يضم نماذج بقدرات مختلفة؛ نستخدمه للنص بعد OCR بصورة آمنة.
    supportsVision: false,
    call: (row, messages, maxTokens, temperature) =>
      callRequesty(row.api_key!, row.default_model!, messages, maxTokens, temperature),
  },
};

// ============================================================================
// OCR Provider Manager — مزودو استخراج النص من الصور/PDF (يُستخدَمون فقط
// عندما تحتوي الرسائل صوراً، قبل اللجوء لمزودي الـ Vision عند AI_PROVIDERS)
// ============================================================================

interface OcrProviderRow {
  provider: string;
  api_key: string | null;
}

type OcrCallFn = (apiKey: string, imageDataUrl: string) => Promise<string>;

// الحد الأقصى لحجم أي ملف/صورة مُرسَل ضمن الرسائل = 1 ميجابايت (نفس الحد
// المفروض على مفاتيح OCR.Space، خصوصاً المجانية منها). يُطبَّق هنا كقاعدة
// عامة للتطبيق كله (ليس فقط لمزوّد OCR)، لأن أي صورة تتجاوز الحد ستفشل من
// عند OCR.Space على أي حال — فالأصح رفضها فوراً وبوضوح للمستخدم بدل تركها
// "تسقط" تلقائياً على مسار Vision (تحليل الصورة مباشرة بالذكاء الاصطناعي)
// دون أن ينتبه أحد لسبب الفشل الحقيقي، أو تعطيل حالة مزود OCR بالخطأ.
const MAX_FILE_SIZE_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_MESSAGES = 40;
const MAX_PARTS_PER_MESSAGE = 12;
const MAX_TEXT_PART_BYTES = 24 * 1024;
const MAX_TOTAL_TEXT_BYTES = 160 * 1024;
const MAX_IMAGE_PARTS = 8;
const MAX_OUTPUT_TOKENS = 4000;
const AI_RATE_WINDOW_MS = 60_000;
const AI_RATE_LIMIT = 20;
const aiRateBuckets = new Map<string, { startedAt: number; count: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const bucket = aiRateBuckets.get(userId);
  if (!bucket || now - bucket.startedAt >= AI_RATE_WINDOW_MS) {
    aiRateBuckets.set(userId, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > AI_RATE_LIMIT;
}

function validateRequestMessages(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return "messages مطلوبة";
  if (messages.length > MAX_MESSAGES) return `عدد الرسائل يتجاوز الحد المسموح (${MAX_MESSAGES})`;

  let totalTextBytes = 0;
  let imageCount = 0;
  for (const message of messages as ChatMessage[]) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)) {
      return "دور الرسالة غير صحيح";
    }

    if (typeof message.content === 'string') {
      const bytes = new TextEncoder().encode(message.content).byteLength;
      if (bytes > MAX_TEXT_PART_BYTES) return "نص الرسالة كبير جداً";
      totalTextBytes += bytes;
      continue;
    }

    if (!Array.isArray(message.content) || message.content.length > MAX_PARTS_PER_MESSAGE) {
      return "محتوى الرسالة غير صحيح أو كبير جداً";
    }

    for (const part of message.content) {
      if (part.type === 'text') {
        const text = part.text || '';
        const bytes = new TextEncoder().encode(text).byteLength;
        if (bytes > MAX_TEXT_PART_BYTES) return "جزء النص كبير جداً";
        totalTextBytes += bytes;
      } else if (part.type === 'image_url' && part.image_url?.url) {
        imageCount += 1;
        // منع تمرير روابط خارجية إلى مزودي AI؛ الصور المستخدمة في التطبيق
        // يجب أن تكون data URLs حتى لا تتحول البوابة إلى SSRF proxy.
        if (!/^data:(?:image\/(?:png|jpe?g|webp|gif|bmp|tiff)|application\/pdf);base64,[A-Za-z0-9+/=\s]+$/i.test(part.image_url.url)) {
          return "مصدر الصورة غير مسموح؛ يجب إرسال صورة مضمّنة داخل الطلب";
        }
      } else {
        return "نوع جزء الرسالة غير مسموح";
      }
    }
  }

  if (imageCount > MAX_IMAGE_PARTS) return `عدد الصور يتجاوز الحد المسموح (${MAX_IMAGE_PARTS})`;
  if (totalTextBytes > MAX_TOTAL_TEXT_BYTES) return "إجمالي النص المرسل كبير جداً";
  return null;
}

// حساب الحجم الفعلي بالبايت لبيانات Base64 (وليس طول النص Base64 نفسه، الذى
// أكبر بحوالي الثلث من حجم البيانات الحقيقية).
function base64ByteSize(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * يتحقق من أن كل الصور/الملفات ضمن رسائل الطلب لا تتجاوز الحد الأقصى
 * المسموح به. يُرجع رسالة الخطأ الأولى إن وُجد ملف متجاوز، أو null لو الكل
 * ضمن الحد المسموح.
 */
function findOversizedFile(messages: ChatMessage[]): string | null {
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const part of m.content) {
      if (part.type !== "image_url" || !part.image_url?.url) continue;
      const sizeBytes = base64ByteSize(part.image_url.url);
      if (sizeBytes > MAX_FILE_SIZE_BYTES) {
        const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
        return `الملف كبير جداً (${sizeMb} ميجابايت) — الحد الأقصى المسموح به هو 1 ميجابايت. برجاء ضغط الملف أو رفع صورة أصغر.`;
      }
    }
  }
  return null;
}

function guessOcrFiletype(dataUrl: string): string {
  const match = /^data:([^;]+);base64,/.exec(dataUrl);
  const mime = (match?.[1] || "").toLowerCase();
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("png")) return "PNG";
  if (mime.includes("gif")) return "GIF";
  if (mime.includes("bmp")) return "BMP";
  if (mime.includes("tif")) return "TIF";
  return "JPG";
}

async function callOcrSpace(apiKey: string, imageDataUrl: string): Promise<string> {
  const params = new URLSearchParams();
  params.set("apikey", apiKey);
  params.set("base64Image", imageDataUrl);
  // OCR.Space يعيد E201 أحياناً مع ara على Engine 2؛ auto مدعوم
  // رسميًا ويكتشف العربية والإنجليزية المختلطة في وثائق التأمين.
  params.set("language", "auto");
  params.set("isOverlayRequired", "false");
  params.set("scale", "true");
  params.set("OCREngine", "2");
  params.set("filetype", guessOcrFiletype(imageDataUrl));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  let res: Response;
  try {
    res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) throw new Error(`OCR.Space: HTTP ${res.status}`);
  const data = await res.json();

  const exitCode = Number(data?.OCRExitCode);
  if (data?.IsErroredOnProcessing && exitCode !== 1) {
    const message = Array.isArray(data?.ErrorMessage)
      ? data.ErrorMessage.join(" ")
      : (data?.ErrorMessage || "فشل استخراج النص عبر OCR.Space");
    throw new Error(message);
  }

  const results = Array.isArray(data?.ParsedResults) ? data.ParsedResults : [];
  const text = results.map((r: any) => r?.ParsedText || "").join("\n").trim();
  if (!text) throw new Error("OCR.Space: لم يتم العثور على أي نص فى المستند");
  return text;
}

// سجل مزودي OCR: لإضافة مزود جديد مستقبلاً (مثلاً Azure/Google Vision OCR)
// أضف دالة استدعاء + سطر واحد هنا فقط.
const OCR_PROVIDERS: Record<string, { call: OcrCallFn }> = {
  ocrspace: { call: callOcrSpace },
};

/**
 * يحاول استخراج النص من كل الصور الموجودة برسائل الطلب عبر أفضل مزود OCR
 * مفعّل حسب الأولوية، ويُرجع نسخة جديدة من الرسائل بعد استبدال الصور بالنص
 * المستخرَج. يُرجع null إن تعذّر ذلك تماماً (لا يوجد مزود OCR متاح، أو فشلت
 * كل المزودات المتاحة)، ليكمل المستدعي تلقائياً بالمسار البصري (Vision) دون
 * أي خطأ يظهر للمستخدم.
 */
async function tryOcrRewrite(
  adminClient: ReturnType<typeof createClient>,
  messages: ChatMessage[]
): Promise<{ messages: ChatMessage[]; provider: string } | null> {
  const { data: ocrProviders } = await adminClient
    .from("ai_providers")
    .select("provider, api_key")
    .eq("provider_type", "ocr")
    .eq("enabled", true)
    .eq("status", "active")
    .order("priority", { ascending: true });

  if (!ocrProviders || ocrProviders.length === 0) return null;

  for (const row of ocrProviders as OcrProviderRow[]) {
    const handler = OCR_PROVIDERS[row.provider];
    if (!handler || !row.api_key) continue;

    try {
      const rewritten: ChatMessage[] = [];

      for (const m of messages) {
        if (!Array.isArray(m.content)) {
          rewritten.push(m);
          continue;
        }

        const textParts = m.content.filter((p) => p.type === "text").map((p) => p.text || "");
        const imageParts = m.content.filter((p) => p.type === "image_url" && p.image_url?.url);

        if (imageParts.length === 0) {
          rewritten.push({ role: m.role, content: textParts.join("\n\n") });
          continue;
        }

        const ocrTexts: string[] = [];
        for (const part of imageParts) {
          const extracted = await handler.call(row.api_key!, part.image_url!.url);
          ocrTexts.push(extracted);
        }

        const ocrBlock = `نص مستخرج آلياً عبر OCR من المستند/المستندات المرفقة:\n${
          ocrTexts.length > 1
            ? ocrTexts.map((t, i) => `--- مستند ${i + 1} ---\n${t}`).join("\n\n")
            : ocrTexts[0]
        }`;

        rewritten.push({ role: m.role, content: [...textParts, ocrBlock].filter(Boolean).join("\n\n") });
      }

      return { messages: rewritten, provider: row.provider };
    } catch (ocrErr) {
      const message = ocrErr instanceof Error ? ocrErr.message : "فشل استخراج النص عبر OCR";
      // 401/403 فقط تعتبر مشكلة إعداد دائمة. انتهاء الحصة/429 أو الشبكة
      // لا يعطّل OCR حتى فحص الست ساعات؛ نسمح للطلب الحالي يكمل مباشرة
      // على Vision أو مزود OCR تالٍ، ويعود OCR تلقائياً لاحقاً.
      if (isPersistentProviderError(message)) {
        await adminClient
          .from("ai_providers")
          .update({ status: "error", last_error: message, last_tested_at: new Date().toISOString() })
          .eq("provider", row.provider);
      }
      continue;
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ success: false, error: "غير مصرح: لا يوجد رمز دخول" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerAuth?.user) {
      return jsonResponse({ success: false, error: "غير مصرح: جلسة غير صالحة" }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("users")
      .select("is_active, deleted_at")
      .eq("id", callerAuth.user.id)
      .maybeSingle();
    if (callerProfileError || !callerProfile || !callerProfile.is_active || callerProfile.deleted_at) {
      return jsonResponse({ success: false, error: "غير مصرح: الحساب غير نشط" }, 403);
    }
    if (isRateLimited(callerAuth.user.id)) {
      return jsonResponse({
        success: false,
        error: "تم تجاوز الحد المؤقت لطلبات الذكاء الاصطناعي، حاول بعد دقيقة",
        failure_type: "gateway_rate_limited",
        retry_after_seconds: 60,
      }, 429);
    }

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ success: false, error: "حجم الطلب كبير جداً" }, 413);
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ success: false, error: "حجم الطلب كبير جداً" }, 413);
    }
    const body = JSON.parse(rawBody);
    const messages = body?.messages as ChatMessage[];
    const validationError = validateRequestMessages(messages);
    if (validationError) {
      return jsonResponse({ success: false, error: validationError }, 400);
    }

    const requestedTokens = Number(body?.max_tokens);
    const maxTokens = Number.isFinite(requestedTokens) && requestedTokens > 0
      ? Math.min(Math.floor(requestedTokens), MAX_OUTPUT_TOKENS)
      : 512;
    const requestedTemperature = body?.temperature !== undefined ? Number(body.temperature) : 0.7;
    const temperature = Number.isFinite(requestedTemperature)
      ? Math.min(Math.max(requestedTemperature, 0), 1)
      : 0.7;

    const oversizedError = findOversizedFile(messages);
    if (oversizedError) {
      return jsonResponse({ success: false, error: oversizedError }, 400);
    }

    const { data: settings } = await adminClient.from("ai_settings").select("ai_enabled").maybeSingle();
    if (!settings?.ai_enabled) {
      return jsonResponse({ success: false, error: "منظومة الذكاء الاصطناعي غير مفعّلة حالياً" }, 400);
    }

    // جلب مزودي الـ AI المفعّلين مبكراً — نحتاجهم لقرار تخطي OCR (prefer_vision)
    // ثم لاختيار المزود فى الخطوة 2.
    const { data: providers } = await adminClient
      .from("ai_providers")
      .select("provider, api_key, account_id, default_model, priority")
      .eq("provider_type", "ai")
      .eq("enabled", true)
      .eq("status", "active")
      .order("priority", { ascending: true });

    if (!providers || providers.length === 0) {
      return jsonResponse({ success: false, error: "لا يوجد أي مزود ذكاء اصطناعي مفعّل ومتصل حالياً" }, 400);
    }

    const providerNames = (providers as AIProviderRow[]).map((p) => p.provider);
    const { data: runtimeRows } = await adminClient
      .from("ai_provider_runtime_stats")
      .select("provider,consecutive_failures,avg_latency_ms,cooldown_until,last_runtime_error")
      .in("provider", providerNames);

    const orderedProviders = orderProvidersByRuntime(
      providers as AIProviderRow[],
      (runtimeRows || []) as AIProviderRuntimeStats[],
    );

    const { data: cachedModels } = await adminClient
      .from("ai_provider_models")
      .select("provider,model_id")
      .in("provider", providerNames)
      .order("fetched_at", { ascending: false });

    const providerModels = (cachedModels || []) as AIProviderModelRow[];

    // --------------------------------------------------------------------
    // الخطوة 1: لو الرسائل تحتوي صوراً، حاول استخراج النص منها أولاً عبر
    // أفضل مزود OCR متاح. لو نجح، نُكمل بالرسائل النصية الناتجة (أدق
    // وأرخص من إرسال الصورة نفسها). لو فشل أو لا يوجد مزود OCR، نُكمل
    // بالرسائل الأصلية (تحتوي الصور) ليتم إرسالها لمزود AI يدعم Vision.
    //
    // استثناء (prefer_vision): بعض الميزات — مثل استخراج بيانات المستندات
    // المكتوبة بخط اليد — ترسل prefer_vision=true لأن الـ OCR التقليدي
    // (OCR.Space) ضعيف جداً مع خط اليد العربي بينما نماذج الرؤية تقرأه
    // بدقة أعلى بكثير. فى هذه الحالة نتخطى OCR ونرسل الصور مباشرة لنموذج
    // Vision — بشرط وجود مزود مفعّل يدعم الرؤية فعلاً، وإلا نُبقي على مسار
    // OCR كخطة بديلة حتى لا يفشل الطلب كلياً.
    // --------------------------------------------------------------------
    const needsVision = hasImageContent(messages);
    const preferVision = body?.prefer_vision === true;
    const hasActiveVisionProvider = orderedProviders.some(
      (p) => AI_PROVIDERS[p.provider]?.supportsVision && p.api_key && p.default_model,
    );
    let effectiveMessages = messages;
    let ocrUsedProvider: string | null = null;

    if (needsVision && !(preferVision && hasActiveVisionProvider)) {
      const ocrResult = await tryOcrRewrite(adminClient, messages);
      if (ocrResult) {
        effectiveMessages = ocrResult.messages;
        ocrUsedProvider = ocrResult.provider;
      }
    }

    const stillNeedsVision = hasImageContent(effectiveMessages);

    // --------------------------------------------------------------------
    // الخطوة 2: Smart Routing. الأولوية اليدوية تظل الأساس، ثم تُعدَّل
    // ديناميكياً حسب الفشل المتتالي، زمن الاستجابة، والـcooldown المؤقت.
    // مع Fallback تلقائي كامل بين كل المزودين المفعّلين عند فشل أي منهم.
    // --------------------------------------------------------------------

    const attemptErrors: AIAttemptError[] = [];
    const runtimeByProvider = new Map(
      ((runtimeRows || []) as AIProviderRuntimeStats[]).map((row) => [row.provider, row])
    );
    const nowMs = Date.now();

    for (const provider of orderedProviders) {
      const handler = AI_PROVIDERS[provider.provider];
      if (!handler) {
        attemptErrors.push({ provider: provider.provider, model: null, message: "مزود غير مدعوم" });
        continue;
      }

      if (!provider.api_key) {
        attemptErrors.push({ provider: provider.provider, model: null, message: "لا يوجد مفتاح API" });
        continue;
      }

      if (stillNeedsVision && !handler.supportsVision) {
        attemptErrors.push({ provider: provider.provider, model: null, message: "لا يدعم تحليل الصور فى هذه المرحلة" });
        continue;
      }

      const runtime = runtimeByProvider.get(provider.provider);
      const cooling = runtime?.cooldown_until
        ? new Date(runtime.cooldown_until).getTime() > nowMs
        : false;

      // لا نعيد ضرب مزود معروف أنه داخل cooldown في كل صفحة من ملف كبير.
      // إذا انتهت بقية البدائل، التصنيف النهائي يوضح للمستدعي إن السعة
      // غير متاحة مؤقتاً ويحتفظ الاستيراد بالجزء الذي اكتمل بالفعل.
      if (cooling) {
        attemptErrors.push({
          provider: provider.provider,
          model: null,
          message: runtime?.last_runtime_error || "المزود في فترة cooldown مؤقتة",
        });
        continue;
      }

      const candidates = modelCandidates(provider, providerModels);
      if (candidates.length === 0) {
        attemptErrors.push({ provider: provider.provider, model: null, message: "لا يوجد نموذج متاح للمزود" });
        continue;
      }

      const providerStartedAt = Date.now();
      let providerLastError = "";
      let persistentFailure = false;

      for (const model of candidates) {
        const candidateRow: AIProviderRow = { ...provider, default_model: model };
        try {
          const content = await handler.call(candidateRow, effectiveMessages, maxTokens, temperature);
          const latencyMs = Date.now() - providerStartedAt;
          await recordProviderRuntime(adminClient, provider.provider, true, latencyMs);

          await adminClient
            .from("ai_settings")
            .update({ active_provider: provider.provider, active_model: model })
            .not("id", "is", null);

          return jsonResponse({
            success: true,
            provider: provider.provider,
            model,
            content,
            ...(model !== provider.default_model ? { fallback_model_used: true } : {}),
            ...(ocrUsedProvider ? { ocr_provider: ocrUsedProvider } : {}),
          });
        } catch (callErr) {
          const message = callErr instanceof Error ? callErr.message : "خطأ غير معروف";
          providerLastError = message;
          attemptErrors.push({ provider: provider.provider, model, message });

          if (isPersistentProviderError(message)) {
            persistentFailure = true;
            break;
          }

          // لو المشكلة quota/rate limit على نموذج بعينه نجرب نموذجاً آخر من
          // نفس المزود أولاً. كذلك بعض أخطاء 5xx قد تكون خاصة بالنموذج.
          if (isCapacityError(message) || isTransientProviderError(message)) {
            continue;
          }

          // خطأ غير مصنف: نجرب نموذجاً بديلاً واحداً ضمن نفس القائمة ثم
          // يواصل اللوب طبيعياً، بدون تعطيل المزود دائماً.
          continue;
        }
      }

      const latencyMs = Date.now() - providerStartedAt;
      if (providerLastError) {
        await recordProviderRuntime(adminClient, provider.provider, false, latencyMs, providerLastError);
      }

      if (persistentFailure) {
        await adminClient
          .from("ai_providers")
          .update({ status: "error", last_error: providerLastError, last_tested_at: new Date().toISOString() })
          .eq("provider", provider.provider);
      }
    }

    const meaningfulErrors = attemptErrors.filter((e) =>
      !/لا يدعم تحليل الصور|مزود غير مدعوم|لا يوجد مفتاح|لا يوجد نموذج/i.test(e.message)
    );
    const capacityExhausted =
      meaningfulErrors.length > 0 &&
      meaningfulErrors.every((e) => isCapacityError(e.message));

    const temporarilyUnavailable =
      meaningfulErrors.length > 0 &&
      meaningfulErrors.every((e) => isCapacityError(e.message) || isTransientProviderError(e.message));

    const earliestCooldown = ((runtimeRows || []) as AIProviderRuntimeStats[])
      .map((row) => row.cooldown_until ? new Date(row.cooldown_until).getTime() : NaN)
      .filter((ts) => Number.isFinite(ts) && ts > Date.now())
      .sort((a, b) => a - b)[0];

    const retryAfterSeconds = earliestCooldown
      ? Math.max(30, Math.ceil((earliestCooldown - Date.now()) / 1000))
      : (capacityExhausted ? 600 : temporarilyUnavailable ? 120 : undefined);

    const errorText = attemptErrors
      .map((e) => `${e.provider}${e.model ? `/${e.model}` : ""}: ${e.message}`)
      .join(" | ");

    return jsonResponse(
      {
        success: false,
        error: capacityExhausted
          ? "انتهت أو توقفت الحصة المتاحة حالياً لدى كل نماذج ومزودي الذكاء الاصطناعي المفعّلين"
          : `فشلت كل المزودات المتاحة: ${errorText}`,
        failure_type: capacityExhausted
          ? "capacity_exhausted"
          : temporarilyUnavailable
            ? "unavailable"
            : "all_providers_failed",
        ...(retryAfterSeconds ? { retry_after_seconds: retryAfterSeconds } : {}),
        provider_errors: attemptErrors,
      },
      capacityExhausted ? 429 : 502
    );


  } catch (err) {
    return jsonResponse(
      { success: false, error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      500
    );
  }
});
