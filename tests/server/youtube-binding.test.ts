import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YouTubeProvider } from '../../src/server/youtube';
process.env.YOUTUBE_CLIENT_ID = 'test-client';
process.env.YOUTUBE_CLIENT_SECRET = 'test-secret';
process.env.YOUTUBE_REFRESH_TOKEN = 'test-refresh';
for (const bound of [undefined, 'expected', 'other']) {
  test(`YouTube binding handles existing binding ${bound ?? 'none'}`, async () => {
    const calls: string[] = [];
    const responses = [{ access_token: 'token' }, { items: [{ id: 'broadcast', contentDetails: { boundStreamId: bound } }] }, {}];
    const client = new YouTubeProvider(async (_input, options) => {
      calls.push(options?.method ?? 'GET'); return Response.json(responses.shift());
    });
    if (bound === 'other') await assert.rejects(client.bind('broadcast', 'expected'), /別のストリーム/);
    else await client.bind('broadcast', 'expected');
    assert.deepEqual(calls, bound === undefined ? ['POST', 'GET', 'POST'] : ['POST', 'GET']);
  });
}
