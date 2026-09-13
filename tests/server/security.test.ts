import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
process.env.JWT_SECRET = 'test-signing-secret-with-at-least-32-characters';
process.env.LIVEKIT_API_KEY = 'test-api-key';
process.env.LIVEKIT_API_SECRET = 'test-livekit-secret-at-least-32-characters';
const modules = async () => {
const { AuthService } = await import('../../src/lib/auth');
const { authorize, requestActor } = await import('../../src/server/access');
const { generateAccessToken } = await import('../../src/server/livekit');
const { jwtVerify, SignJWT } = await import('jose');
const { WebhookReceiver } = await import('livekit-server-sdk');

return { AuthService, authorize, requestActor, generateAccessToken, jwtVerify, SignJWT, WebhookReceiver };
};

test('signed organizer sessions cannot cross event boundaries or accept forged JWTs', async () => {
  const { AuthService, authorize, requestActor, generateAccessToken, jwtVerify, SignJWT, WebhookReceiver } = await modules();
  const token = await AuthService.generateOrganizerToken('organizer', 'event-a');
  const actor = await requestActor(new Request('https://app.test', { headers: { cookie: `harecame-session=${token}` } }));
  assert.equal(actor?.type, 'organizer');
  assert.doesNotThrow(() => authorize(actor, ['organizer'], 'event-a'));
  assert.throws(() => authorize(actor, ['organizer'], 'event-b'));
  const forged = await new SignJWT({ type: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setSubject('attacker')
    .setIssuer('harecame-app').setAudience('harecame-users').setExpirationTime('1h').sign(new TextEncoder().encode('wrong-secret'));
  assert.equal(await AuthService.verifyToken(forged), null);
  const expired = await new SignJWT({ type: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setSubject('admin')
    .setIssuer('harecame-app').setAudience('harecame-users').setExpirationTime(1).sign(new TextEncoder().encode(process.env.JWT_SECRET));
  assert.equal(await AuthService.verifyToken(expired), null);
});

test('camera uses a LiveKit-signed room-scoped publish-only credential', async () => {
  const { AuthService, authorize, requestActor, generateAccessToken, jwtVerify, SignJWT, WebhookReceiver } = await modules();
  const token = await generateAccessToken('real-room', 'camera-a');
  const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.LIVEKIT_API_SECRET));
  assert.equal(payload.iss, 'test-api-key');
  assert.equal(payload.sub, 'camera-a');
  assert.deepEqual(payload.video, { room: 'real-room', roomJoin: true, canPublish: true, canSubscribe: false, canPublishData: false,
    canUpdateOwnMetadata: false, canPublishSources: ['camera','microphone'] });
  assert.ok(payload.exp! - Math.floor(Date.now() / 1000) <= 600);
  assert.equal(await AuthService.verifyToken(token), null);
});

test('LiveKit webhook validation binds the signature to the raw request body', async () => {
  const { AuthService, authorize, requestActor, generateAccessToken, jwtVerify, SignJWT, WebhookReceiver } = await modules();
  const body = JSON.stringify({ id: 'notice-a', event: 'room_started', room: { name: 'room' } });
  const token = await new SignJWT({ sha256: createHash('sha256').update(body).digest('base64') }).setProtectedHeader({ alg: 'HS256' })
    .setIssuer(process.env.LIVEKIT_API_KEY!).setExpirationTime('1m').sign(new TextEncoder().encode(process.env.LIVEKIT_API_SECRET));
  const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
  assert.equal((await receiver.receive(body, token)).id, 'notice-a');
  await assert.rejects(receiver.receive(body.replace('room_started', 'room_finished'), token));
  await assert.rejects(receiver.receive(body));
});
