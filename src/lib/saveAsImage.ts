/* =============================================================================
 * حفظ أى تقرير قابل للطباعة كصورة PNG — بنفس شكل الطباعة بالظبط
 * =============================================================================
 *
 * الهدف: أى مكان فى التطبيق فيه زرار "طباعة" يبقى جنبه زرار "حفظ كصورة"،
 * والصورة الناتجة تطلع مطابقة تمامًا لشكل الورق المطبوع: نفس الترتيب، نفس
 * الجداول، نفس الخطوط والأماكن — وبدون أى رسومات بيانية (charts).
 * ولو المحتوى أطول من صفحة واحدة، بينزل فى أكتر من صورة (صورة لكل صفحة).
 *
 * ── ليه html-to-image ومش html2canvas؟ ─────────────────────────────────────
 * html2canvas بيعيد رسم النص بنفسه بدل ما يعتمد على محرك المتصفح، وده بيكسر
 * تشكيل الحروف العربية المتصلة واتجاه RTL فبيطلع النص مشوّه/معكوس.
 * html-to-image بيحوّل العنصر لـ SVG (foreignObject) ويسيب المتصفح نفسه يرسم
 * النص زى ما بيظهر على الشاشة بالظبط — فالحروف العربية تفضل سليمة. نفس
 * الأسلوب المُثبت بالاختبار فى صفحة "حاسبة الأسعار".
 *
 * ── ليه نسخة (clone) مش العنصر الأصلى؟ ────────────────────────────────────
 * تقارير الطباعة كلها مخفية على الشاشة بـ class="hidden print:block"، وعشان
 * نصوّرها لازم تكون ظاهرة فعلاً وقت التصوير. تعديل العنصر الأصلى فى الـDOM
 * (إظهاره/إزاحته) خطر: React مالكة الشجرة دى وممكن تعيد الرندر فى نص العملية،
 * وكمان بيغيّر تخطيط الصفحة تحت رجل المستخدم. الحل: ناخد نسخة منفصلة
 * (cloneNode) ونحطها فى "مسرح" مؤقت بره الشاشة، ونصوّر النسخة. React
 * مابتلمسش النسخة دى خالص، والصفحة الأصلية مابتتأثرش بحرف.
 *
 * ── ليه مسرح بغلاف مقاس صفر؟ ───────────────────────────────────────────────
 * الإخفاء بـ position: fixed; left: -99999px على العنصر اللى بيتصوّر نفسه
 * بيخلّى html-to-image ينسخ الإزاحة دى جوه صورة الـSVG، فالمحتوى بيقع بره
 * حدود الصورة والناتج يطلع أبيض فاضى. الحل المُثبت: الإخفاء يبقى على غلاف
 * خارجى مقاس صفر (width:0;height:0;overflow:hidden)، والعنصر اللى بيتصوّر
 * مفيهوش أى إزاحة فبيترسم فى مكانه الصحيح (0,0).
 *
 * ── ليه بنقلّد variants الطباعة يدويًا؟ ────────────────────────────────────
 * قواعد @media print مابتتطبقش أثناء العرض العادى، وتقارير الطباعة بتعتمد
 * عليها (print:block لإظهار الترويسة، print:hidden لإخفاء عناصر الشاشة...).
 * فبنحقن ستايل داخل المسرح يقلّد نفس الـvariants دى، فالنسخة اللى بنصوّرها
 * تبقى شكلها = شكل الورق المطبوع بالظبط.
 * ========================================================================== */

import { toCanvas } from 'html-to-image';

/** أبعاد ورقة A4 بالبكسل عند 96dpi (نفس ما بيحسبه المتصفح فى الطباعة) */
const A4_PORTRAIT = { width: 794, height: 1123 };
const A4_LANDSCAPE = { width: 1123, height: 794 };

/** هوامش بيضاء حوالين المحتوى تحاكى هوامش الورقة المطبوعة (≈10-11مم) */
const DEFAULT_PADDING_X = 42;
const DEFAULT_PADDING_Y = 38;

/**
 * العناصر المستبعدة افتراضيًا من الصورة.
 * طلب صريح من المستخدم: "بدون رسومات الشكل البيانى... مش عايز رسومات بيانية
 * فى الحفظ ك صورة". فبنشيل كل حاويات recharts وأى canvas، وأى عنصر متعلّم
 * صراحة بـ data-image-exclude.
 */
