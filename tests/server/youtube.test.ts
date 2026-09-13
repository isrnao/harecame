import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YouTubeProvider, ingestionUrl } from '../../src/server/youtube';

process.env.YOUTUBE_CLIENT_ID = 'test-client';
process.env.YOUTUBE_CLIENT_SECRET = 'test-secret';
process.env.YOUTUBE_REFRESH_TOKEN = 'test-refresh';

function provider(responses: unknown[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const client = new YouTubeProvider(async (input, init = {}) => {
    calls.push({ url: new URL(String(input)), init });
    assert.ok(responses.length, 'unexpected provider request');
    const result = responses.shift();
    return result instanceof Response ? result : Response.json(result);
  });
  return { client, calls };
}

test('YouTube creates an unlisted archival broadcast and binds its RTMPS stream', async () => {
  const { client, calls } = provider([
    { access_token: 'access-token' },
    { id: 'stream', snippet: { title: 'Event' }, cdn: { ingestionInfo: { rtmpsIngestionAddress: 'rtmps://test/live/', streamName: 'private-key' } } },
    { id: 'broadcast' }, { items: [{ id: 'broadcast', contentDetails: {} }] }, {},
  ]);
  const stream = await client.createStream('Event', '[harecame:event]');
  assert.equal(ingestionUrl(stream), 'rtmps://test/live/private-key');
  await client.createBroadcast('Event', 'Description', '[harecame:event]');
  await client.bind('broadcast', stream.id);
  assert.equal(calls[0]!.url.hostname, 'oauth2.googleapis.com');
  assert.equal((calls[0]!.init.body as URLSearchParams).get('grant_type'), 'refresh_token');
  assert.deepEqual(JSON.parse(String(calls[2]!.init.body)).status, { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false });
  const settings = JSON.parse(String(calls[2]!.init.body)).contentDetails;
  assert.equal(settings.enableAutoStart, true);
  assert.equal(settings.enableAutoStop, false);
  assert.equal(settings.recordFromStart, true);
  assert.equal(calls[4]!.url.searchParams.get('streamId'), 'stream');
  assert.equal(calls[4]!.init.method, 'POST');
  assert.equal(new Headers(calls[4]!.init.headers).get('authorization'), 'Bearer access-token');
});

test('lost creation lookup follows pagination and does not create another resource', async () => {
  const { client, calls } = provider([{ access_token: 'token' }, { items: [], nextPageToken: 'page2' },
    { items: [{ id: 'recovered', snippet: { description: '[harecame:event]' } }] }]);
  assert.equal((await client.findBroadcast('[harecame:event]'))?.id, 'recovered');
  assert.equal(calls[2]!.url.searchParams.get('pageToken'), 'page2');
  assert.ok(calls.slice(1).every(call => call.init.method === 'GET'));
});

test('stop completes a live broadcast but deletes a never-started broadcast', async () => {
  for (const state of ['live', 'ready']) {
    const { client, calls } = provider([{ access_token: 'token' }, { items: [{ id: 'broadcast', status: { lifeCycleStatus: state } }] }, new Response(null, { status: 204 })]);
    await client.complete('broadcast');
    assert.equal(calls[2]!.init.method, state === 'live' ? 'POST' : 'DELETE');
    if (state === 'live') assert.equal(calls[2]!.url.searchParams.get('broadcastStatus'), 'complete');
  }
});

test('provider errors never include credential-bearing response bodies', async () => {
  const { client } = provider([{ access_token: 'token' }, new Response('sensitive-provider-detail', { status: 403 })]);
  await assert.rejects(client.status('broadcast'), error => {
    assert.equal((error as Error).message, 'YouTube操作に失敗しました（HTTP 403）');
    return true;
  });
});

test('invalid OAuth and incomplete ingestion responses fail before creating an output', async () => {
  const { client, calls } = provider([new Response('private-oauth-error', { status: 401 })]);
  await assert.rejects(client.ready(), /YouTube認証に失敗/);
  assert.equal(calls.length, 1);
  assert.throws(() => ingestionUrl({ id: 'stream', snippet: { title: 'Event' } }), /配信先が取得できません/);
});
