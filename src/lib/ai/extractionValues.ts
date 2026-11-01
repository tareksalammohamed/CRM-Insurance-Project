// Reading/normalizing source values only. This module never calculates premiums.
export function normalizeDigits(value: string): string {
  return value.normalize('NFKC').replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
}

export function normalizeMeaning(value: string): string {
  return normalizeDigits(value).toLowerCase().replace(/[\u064B-\u065F\u0670ـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[_\s]+/g, ' ').trim();
}

/** Accept one whole decimal, never join two numbers or strip arbitrary words. */
export function readDecimal(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  let value = normalizeDigits(raw).trim().replace(/\u066b/g, '.').replace(/\u066c/g, ',');
  value = value.replace(/^(?:EGP|LE|ج\.?\s?م\.?|جنيه(?:\s+مصري)?)\s*/i, '')
    .replace(/\s*(?:EGP|LE|ج\.?\s?م\.?|جنيه(?:\s+مصري)?)$/i, '').trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\d{1,3}(?:[, ]\d{3})+(?:\.\d+)?)$/.test(value)) return null;
  const number = Number(value.replace(/[, ]/g, ''));
  return Number.isFinite(number) ? number : null;
}

export function calendarDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function readCalendarDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = normalizeDigits(raw).trim();
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  return local ? calendarDate(Number(local[3]), Number(local[2]), Number(local[1])) : null;
}

export function nationalIdBirthDate(value: string): string | null {
  const id = normalizeDigits(value).replace(/[\s-]/g, '');
  if (!/^[23]\d{13}$/.test(id)) return null;
  return calendarDate((id[0] === '2' ? 1900 : 2000) + Number(id.slice(1, 3)), Number(id.slice(3, 5)), Number(id.slice(5, 7)));
}

/** Model prose/fences are tolerated, but malformed or truncated JSON is never repaired. */
export function readJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('لم يصل رد بيانات صالح؛ أعد المحاولة');
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < raw.length; i++) {
    const char = raw[i];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      const result: unknown = JSON.parse(raw.slice(start, i + 1));
      if (result && typeof result === 'object' && !Array.isArray(result)) return result as Record<string, unknown>;
    }
  }
  throw new Error('رد استخراج البيانات غير مكتمل؛ أعد المحاولة');
}
