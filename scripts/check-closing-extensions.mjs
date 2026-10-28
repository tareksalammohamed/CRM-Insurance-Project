import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec(await readFile(new URL('../tests/sql/closing-extensions-bootstrap.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261005104333_collection_server_pagination.sql', import.meta.url), 'utf8'));
  await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)");
  const normalPage = await db.query("select public.get_collection_page('paid','all',1,'',null,null,'2998-12-01') as page");
  const before = await db.query('select row_to_json(p) as row from public.payments p order by id');
  await db.exec(await readFile(new URL('../supabase/migrations/20261028084546_closing_period_extensions.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await db.query('select * from public.closing_period_extensions')).rows, []);
  assert.deepEqual(before.rows, (await db.query("select to_jsonb(p) - 'closing_month' - 'closing_extension_id' as row from public.payments p order by id")).rows);
  assert.deepEqual((await db.query("select public.get_collection_page('paid','all',1,'',null,null,'2998-12-01') as page")).rows, normalPage.rows);
  await db.exec(await readFile(new URL('../supabase/tests/closing_period_extensions.sql', import.meta.url), 'utf8'));
  console.log('PASS isolated PostgreSQL: normal periods, explicit backfill, Cairo cutoff, cancellation, immutability, concurrency guards, drill-down and RLS');
} finally { await db.close(); }
