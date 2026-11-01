// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
const migration = readFileSync(new URL('../supabase/migrations/20261101080011_operational_reporting_month.sql', import.meta.url), 'utf8');
it('uses only the previous month explicit extension, inclusive Cairo days, and a read-only invoker context', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE closing_period_extensions (month date PRIMARY KEY, extended_until date NOT NULL);
      ALTER TABLE closing_period_extensions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY read_extensions ON closing_period_extensions FOR SELECT TO authenticated USING (true);
      GRANT SELECT ON closing_period_extensions TO authenticated;
    `);
    const at = async (time: string) => {
      await db.exec(migration.replaceAll('CURRENT_TIMESTAMP', `TIMESTAMPTZ '${time}'`));
      return (await db.query<{ reporting_month: string; cairo_date: string; extended_until: string | null; valid_until: string }>("SELECT reporting_month::text, cairo_date::text, extended_until::text, valid_until::text FROM get_operational_reporting_month()")).rows[0];
    };
    expect((await at('2026-11-01 08:00+00')).reporting_month).toBe('2026-11-01');
    await db.exec("INSERT INTO closing_period_extensions VALUES ('2026-10-01', '2026-11-01')");
    expect((await at('2026-10-31 22:00+00')).reporting_month).toBe('2026-10-01');
    expect((await at('2026-11-01 21:59:59+00')).reporting_month).toBe('2026-10-01');
    const next = await at('2026-11-01 22:00+00');
    expect([next.cairo_date, next.reporting_month, next.extended_until]).toEqual(['2026-11-02', '2026-11-01', null]);
    expect((await at('2026-12-01 08:00+00')).reporting_month).toBe('2026-12-01');
    await db.exec("INSERT INTO closing_period_extensions VALUES ('2026-12-01', '2027-01-01'), ('2027-01-01', '2027-02-05')");
    expect((await at('2027-01-01 12:00+00')).reporting_month).toBe('2026-12-01');
    expect((await at('2027-01-02 12:00+00')).reporting_month).toBe('2027-01-01');
    expect((await at('2027-02-05 21:59:59+00')).reporting_month).toBe('2027-01-01');
    expect((await at('2027-02-05 22:00+00')).reporting_month).toBe('2027-02-01');
    await at('2026-11-01 12:00+00');
    const properties = (await db.query<{ prosecdef: boolean }>("SELECT prosecdef FROM pg_proc WHERE proname='get_operational_reporting_month'")).rows[0];
    expect(properties.prosecdef).toBe(false);
    await db.exec('SET ROLE authenticated');
    expect((await db.query<{ reporting_month: string }>('SELECT reporting_month::text FROM get_operational_reporting_month()')).rows[0].reporting_month).toBe('2026-10-01');
    await db.exec('RESET ROLE; SET ROLE anon');
    await expect(db.query('SELECT * FROM get_operational_reporting_month()')).rejects.toThrow('permission denied');
    await db.exec('RESET ROLE');
    expect((await db.query('SELECT * FROM closing_period_extensions')).rows).toHaveLength(3);
  } finally { await db.close(); }
}, 30_000);
