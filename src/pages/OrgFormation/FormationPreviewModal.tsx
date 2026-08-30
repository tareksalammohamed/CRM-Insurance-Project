import { useEffect, useRef, useState } from 'react';
import { X, Download, Printer, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useSettings } from '../../hooks/useSettings';
import { OrgChartTree, type ChartDensity } from './OrgChartTree';
import { countChartEntities, type OrgChartNode } from './orgChartBuilder';
import { exportNodeToPdf } from './pdfExport';
import { printWithTitle } from '../../lib/printWithTitle';
import { useNotify } from '../../lib/notify';
import { useDialogBehavior } from '../../hooks/useDialogBehavior';
import { DialogPortal } from '../../components/ui/DialogPortal';

interface FormationPreviewModalProps {
  heads: OrgChartNode[];
  branchName: string;
  asOfDate: string; // yyyy-MM-dd
  onClose: () => void;
}

const CHART_WIDTH = 1400; // عرض ثابت (بكسل) يماثل نسبة صفحة A4 أفقية عند التصدير/الطباعة
const TARGET_RATIO = 210 / 297; // ارتفاع/عرض A4 أفقية
// مساحة الطباعة الفعلية داخل A4 أفقية بعد هامش 10مم من كل جانب، بمقياس
// 96dpi (نفس افتراض بقية أدوات الطباعة/الحفظ كصورة فى المشروع):
// (297 - 20) مم × 3.7795 بكسل/مم ≈ 1047px. الشارت ثابت العرض عند
// CHART_WIDTH، فبنصغّره بنسبة zoom ثابتة عشان يتسع فى عرض الورقة.
const PRINT_USABLE_WIDTH_PX = Math.round((297 - 20) * 3.7795);
const PRINT_ZOOM = Number((PRINT_USABLE_WIDTH_PX / CHART_WIDTH).toFixed(4));
const DENSITY_ORDER: ChartDensity[] = ['xl', 'lg', 'md', 'sm', 'xs'];

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function FormationPreviewModal({ heads, branchName, asOfDate, onClose }: FormationPreviewModalProps) {
  const { branding } = useSettings();
  const notify = useNotify();
  const chartRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [density, setDensity] = useState<ChartDensity>('xl');
  const [fitting, setFitting] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'download' | 'print' | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [chartHeightPx, setChartHeightPx] = useState(0);

  const asOfDateLabel = (() => {
    try {
      return format(new Date(`${asOfDate}T00:00:00`), 'd MMMM yyyy', { locale: ar });
    } catch {
      return asOfDate;
    }
  })();

  // ── محاولة ضبط الكثافة تلقائيًا لأصغر حجم يحافظ على صفحة واحدة قدر الإمكان ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFitting(true);
      const { boxes, agents } = countChartEntities(heads);
      const total = boxes + agents;
      let startIdx = 0;
      if (total > 220) startIdx = 4;
      else if (total > 150) startIdx = 3;
      else if (total > 90) startIdx = 2;
      else if (total > 45) startIdx = 1;

      for (let i = startIdx; i < DENSITY_ORDER.length; i++) {
        if (cancelled) return;
        setDensity(DENSITY_ORDER[i]);
        await nextFrame();
        await nextFrame();
        const el = chartRef.current;
        if (!el) continue;
        const ratio = el.scrollHeight / el.scrollWidth;
        if (ratio <= TARGET_RATIO * 1.03 || i === DENSITY_ORDER.length - 1) break;
      }
      if (!cancelled) {
        setFitting(false);
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── حساب مقياس المعاينة على الشاشة (thumbnail) عشان تتناسب مع عرض النافذة ──
  useEffect(() => {
    const el = chartRef.current;
    const wrapperEl = wrapperRef.current;
    if (!el || !wrapperEl) return;

    const update = () => {
      const w = el.scrollWidth || CHART_WIDTH;
      const h = el.scrollHeight || 0;
      setChartHeightPx(h);
      const availW = wrapperEl.clientWidth;
      setPreviewScale(availW > 0 ? Math.min(1, availW / w) : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapperEl);
    const t = setTimeout(update, 250);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [density, ready]);

  const handleDownload = async () => {
    if (!exportRef.current || busy) return;
    setBusy('download');
    try {
      const fileName = `تشكيل-الجهاز-الإنتاجي${branchName ? `-${branchName}` : ''}.pdf`;
      await exportNodeToPdf(exportRef.current, fileName);
    } catch (err) {
      console.error('Error exporting formation PDF:', err);
      notify.error('حدث خطأ أثناء إنشاء ملف PDF');
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = () => {
    if (!exportRef.current || busy) return;
    // نفس أسلوب باقي أزرار الطباعة فى التطبيق: طباعة النافذة الحالية مباشرةً
    // (window.print) بدل فتح نافذة منفصلة ونسخ الـHTML يدويًا لها — أسلوب
    // النافذة المنفصلة كان بيطلّع صفحة بيضاء أحيانًا لو الخطوط/الصور
    // ماخلصتش تحميل قبل استدعاء print() بالمهلة الثابتة.
    printWithTitle(`تشكيل الجهاز الإنتاجي${branchName ? ` - ${branchName}` : ''}`);
  };


  // Escape للإغلاق + قفل تمرير الخلفية + إرجاع التركيز للعنصر المُستدعى
  useDialogBehavior(onClose);

  return (
    <DialogPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content max-w-6xl w-full animate-fadeIn p-0 overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          style={{ maxHeight: '92vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-secondary-200 flex-shrink-0">
            <h3 className="text-base sm:text-lg font-semibold text-secondary-900">معاينة تشكيل الجهاز الإنتاجي</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={!ready || busy !== null}
                className="btn btn-primary text-xs sm:text-sm"
              >
                {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>تنزيل PDF</span>
              </button>
              <button
                onClick={handlePrint}
                disabled={!ready || busy !== null}
                className="btn btn-secondary text-xs sm:text-sm"
              >
                {busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>طباعة</span>
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary-100 flex-shrink-0" title="إغلاق المعاينة">
                <X className="w-5 h-5 text-secondary-600" />
              </button>
            </div>
          </div>

          {/* Body: preview area */}
          <div ref={wrapperRef} className="flex-1 overflow-auto bg-secondary-100 p-4 sm:p-8">
            {fitting && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="w-7 h-7 text-primary-600 animate-spin" />
                <p className="text-sm text-secondary-500">جاري تجهيز المعاينة...</p>
              </div>
            )}
            <div
              style={{
                width: CHART_WIDTH * previewScale,
                height: chartHeightPx ? chartHeightPx * previewScale : undefined,
                margin: '0 auto',
                visibility: fitting ? 'hidden' : 'visible',
                position: fitting ? 'absolute' : 'static',
                boxShadow: '0 4px 18px rgba(15,23,42,.18)',
              }}
            >
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center' }}>
                <OrgChartTree
                  ref={chartRef}
                  heads={heads}
                  branchName={branchName}
                  asOfDateLabel={asOfDateLabel}
                  companyName={branding.company_name}
                  companyLogoUrl={branding.company_logo_url}
                  density={density}
                  widthPx={CHART_WIDTH}
                />
              </div>
            </div>
          </div>

          {/* نسخة بحجمها الطبيعي (بدون أي transform على أي عنصر أب) تُستخدم كمصدر
              للتصدير (PDF) ومصدر الطباعة الفعلي معًا:
              - على الشاشة: مخفية بـ hidden (Tailwind) — بعيدة تمامًا عن أي إزاحة
                خارج الشاشة، لأن exportNodeToPdf بياخد نسخة (clone) منها بنفسه
                فمش محتاجة تتوضع فعليًا برّا الشاشة.
              - وقت الطباعة: print:block يظهرها + كلاس print-report يخليها
                الوحيدة الظاهرة (قاعدة عامة فى index.css بتخفي كل حاجة تانية فى
                الصفحة تلقائيًا)، مع zoom بمقياس ثابت يحوّل عرضها الثابت
                (CHART_WIDTH) لعرض ورقة A4 أفقية القابل للطباعة فعليًا. */}
          <div className="hidden print:block print-report" aria-hidden="true">
            <style>{`
              @media print {
                @page { size: A4 landscape; margin: 10mm; }
                .of-print-scale { zoom: ${PRINT_ZOOM}; }
              }
            `}</style>
            <div className="of-print-scale">
              <OrgChartTree
                ref={exportRef}
                heads={heads}
                branchName={branchName}
                asOfDateLabel={asOfDateLabel}
                companyName={branding.company_name}
                companyLogoUrl={branding.company_logo_url}
                density={density}
                widthPx={CHART_WIDTH}
              />
            </div>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
