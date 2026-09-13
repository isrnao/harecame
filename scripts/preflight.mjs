import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { RoomServiceClient } from 'livekit-server-sdk';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_LIVEKIT_URL',
  'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'JWT_SECRET', 'ADMIN_KEY',
  'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN', 'APP_URL', 'RECONCILE_SECRET'];
let failed = false;
for (const key of required) {
  const present = !!process.env[key];
  console.log(`${key}: ${present ? 'configured' : 'MISSING'}`);
  if (!present) failed = true;
}
for (const key of ['DATABASE_URL', 'SUPABASE_DB_URL']) console.log(`${key}: ${process.env[key] ? 'configured' : 'MISSING'}`);
try {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await db.from('events').select('id', { head: true, count: 'exact' }).limit(0);
  console.log(`Supabase read: ${error ? `FAILED (${error.code || (/ENOTFOUND/.test(error.details ?? '') ? 'DNS_ENOTFOUND' : /ECONNREFUSED/.test(error.details ?? '') ? 'ECONNREFUSED' : 'transport')})` : 'OK'}`);
  if (error) failed = true;
} catch { failed = true; console.log('Supabase read: FAILED'); }
try {
  const rooms = new RoomServiceClient(process.env.NEXT_PUBLIC_LIVEKIT_URL.replace(/^ws/, 'http'), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  await rooms.listRooms();
  console.log('LiveKit read: OK');
} catch (error) { failed = true; console.log(`LiveKit read: FAILED (${error?.cause?.code || error?.code || 'transport'})`); }
process.exitCode = failed ? 1 : 0;
