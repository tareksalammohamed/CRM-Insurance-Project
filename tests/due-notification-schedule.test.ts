// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const migration = readFileSync(new URL('../supabase/migrations/20261101072549_due_notifications_cairo_morning.sql', import.meta.url), 'utf8');

it('reschedules only due notifications and executes once at 10 Cairo across winter, summer and clock changes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA cron;
      CREATE TABLE cron.job (jobid bigint PRIMARY KEY, jobname text, schedule text, command text, active boolean, database text, username text);
      INSERT INTO cron.job VALUES
        (51, 'create-due-notifications', '5 1 * * *', 'SELECT public.create_due_notifications();', false, 'app_db', 'app_owner'),
        (52, 'update-overdue-installments', '0 1 * * *', 'SELECT public.update_overdue_installments();', true, 'app_db', 'app_owner');
      CREATE FUNCTION cron.alter_job(job_id bigint, schedule text DEFAULT NULL, command text DEFAULT NULL)
      RETURNS void LANGUAGE plpgsql AS $$ BEGIN
        UPDATE cron.job j SET schedule = coalesce(alter_job.schedule, j.schedule), command = coalesce(alter_job.command, j.command) WHERE j.jobid = job_id;
      END $$;
      CREATE TABLE public.test_notification_calls (called_at timestamptz);
      CREATE FUNCTION public.create_due_notifications() RETURNS void LANGUAGE sql AS $$ INSERT INTO public.test_notification_calls VALUES (CURRENT_TIMESTAMP) $$;
    `);
    const before = await db.query('SELECT * FROM cron.job WHERE jobid = 52');
    await db.exec(migration);
    await db.exec(migration);
    const job = (await db.query<{ schedule: string; command: string; active: boolean; database: string; username: string }>('SELECT * FROM cron.job WHERE jobid = 51')).rows[0];
    expect(job.schedule).toBe('0 7,8 * * *');
    expect([job.active, job.database, job.username]).toEqual([false, 'app_db', 'app_owner']);
    expect((await db.query('SELECT * FROM cron.job WHERE jobid = 52')).rows).toEqual(before.rows);
    // Check every day, including the Cairo spring/autumn clock transitions.
    const days = (await db.query<{ calls: number; hour: number }>(`
      SELECT count(*) FILTER (WHERE local_hour = 10)::int AS calls,
             min(local_hour) FILTER (WHERE local_hour = 10)::int AS hour
      FROM (
        SELECT d::date AS day, extract(hour from ((d::date + make_time(h, 0, 0)) AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Cairo') AS local_hour
        FROM generate_series(date '2026-01-01', date '2027-12-31', interval '1 day') d
        CROSS JOIN unnest(ARRAY[7,8]) h
      ) times GROUP BY day
    `)).rows;
    expect(days).toHaveLength(730);
    expect(days.every(day => day.calls === 1 && day.hour === 10)).toBe(true);
    // Exercise the deployed command itself with transaction-local test clocks.
    const at = (date: string) => job.command.replace('CURRENT_TIMESTAMP', `TIMESTAMPTZ '${date}'`);
    await db.exec(at('2026-01-01 07:00:00+00')); // 09:00 winter: must not send.
    await db.exec(at('2026-07-01 08:00:00+00')); // 11:00 summer: must not send.
    expect((await db.query('SELECT * FROM test_notification_calls')).rows).toHaveLength(0);
    await db.exec(at('2026-01-01 08:00:00+00')); // 10:00 winter.
    await db.exec(at('2026-07-01 07:00:00+00')); // 10:00 summer.
    expect((await db.query('SELECT * FROM test_notification_calls')).rows).toHaveLength(2);
    await db.exec("UPDATE cron.job SET command = 'SELECT unrelated();' WHERE jobid = 51");
    await expect(db.exec(migration)).rejects.toThrow('Unexpected command');
  } finally { await db.close(); }
}, 30_000);
