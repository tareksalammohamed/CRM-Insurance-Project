/** Complete ordered reads; never return a silently truncated or failed page. */
export async function fetchAllRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>): Promise<T[]> {
  const rows: T[] = [];
  let expected: number | undefined;
  do {
    const page = await fetchPage(rows.length, rows.length + 499);
    if (page.error) throw page.error;
    if (page.count === null || (expected !== undefined && page.count !== expected)) throw new Error('تغيّر عدد السجلات أثناء التحميل؛ أعد المحاولة لضمان اكتمال البيانات.');
    expected = page.count;
    if (!page.data?.length && rows.length < expected) throw new Error('تعذر تحميل كل السجلات؛ أعد المحاولة.');
    rows.push(...(page.data || []));
  } while (rows.length < expected);
  return rows;
}