const DEFAULT_EXCLUDE_SELECTORS = [
  '[data-image-exclude]',
  '.recharts-responsive-container',
  '.recharts-wrapper',
  '.recharts-surface',
  '.recharts-legend-wrapper',
  '.recharts-tooltip-wrapper',
  'canvas',
];

/**
 * فواصل الصفحات "الإجبارية" — عناصر التقرير المطبوع اللى المفروض تبدأ صفحة
 * جديدة (page-break-before: always). بنحترمها فى تقسيم الصور عشان الصورة
 * تطابق ترقيم الورق المطبوع.
 */
const FORCED_BREAK_SELECTORS = ['.pr-page-break', '[data-image-page-break]'];

export type ImageOrientation = 'portrait' | 'landscape';

export interface SaveAsImageOptions {
  /** اسم الملف بدون امتداد. لو المحتوى أكتر من صفحة بيتحوّل لـ «الاسم-1.png» وهكذا */
  fileName: string;
  /** اتجاه الورقة — landscape للتقارير العريضة (زى إحصائيات الفريق) */
  orientation?: ImageOrientation;
  /** عرض منطقة المحتوى بالبكسل (افتراضيًا = عرض A4 بعد الهوامش) */
  contentWidth?: number;
  /** أقصى ارتفاع لمحتوى الصفحة الواحدة بالبكسل (افتراضيًا = ارتفاع A4 بعد الهوامش) */
  pageHeight?: number;
  /** محدّدات CSS إضافية لعناصر تُستبعد من الصورة */
  excludeSelectors?: string[];
  /** الحد الأقصى لعدد الصور — حماية من تقرير ضخم بالغلط */
  maxPages?: number;
}

export interface SaveAsImageResult {
  /** عدد الصور اللى اتنزّلت فعلاً */
  pages: number;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * أدوات مساعدة
 * ────────────────────────────────────────────────────────────────────────── */

/** انتظار رسم إطارين متتاليين — يضمن إن المتصفح طبّق التخطيط الجديد فعلاً */
function waitForPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * تحويل صورة لـ Data URL. الصور اللى من دومين خارجى (شعار الشركة مثلاً)
 * بتلوّث الـcanvas بسبب قيود CORS فيطلع الناتج أبيض. تحويلها لـBase64
 * من نفس المصدر بيمنع التلويث تمامًا.
 */
async function imageToDataUrl(src: string): Promise<string | null> {
  if (!src || src.startsWith('data:')) return src || null;
  try {
    const response = await fetch(src, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * تحويل كل صور النسخة لـData URL. الصورة اللى تفشل بتتشال خالص بدل ما تسيب
 * مربع مكسور أو تلوّث الـcanvas وتخرّب الناتج كله.
 */
async function inlineImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src) { img.remove(); return; }
      const dataUrl = await imageToDataUrl(src);
      if (dataUrl) {
        img.setAttribute('src', dataUrl);
        img.removeAttribute('srcset');
        img.removeAttribute('loading');
      } else {
        img.remove();
      }
    })
  );
}

/**
 * ستايل يقلّد سلوك الطباعة داخل المسرح المؤقت.
 *
 * تقارير الطباعة بتعتمد على variants بادئتها print: (من Tailwind) وعلى قواعد
 * @media print العامة فى index.css. القواعد دى مش فعّالة وقت العرض العادى،
 * فلو صوّرنا من غيرها الصورة تطلع مختلفة عن الورق (ترويسة الطباعة مختفية،
 * وعناصر الشاشة ظاهرة). الحقن هنا بيخلّى النسخة المصوّرة = شكل الورق بالظبط.
 *
 * ملحوظة: الـ\\: فى الكود بتوصل للـCSS كـ\: وهى طريقة الإشارة لكلاس اسمه
 * فيه نقطتين زى print:block.
 */
