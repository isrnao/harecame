import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL enforces private tables, partial patches, leases and atomic camera admission', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text';
      CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';`);
    const initial = (await readFile('supabase/migrations/20250719192429_create_harecame_schema.sql', 'utf8'))
      .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '');
    await db.exec(initial);
    await db.exec(await readFile('supabase/migrations/202609130001_server_data_boundary.sql', 'utf8'));
    await db.exec(await readFile('supabase/migrations/202609130002_stream_control.sql', 'utf8'));
    const id = '11111111-1111-4111-8111-111111111111';
    await db.query('INSERT INTO events(id,title,participation_code,livekit_room_name) VALUES($1,$2,$3,$4)', [id,'試合','ABCDEF','room']);
    await db.query('SELECT patch_stream_status($1,$2)', [id, { is_live: true, youtube_viewer_count: 42 }]);
    await db.query('SELECT patch_stream_status($1,$2)', [id, { active_camera_count: 2 }]);
    const { rows: [status] } = await db.query<{ is_live: boolean; youtube_viewer_count: number }>('SELECT * FROM stream_status');
    assert.equal(status!.is_live, true); assert.equal(status!.youtube_viewer_count, 42);
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM events'));
    await assert.rejects(db.query('SELECT patch_stream_status($1,$2)', [id, {}]));
    await db.exec('RESET ROLE');
    const lease1 = '22222222-2222-4222-8222-222222222222', lease2 = '33333333-3333-4333-8333-333333333333';
    assert.equal((await db.query<{ ok: boolean }>('SELECT acquire_stream_lease($1,$2) AS ok', [id,lease1])).rows[0]!.ok, true);
    assert.equal((await db.query<{ ok: boolean }>('SELECT acquire_stream_lease($1,$2) AS ok', [id,lease2])).rows[0]!.ok, false);
    const joined = await db.query<{ id: string }>('SELECT (join_camera($1,$2,$3,$4)).*', [id,'identity','camera',{}]);
    const retried = await db.query<{ id: string }>('SELECT (join_camera($1,$2,$3,$4)).*', [id,'identity','camera',{}]);
    assert.equal(joined.rows[0]!.id, retried.rows[0]!.id);
    for (let i = 0; i < 9; i++) await db.query('SELECT join_camera($1,$2,$3,$4)', [id,`other-${i}`,'camera',{}]);
    await assert.rejects(db.query('SELECT join_camera($1,$2,$3,$4)', [id,'overflow','camera',{}]));
    await db.query("UPDATE events SET status = 'ended' WHERE id = $1", [id]);
    await assert.rejects(db.query('SELECT join_camera($1,$2,$3,$4)', [id,'identity','camera',{}]));
  } finally { await db.close(); }
});
