import { friendlyError } from '../../lib/errorMessages';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { isOnline } from '../../lib/networkManager';

// ملاحظة: النسخة الاحتياطية بتصدّر كل صفوف الجداول كاملة وقت الطلب، وده
// عكس فكرة كاش DAL (اللي مصمم لآخر نتيجة قراءة محدودة الحجم لعرضها فى
// صفحة). لذلك هي الاستثناء الوحيد المتعمد من المرور عبر DAL: بدل الكاش،
// بنتأكد من وجود اتصال فعلي قبل البدء وبنوقف فوراً برسالة واضحة لو انقطع
// الاتصال أثناء التصدير، بدل ما نرجّع نسخة جزئية أو قديمة من قاعدة البيانات.

// كل الجداول اللي بتتاخد منها نسخة احتياطية، وترتيبها في ملف الإكسيل
const BACKUP_TABLES: { table: string; sheetName: string }[] = [
  { table: 'customers', sheetName: 'العملاء' },
  { table: 'customer_followups', sheetName: 'متابعات ووعود السداد' },
  { table: 'policies', sheetName: 'الوثائق' },
  { table: 'installments', sheetName: 'الأقساط' },
  { table: 'payments', sheetName: 'المدفوعات' },
  { table: 'year2_payments', sheetName: 'تحصيلات السنة الثانية' },
  { table: 'closing_period_extensions', sheetName: 'تمديدات الإقفال' },
  { table: 'monthly_closings', sheetName: 'تقفيلات الشهور' },
  { table: 'users', sheetName: 'المستخدمون' },
  { table: 'settings', sheetName: 'الإعدادات' },
  { table: 'commission_rate_schedule', sheetName: 'نسب العمولات' }
];

export type BackupProgress = { table: string; done: number; total: number };

// بتجيب كل الجداول (حسب صلاحيات المستخدم الحالي عبر RLS) وتبني ملف Excel
// فيه شيت لكل جدول، وبترجع اسم الملف وعدد الصفوف الكلي
export async function runDatabaseBackup(
  onProgress?: (p: BackupProgress) => void
): Promise<{ fileName: string; totalRows: number }> {
  if (!isOnline()) {
    throw new Error('لا يوجد اتصال بالإنترنت. النسخة الاحتياطية تحتاج اتصال فعلي لتصدير أحدث بيانات قاعدة البيانات كاملة.');
  }

  const startedAt = new Date().toISOString();
  const manifest: (string | number)[][] = [['الجدول', 'ورقة البيانات', 'عدد السجلات المصدّرة']];
  const workbook = XLSX.utils.book_new();
  let totalRows = 0;

  for (let i = 0; i < BACKUP_TABLES.length; i++) {
    const { table, sheetName } = BACKUP_TABLES[i];
    onProgress?.({ table: sheetName, done: i, total: BACKUP_TABLES.length });

    if (!isOnline()) {
      throw new Error(`انقطع الاتصال بالإنترنت أثناء تصدير جدول "${sheetName}". حاول مرة أخرى بعد التأكد من الاتصال.`);
    }

    const rows: Record<string, unknown>[] = [];
    const pageSize = 500;
    const orderColumn = table === 'commission_rate_schedule' ? 'effective_from' : 'id';
    for (let offset = 0; ; offset += pageSize) {
      if (!isOnline()) throw new Error('انقطع الاتصال أثناء التصدير؛ أعد المحاولة للحصول على ملف كامل.');
      const { data, error } = await supabase.from(table).select('*').order(orderColumn).range(offset, offset + pageSize - 1);
      if (error) throw new Error(`تعذر تصدير جدول "${sheetName}": ${friendlyError(error)}`);
      rows.push(...(data || []));
      onProgress?.({ table: `${sheetName} — ${rows.length} سجل`, done: i, total: BACKUP_TABLES.length });
      if (!data || data.length < pageSize) break;
    }
    totalRows += rows.length;
    manifest.push([table, sheetName, rows.length]);

    const sheet = rows.length
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([['لا توجد بيانات']]);

    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['نطاق التصدير', 'الجداول المحددة حسب صلاحيات الحساب الحالي، وليس نسخة استعادة كاملة للنظام'],
    ['بداية التصدير', startedAt], ['نهاية التصدير', new Date().toISOString()],
    ['تنبيه', 'تُقرأ الجداول بالتتابع؛ الملف ليس لقطة ذرية واحدة لقاعدة البيانات'],
    ...manifest,
  ]), 'دليل التصدير');

  onProgress?.({ table: '', done: BACKUP_TABLES.length, total: BACKUP_TABLES.length });

  const fileName = `نسخة-احتياطية-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return { fileName, totalRows };
}