function printEmulationCss(): string {
  return `
    [data-print-image-stage] {
      background: #ffffff;
      color-scheme: light;
    }
    /* محاكاة variants الطباعة (@media print) */
    [data-print-image-stage] .print\\:hidden { display: none !important; }
    [data-print-image-stage] .print\\:block { display: block !important; }
    [data-print-image-stage] .print\\:bg-white { background-color: #ffffff !important; }
    [data-print-image-stage] .print\\:shadow-none { box-shadow: none !important; }
    [data-print-image-stage] .print\\:border { border-width: 1px !important; }
    [data-print-image-stage] .print\\:border-secondary-200 { border-color: #e2e8f0 !important; }
    [data-print-image-stage] .print\\:overflow-visible { overflow: visible !important; }
    [data-print-image-stage] .print\\:max-h-none { max-height: none !important; }
    [data-print-image-stage] .print\\:grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
    [data-print-image-stage] .print\\:p-2 { padding: 0.5rem !important; }
    [data-print-image-stage] .print\\:p-3 { padding: 0.75rem !important; }
    [data-print-image-stage] .print\\:space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem !important; }

    /* نفس معالجة جداول التقارير الموجودة فى @media print بـindex.css:
       مفيش تمرير أفقى فى الورق، فالأعمدة لازم تظهر كاملة مع لف النص. */
    [data-print-image-stage] .print-report .table-container {
      overflow: visible !important;
      border: none !important;
    }
    [data-print-image-stage] .print-report .table-container table {
      width: 100% !important;
      table-layout: fixed !important;
    }
    [data-print-image-stage] .print-report .table-container th,
    [data-print-image-stage] .print-report .table-container td {
      white-space: normal !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      font-size: 9px !important;
      padding: 3px 4px !important;
    }
    /* الرأس الثابت (sticky) مفيد على الشاشة بس — فى الورق بيتراكب */
    [data-print-image-stage] .table-container thead th {
      position: static !important;
      box-shadow: none !important;
    }
    /* الأنيميشن مالوش لازمة فى صورة ثابتة، وممكن يتصوّر فى نص حركته */
    [data-print-image-stage] *,
    [data-print-image-stage] *::before,
    [data-print-image-stage] *::after {
      animation: none !important;
      transition: none !important;
    }
  `;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * حساب أماكن قطع الصفحات
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * بنجمّع المجالات الرأسية [أعلى, أسفل] للعناصر "الذرّية" — العناصر اللى
 * مايصحّ نقطعها من نصها (صف جدول، سطر نص، صورة...). أى قطع بيقع جوه مجال
 * منهم معناه إن الصورة هتقص كلام من نصه، وهو بالظبط اللى عايزين نتجنّبه.
 *
 * الصف <tr> بنعتبره ذرّى ومابندخلش جواه: قطع صف جدول من نصه أبشع من قطع
 * أى حاجة تانية فى تقرير محاسبى.
 */
function collectAtomicIntervals(root: HTMLElement): Array<[number, number]> {
  const rootTop = root.getBoundingClientRect().top;
  const intervals: Array<[number, number]> = [];

  const visit = (el: Element): void => {
    const tag = el.tagName.toLowerCase();
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return;

    const isAtomic =
      tag === 'tr' ||
      tag === 'img' ||
      tag === 'svg' ||
      el.children.length === 0;

    if (isAtomic) {
      intervals.push([rect.top - rootTop, rect.bottom - rootTop]);
      return;
    }
    for (const child of Array.from(el.children)) visit(child);
  };

  for (const child of Array.from(root.children)) visit(child);
  return intervals;
}

/** أماكن بداية العناصر اللى المفروض تفتح صفحة جديدة إجباريًا */
function collectForcedBreaks(root: HTMLElement, extraSelectors: string[]): number[] {
  const rootTop = root.getBoundingClientRect().top;
  const selector = [...FORCED_BREAK_SELECTORS, ...extraSelectors].join(', ');
  if (!selector) return [];
  return Array.from(root.querySelectorAll(selector))
    .map((el) => el.getBoundingClientRect().top - rootTop)
    .filter((y) => y > 1)
    .sort((a, b) => a - b);
}

/**
 * تقسيم المحتوى لصفحات.
 *
 * الخطة لكل صفحة:
 *  1) لو فيه فاصل إجبارى جوه مدى الصفحة → نقطع عنده بالظبط (زى الورق).
 *  2) وإلا ندوّر على أعلى نقطة "آمنة" (نهاية عنصر ذرّى) قبل حد الصفحة، عشان
 *     مانقصّش صف أو سطر من نصه.
 *  3) ولو مفيش نقطة آمنة خالص (عنصر واحد أطول من الصفحة كلها) نقطع عند الحد
 *     بدل ما ندخل فى حلقة لا نهائية.
 */
function computePageRanges(
  totalHeight: number,
  pageHeight: number,
  intervals: Array<[number, number]>,
  forcedBreaks: number[],
  maxPages: number,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  // نهايات العناصر الذرّية مرتّبة — مرشّحو القطع الآمن
  const safePoints = Array.from(new Set(intervals.map(([, bottom]) => bottom))).sort((a, b) => a - b);

  const isSafe = (y: number): boolean =>
    !intervals.some(([top, bottom]) => y > top + 0.5 && y < bottom - 0.5);

  let start = 0;
  while (start < totalHeight - 1 && ranges.length < maxPages) {
    const limit = start + pageHeight;

    if (limit >= totalHeight - 1) {
      ranges.push([start, totalHeight]);
      break;
    }

    // (1) فاصل إجبارى جوه المدى؟
    const forced = forcedBreaks.find((y) => y > start + 1 && y <= limit);
    if (forced !== undefined) {
      ranges.push([start, forced]);
      start = forced;
      continue;
    }

    // (2) أعلى نقطة آمنة قبل حد الصفحة
    let cut = -1;
    for (let i = safePoints.length - 1; i >= 0; i--) {
      const y = safePoints[i];
      if (y <= limit && y > start + 1 && isSafe(y)) { cut = y; break; }
    }

    // (3) لا يوجد بديل — قطع عند الحد
    if (cut < 0) cut = limit;

    ranges.push([start, cut]);
    start = cut;
  }

  return ranges.length > 0 ? ranges : [[0, totalHeight]];
}

/* ─────────────────────────────────────────────────────────────────────────────
 * التصوير
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Safari/WebKit عنده مشكلة معروفة: أول تصوير ممكن يرجع صورة ناقصة أو بيضاء
 * (الخطوط/الصور مش بتكون اتحمّلت جوه الـSVG لسه). الحل المعتمد فى مجتمع
 * html-to-image هو التصوير مرتين واستخدام الناتج الأخير — تكلفة أجزاء من
 * الثانية مقابل ضمان صورة كاملة على كل المتصفحات.
 */
async function captureNodeTwice(node: HTMLElement, width: number, height: number): Promise<HTMLCanvasElement> {
  const options = {
    backgroundColor: '#ffffff',
    pixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
    width,
    height,
    // تقارير الطباعة بتستخدم خطوط نظام (Tahoma/Segoe UI/Arial) مش خط ويب،
    // فمش محتاجين تضمين خطوط. وده كمان بيتفادى أخطاء CORS اللى بتطلع لما
    // المكتبة تحاول تقرأ cssRules بتاعة ستايل Google Fonts المحمّل للتطبيق.
    skipFonts: true,
    // ارتفاع التقرير ممكن يكون كبير — بنمنع التصغير التلقائى عشان الصورة
    // ماتطلعش أصغر/أقل وضوحًا من المتوقع.
    skipAutoScale: true,
    style: {
      position: 'relative',
      left: '0',
      top: '0',
      margin: '0',
      transform: 'none',
    } as Partial<CSSStyleDeclaration>,
  };

  let canvas = await toCanvas(node, options);
  canvas = await toCanvas(node, options);
  return canvas;
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/* ─────────────────────────────────────────────────────────────────────────────
 * الدالة الرئيسية
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * يحفظ عنصر تقرير (عادةً المخفى بـ hidden print:block) كصورة PNG أو أكتر،
 * بنفس شكل الطباعة وبدون أى رسومات بيانية.
 *
 * @param source عنصر التقرير المطبوع نفسه (اللى عليه class="print-report" عادةً)
 * @param options اسم الملف والاتجاه وأى استثناءات إضافية
 */
export async function saveElementAsImages(
  source: HTMLElement | null | undefined,
  options: SaveAsImageOptions,
): Promise<SaveAsImageResult> {
  if (!source) throw new Error('عنصر التقرير غير متاح للتصوير');

  const orientation: ImageOrientation = options.orientation ?? 'portrait';
  const paper = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
  const paddingX = DEFAULT_PADDING_X;
  const paddingY = DEFAULT_PADDING_Y;
  const contentWidth = options.contentWidth ?? paper.width - paddingX * 2;
  const pageHeight = options.pageHeight ?? paper.height - paddingY * 2;
  const maxPages = options.maxPages ?? 60;

  // انتظار اكتمال تحميل خطوط الصفحة — عشان النص يترسم بالخط النهائى الصحيح
  // مش بخط مؤقت (fallback) يبوّظ القياسات والمحاذاة.
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* تجاهل */ }
  }

  // ── الغلاف الخارجى: مقاس صفر فبيخفى كل حاجة عن المستخدم، بدون ما يزيح
  //    العنصر اللى بيتصوّر عن نقطة الأصل (شرط أساسى لنجاح التصوير).
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;';

  const styleTag = document.createElement('style');
  styleTag.textContent = printEmulationCss();
  host.appendChild(styleTag);

  // ── «الورقة»: هى العنصر اللى بيتصوّر فعلاً — بعرض A4 مع هوامش بيضاء
  const sheet = document.createElement('div');
  sheet.setAttribute('data-print-image-stage', 'true');
  sheet.setAttribute('dir', 'rtl');
  sheet.style.cssText = [
    `width:${contentWidth + paddingX * 2}px`,
    `padding:${paddingY}px ${paddingX}px`,
    'box-sizing:border-box',
    'background:#ffffff',
    'position:relative',
    'isolation:isolate',
  ].join(';');

  // ── نافذة العرض: بتحدّد الشريحة الرأسية الظاهرة من التقرير لكل صفحة
  const viewport = document.createElement('div');
  viewport.style.cssText = `width:${contentWidth}px;overflow:hidden;position:relative;`;

  // ── المزيح: بنحرّكه لأعلى بمقدار بداية الصفحة فتظهر الشريحة المطلوبة
  const shifter = document.createElement('div');
  shifter.style.cssText = 'position:relative;top:0;';

  const clone = source.cloneNode(true) as HTMLElement;
  // التقرير مخفى على الشاشة بـ hidden (Tailwind) — بنشيل الإخفاء عن النسخة
  // بس، والعنصر الأصلى فى الصفحة مابيتغيّرش خالص.
  clone.classList.remove('hidden');
  clone.style.display = 'block';
  clone.style.position = 'relative';
  clone.style.width = '100%';
  clone.style.margin = '0';
  clone.style.transform = 'none';

  shifter.appendChild(clone);
  viewport.appendChild(shifter);
  sheet.appendChild(viewport);
  host.appendChild(sheet);
  document.body.appendChild(host);

  try {
    // استبعاد الرسومات البيانية وأى عنصر متعلّم للاستبعاد — بنشيلهم من النسخة
    // نفسها (مش بـfilter بتاع المكتبة) عشان القياسات اللى بنحسب بيها تقسيم
    // الصفحات تبقى مطابقة للى بيتصوّر فعلاً.
    const excludeSelector = [...DEFAULT_EXCLUDE_SELECTORS, ...(options.excludeSelectors ?? [])].join(', ');
    clone.querySelectorAll(excludeSelector).forEach((el) => el.remove());

    await inlineImages(clone);
    await waitForPaint();

    // قياس المحتوى بعد الاستبعاد والتخطيط النهائى
    const totalHeight = Math.ceil(clone.getBoundingClientRect().height);
    if (totalHeight <= 0) throw new Error('محتوى التقرير فارغ — لا يوجد ما يُحفظ');

    const intervals = collectAtomicIntervals(clone);
    const forcedBreaks = collectForcedBreaks(clone, []);
    const ranges = computePageRanges(totalHeight, pageHeight, intervals, forcedBreaks, maxPages);
    const multiPage = ranges.length > 1;

    for (let i = 0; i < ranges.length; i++) {
      const [start, end] = ranges[i];
      // كل الصور بنفس ارتفاع الورقة لما المحتوى أكتر من صفحة (إحساس الورق
      // الحقيقى)، وبارتفاع المحتوى بالظبط لما يكون صفحة واحدة (صورة مضبوطة
      // من غير فراغ أبيض زايد) — نفس سلوك صورة عرض السعر.
      const sliceHeight = end - start;
      viewport.style.height = `${multiPage ? pageHeight : sliceHeight}px`;
      shifter.style.top = `${-start}px`;
      await waitForPaint();

      const sheetWidth = Math.ceil(sheet.getBoundingClientRect().width);
      const sheetHeight = Math.ceil(sheet.getBoundingClientRect().height);
      const canvas = await captureNodeTwice(sheet, sheetWidth, sheetHeight);
      const dataUrl = canvas.toDataURL('image/png');

      const name = multiPage
        ? `${options.fileName}-${i + 1}.png`
        : `${options.fileName}.png`;
      downloadDataUrl(dataUrl, name);

      // المتصفحات بتحجب التنزيلات المتتالية السريعة — فسحة صغيرة بين كل صورة
      if (i < ranges.length - 1) await sleep(400);
    }

    return { pages: ranges.length };
  } finally {
    host.remove();
  }
}
