import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const base = process.env.WORKER_APP_URL || process.env.APP_URL || 'http://localhost:3000';
const secret = process.env.RECONCILE_SECRET;
if (!secret) throw new Error('RECONCILE_SECRET is required');
let stopped = false;
process.on('SIGINT', () => { stopped = true; });
process.on('SIGTERM', () => { stopped = true; });
while (!stopped) {
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/api/internal/reconcile`, {
      method: 'POST', headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(280000),
    });
    const body = await response.json();
    const failed = body.data?.filter(item => !item.success).length ?? 0;
    if (!response.ok || failed) console.error(`Stream reconciliation needs attention: HTTP ${response.status}, failed events ${failed}`);
  } catch { console.error('Stream reconciliation unavailable; retrying'); }
  for (let i = 0; i < 15 && !stopped; i++) await new Promise(resolve => setTimeout(resolve, 1000));
}
