import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
process.loadEnvFile('.env.local');
const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
if (!key || !secret) throw new Error('LiveKit credentials are missing');
const directory = mkdtempSync(join(tmpdir(), 'harecame-livekit-'));
const path = join(directory, 'config.yaml');
writeFileSync(path, JSON.stringify({ port: 7880, bind_addresses: ['127.0.0.1'],
  rtc: { tcp_port: 7881, port_range_start: 50000, port_range_end: 50100, use_external_ip: false },
  keys: { [key]: secret }, webhook: { api_key: key, urls: ['http://127.0.0.1:3100/api/webhooks/livekit'] } }), { mode: 0o600 });
const child = spawn('livekit-server', ['--dev', '--config', path], { stdio: 'inherit' });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { rmSync(directory, { recursive: true, force: true }); process.exitCode = code ?? 0; });
