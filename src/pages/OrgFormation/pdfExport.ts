// مكتبات ثقيلة نادرة الاستخدام — تُحمَّل ديناميكيًا فقط وقت الحاجة الفعلية
// (تنزيل التشكيل كـPDF) بدل تحميلها ضمن الحزمة الرئيسية للتطبيق.
//
// ── ليه html-to-image ومش html2canvas؟ ─────────────────────────────────────
// كنا بنستخدم html2canvas هنا، وده كان بيطلّع التشكيل "ملخبط": html2canvas
// بيعيد رسم الصفحة بنفسه (بدل ما يعتمد على محرك المتصفح)، وده بيكسر خطوط
// الربط بين صناديق التشكيل (مبنية بـ ::before/::after CSS) وبيكسر تشكيل
// الحروف العربية المتصلة كمان. نفس المشكلة والحل موثقين فعلاً فى
// lib/saveAsImage.ts المستخدمة بنجاح فى باقى تقارير التطبيق. html-to-image
// بيحوّل العنصر لـSVG (foreignObject) ويسيب المتصفح نفسه يرسم المحتوى زى ما
// بيظهر فعليًا على الشاشة — فخطوط الربط والحروف العربية تفضل سليمة.
import { toCanvas } from 'html-to-image';

const A4_LANDSCAPE_PT = { width: 841.89, height: 595.28 };

/**
 * تحويل صورة لـData URL. الصور من دومين خارجى (شعار الشركة) بتلوّث الـcanvas
 * بسبب قيود CORS فيطلع الناتج صفحة بيضاء بالغلط. تحويلها لـBase64 بيمنع
 * التلويث ده تمامًا، بدل ما نسيب النجاح متوقف على إعدادات CORS للسيرفر.
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

/** بنشتغل على نسخة (clone) من العنصر الأصلى، فمالوش أى تأثير على الصفحة الحقيقية. */
async function inlineImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src) return;
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

export async function exportNodeToPdf(node: HTMLElement, fileName: string): Promise<void> {
  const { jsPDF } = await import('jspdf');

  // ننتظر تحميل الخطوط فعليًا قبل التصوير — لو الخط لسه بيتحمّل وقت اللقطة،
  // القياسات بتتغيّر لحظيًا فيطلع النص والصناديق فوق بعض فى الصورة الناتجة.
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* تجاهل */ }
  }

  // نسخة منفصلة من العنصر عشان نقدر نحوّل صور الشعار لـData URL من غير ما
  // نلمس العنصر الأصلى فى الصفحة (اللى React مالكة له).
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.position = 'relative';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.margin = '0';
  clone.style.transform = 'none';

  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;';
  stage.appendChild(clone);
  document.body.appendChild(stage);

  try {
    await inlineImages(clone);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const width = clone.scrollWidth || node.scrollWidth;
    const height = clone.scrollHeight || node.scrollHeight;

    const options = {
      backgroundColor: '#ffffff',
      pixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
      width,
      height,
      skipFonts: true,
      skipAutoScale: true,
      style: { position: 'relative', left: '0', top: '0', margin: '0', transform: 'none' } as Partial<CSSStyleDeclaration>,
    };

    // Safari/WebKit ممكن يرجّع لقطة أولى ناقصة (الخطوط/الصور لسه مش متحمّلة
    // جوه الـSVG) — بنصوّر مرتين ونستخدم الناتج الأخير، نفس الأسلوب المُثبت
    // فى saveAsImage.ts.
    let canvas = await toCanvas(clone, options);
    canvas = await toCanvas(clone, options);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = A4_LANDSCAPE_PT.width;
    const pageH = A4_LANDSCAPE_PT.height;

    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    if (imgH <= pageH + 1) {
      // يتسع فى صفحة واحدة
      const y = (pageH - imgH) / 2 > 0 ? (pageH - imgH) / 2 : 0;
      doc.addImage(imgData, 'PNG', 0, y, imgW, imgH);
    } else {
      // احتياطى: تجاوز صفحة واحدة رغم التصغير التدريجى — يُقسَّم على عدة صفحات
      let heightLeft = imgH;
      let position = 0;
      doc.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
    }

    doc.save(fileName);
  } finally {
    stage.remove();
  }
}
