-- Retain the existing job, notification rules, recipients and deduplication.
-- pg_cron runs in GMT on this project. Cairo is UTC+2 in winter and UTC+3
-- in summer: check both candidate hours, but call the existing function only
-- at 10:00 Africa/Cairo. Do not change the database/cron global timezone.
DO $migration$
DECLARE
  due_job_id bigint;
  previous_command text;
  morning_command constant text := $command$SELECT public.create_due_notifications()
WHERE EXTRACT(HOUR FROM CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo') = 10;$command$;
BEGIN
  SELECT jobid, command INTO STRICT due_job_id, previous_command
  FROM cron.job
  WHERE jobname = 'create-due-notifications';

  -- Refuse to overwrite an unrelated/customized task. Reapplying is safe.
  IF lower(regexp_replace(previous_command, '\s+', '', 'g')) NOT IN (
    'selectpublic.create_due_notifications();',
    lower(regexp_replace(morning_command, '\s+', '', 'g'))
  ) THEN
    RAISE EXCEPTION 'Unexpected command for create-due-notifications; review before rescheduling';
  END IF;

  PERFORM cron.alter_job(
    job_id := due_job_id,
    schedule := '0 7,8 * * *',
    command := morning_command
  );
END;
$migration$;
