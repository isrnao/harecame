import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
process.loadEnvFile('.env.local');
const adminKey = randomBytes(32).toString('hex');
const workerSecret = randomBytes(32).toString('hex');
const base = 'http://127.0.0.1:3100';
const fd = openSync('/private/tmp/harecame-browser-server.log', 'w', 0o600);
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3100', '-H', '127.0.0.1'], {
  env: { ...process.env, ADMIN_KEY: adminKey, RECONCILE_SECRET: workerSecret, APP_URL: base, NODE_ENV: 'development' },
  stdio: ['ignore', fd, fd],
});
let browser;
let cameraPage;
let eventId;
let adminCookie;
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json() };
}
try {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/login`)).ok) break; } catch { /* wait for server */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const login = await request('/api/auth/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminKey }) });
  assert.equal(login.response.status, 200);
  adminCookie = login.response.headers.get('set-cookie').split(';')[0];
  const authHeaders = { cookie: adminCookie, 'Content-Type': 'application/json' };
  const created = await request('/api/events', { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: '自動検証用イベント' }) });
  assert.equal(created.response.status, 201); eventId = created.body.data.event.id;
  const participationCode = created.body.data.event.participationCode;
  const publicResult = await request(`/api/events/${eventId}`);
  assert.equal(publicResult.body.data.event.participationCode, undefined);
  assert.equal(publicResult.body.data.event.youtubeStreamKey, undefined);
  assert.equal((await request(`/api/events/${eventId}?include_cameras=true`)).response.status, 401);
  assert.equal((await request('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'unauthorized' }) })).response.status, 401);
  const handoff = await request(`/api/events/${eventId}/organizer-token`, { method: 'POST', headers: authHeaders, body: '{}' });
  assert.equal(handoff.response.status, 200);
  const organizer = await request('/api/auth/organizer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: handoff.body.data.token }) });
  assert.equal(organizer.response.status, 200);
  const scopedCookie = organizer.response.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/events/11111111-1111-4111-8111-111111111111?include_cameras=true', { headers: { cookie: scopedCookie } })).response.status, 403);
  console.log('PASS API: login, event creation, public DTO, anonymous denial and cross-event denial');
  browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext({ permissions: ['camera','microphone'], viewport: { width: 1280, height: 900 } });
  // Deterministic synthetic tracks avoid OS camera/microphone dialogs on CI.
  // The actual LiveKit client, transport, tokens and provider are still used.
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const paint = () => { const c = canvas.getContext('2d'); c.fillStyle = '#183f50'; c.fillRect(0, 0, 1280, 720);
        c.fillStyle = 'white'; c.font = '48px sans-serif'; c.fillText('Harecame camera verification', 80, 160); c.fillText(new Date().toISOString(), 80, 250); };
      paint(); const timer = setInterval(paint, 100);
      const stream = canvas.captureStream(10);
      const audio = new AudioContext(); const destination = audio.createMediaStreamDestination();
      const tone = audio.createOscillator(); const gain = audio.createGain(); gain.gain.value = 0.01;
      tone.connect(gain).connect(destination); tone.start(); void audio.resume();
      destination.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      for (const track of stream.getTracks()) { const stop = track.stop.bind(track); track.stop = () => { stop(); clearInterval(timer); void audio.close().catch(() => {}); }; }
      return stream;
    };
  });
  const page = await context.newPage(); cameraPage = page;
  await page.goto(`${base}/camera/join?code=${participationCode}`);
  await page.getByLabel(/参加者名/).fill('検証カメラ');
  await page.getByRole('button', { name: /参加/ }).click();
  await page.waitForURL(`**/camera/${eventId}`, { timeout: 45000 });
  await page.getByRole('button', { name: 'カメラを開始', exact: true }).click();
  await page.getByText('映像送信中', { exact: true }).waitFor({ timeout: 45000 });
  // Reconcile actual LiveKit publishing state, without creating any YouTube output.
  let dashboard;
  for (let attempt = 0; attempt < 10; attempt++) {
    const reconcile = await request('/api/internal/reconcile', { method: 'POST', headers: { Authorization: `Bearer ${workerSecret}` } });
    assert.equal(reconcile.response.status, 200);
    dashboard = await request(`/api/events/${eventId}?include_cameras=true&include_status=true`, { headers: authHeaders });
    if (dashboard.body.data.cameras.some(camera => camera.status === 'active')) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(dashboard.body.data.cameras.some(camera => camera.status === 'active'));
  assert.equal(dashboard.body.data.streamStatus.isLive, false);
  await page.screenshot({ path: '/private/tmp/harecame-camera-smoke.png' });
  await page.getByRole('button', { name: '送信を停止' }).click();
  await page.getByText('未接続', { exact: true }).waitFor();
  await page.getByRole('button', { name: '再接続', exact: true }).click();
  await page.getByText('映像送信中', { exact: true }).waitFor({ timeout: 45000 });
  console.log('PASS browser: camera join, publish two tracks, provider presence, stop and reconnect');
  await page.getByRole('button', { name: '送信を停止' }).click();
  await context.close();
  const operator = await browser.newContext();
  await operator.addCookies([{ name: 'harecame-session', value: adminCookie.slice('harecame-session='.length), url: base }]);
  const dashboardPage = await operator.newPage();
  await dashboardPage.goto(`${base}/events/${eventId}/dashboard`);
  await dashboardPage.getByText('配信操作', { exact: true }).waitFor();
  await dashboardPage.getByText('未開始', { exact: true }).waitFor();
  await dashboardPage.screenshot({ path: '/private/tmp/harecame-dashboard-smoke.png', fullPage: true });
  console.log('PASS browser: authenticated dashboard and stream controls');
} catch (error) {
  if (cameraPage && !cameraPage.isClosed()) {
    console.log('Camera page alerts:', await cameraPage.getByRole('alert').allTextContents());
    await cameraPage.screenshot({ path: '/private/tmp/harecame-camera-failure.png' }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  // Delete only this run's newly created test event, never existing project data.
  if (eventId && adminCookie) {
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { RoomServiceClient } = await import('livekit-server-sdk');
    const { data } = await db.from('events').select('livekit_room_name').eq('id', eventId).single();
    if (data) {
      const rooms = new RoomServiceClient(process.env.NEXT_PUBLIC_LIVEKIT_URL.replace(/^ws/, 'http'), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
      await rooms.deleteRoom(data.livekit_room_name).catch(() => {});
    }
    await db.from('events').delete().eq('id', eventId);
  }
  server.kill('SIGTERM'); closeSync(fd);
}
