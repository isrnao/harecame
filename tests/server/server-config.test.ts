import { test } from 'node:test';
import assert from 'node:assert/strict';
test('the server DB client requires its service key but not an anon key', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { supabase, supabaseAdmin } = await import('../../src/lib/supabase');
  assert.equal(supabase, null);
  assert.ok(supabaseAdmin);
});
