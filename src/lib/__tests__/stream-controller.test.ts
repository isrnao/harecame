import { reconcileStream, type StreamPorts, type Output } from '@/server/stream-controller';
import type { StreamSession } from '@/server/stream-store';
import { selectCamera, parseCameraLayout } from '@/lib/compositor';

function fixture(overrides: Partial<StreamSession> = {}) {
  const session: StreamSession = { event_id: 'event-a', phase: 'idle', desired: 'live', selected_camera: 'main', fallback_camera: null,
    egress_id: null, broadcast_id: null, youtube_stream_id: null, ingestion_url: null,
    stream_creation_attempted: false, broadcast_creation_attempted: false, egress_creation_attempted: false,
    last_error: null, updated_at: '', ...overrides };
  const ports: jest.Mocked<StreamPorts> = {
    ready: jest.fn().mockResolvedValue(undefined),
    findStream: jest.fn().mockResolvedValue(null), createStream: jest.fn().mockResolvedValue({ id: 'stream', url: 'rtmps://provider/key' }),
    findBroadcast: jest.fn().mockResolvedValue(null), createBroadcast: jest.fn().mockResolvedValue({ id: 'broadcast' }),
    bind: jest.fn().mockResolvedValue(undefined), broadcastStatus: jest.fn().mockResolvedValue('ready'),
    completeBroadcast: jest.fn().mockResolvedValue(undefined), listOutputs: jest.fn().mockResolvedValue([]),
    startOutput: jest.fn().mockResolvedValue({ id: 'output', state: 'starting' }), stopOutput: jest.fn().mockResolvedValue(undefined),
    updateLayout: jest.fn().mockResolvedValue(undefined), closeRoom: jest.fn().mockResolvedValue(undefined),
  };
  const save = jest.fn(async (patch: Partial<StreamSession>) => { Object.assign(session, patch); });
  const run = (hasCamera = true) => reconcileStream({ session, save, ports, hasCamera, event: { title: '試合' }, layout: '{"primary":"main","backup":""}' });
  return { session, ports, save, run };
}
const output: Output = { id: 'output', state: 'active' };
describe('durable stream lifecycle', () => {
  it('waits for provider confirmation instead of declaring live on connection', async () => {
    const f = fixture(); await f.run(); expect(f.session.phase).toBe('starting');
    f.ports.listOutputs.mockResolvedValue([output]); f.ports.broadcastStatus.mockResolvedValue('live');
    await f.run(); expect(f.session.phase).toBe('live');
    expect(f.ports.startOutput).toHaveBeenCalledTimes(1); expect(f.ports.createBroadcast).toHaveBeenCalledTimes(1);
  });
  it('keeps an existing live program running with its standby layout when all cameras disconnect', async () => {
    const f = fixture(); await f.run();
    f.ports.listOutputs.mockResolvedValue([output]); f.ports.broadcastStatus.mockResolvedValue('live');
    await f.run(false);
    expect(f.session.phase).toBe('live');
    expect(f.ports.updateLayout).toHaveBeenCalled();
    expect(f.ports.startOutput).toHaveBeenCalledTimes(1);
    expect(f.ports.stopOutput).not.toHaveBeenCalled();
  });
  it('does not duplicate output after a timeout; recovers the discovered output', async () => {
    const f = fixture(); f.ports.startOutput.mockRejectedValueOnce(new Error('timeout with secret url'));
    await expect(f.run()).rejects.toThrow('通信');
    expect(f.session.last_error).not.toContain('secret');
    await expect(f.run()).rejects.toThrow('未確定'); expect(f.ports.startOutput).toHaveBeenCalledTimes(1);
    f.ports.listOutputs.mockResolvedValue([output]); f.ports.broadcastStatus.mockResolvedValue('live');
    await f.run(); expect(f.session.phase).toBe('live');
  });
  it('recovers a YouTube create whose response was lost without another POST', async () => {
    const f = fixture(); f.ports.createStream.mockRejectedValueOnce(new Error('timeout'));
    await expect(f.run()).rejects.toThrow(); await expect(f.run()).rejects.toThrow('未確定');
    expect(f.ports.createStream).toHaveBeenCalledTimes(1);
    f.ports.findStream.mockResolvedValue({ id: 'recovered', url: 'rtmps://provider/key' });
    await f.run(); expect(f.session.youtube_stream_id).toBe('recovered');
  });
  it('does not complete shutdown until all egress outputs have finalized', async () => {
    const f = fixture({ desired: 'stopped', phase: 'live', broadcast_id: 'broadcast', egress_id: 'output', egress_creation_attempted: true });
    f.ports.listOutputs.mockResolvedValue([output]); await f.run();
    expect(f.session.phase).toBe('stopping'); expect(f.ports.closeRoom).not.toHaveBeenCalled();
    f.ports.listOutputs.mockResolvedValue([{ ...output, state: 'ended' }]); await f.run();
    expect(f.session.phase).toBe('stopped'); expect(f.ports.closeRoom).toHaveBeenCalledTimes(1);
  });
  it('keeps shutdown retryable on a provider failure', async () => {
    const f = fixture({ desired: 'stopped', phase: 'live', broadcast_id: 'broadcast' });
    f.ports.completeBroadcast.mockRejectedValueOnce(new Error('unavailable'));
    f.ports.listOutputs.mockResolvedValueOnce([output]).mockResolvedValue([]);
    await expect(f.run()).rejects.toThrow(); expect(f.session.phase).toBe('stopping');
    expect(f.ports.stopOutput).toHaveBeenCalledWith('output');
    await f.run(); expect(f.session.phase).toBe('stopped');
  });
  it('rejects multiple outputs and missing selected cameras', async () => {
    const f = fixture(); f.ports.listOutputs.mockResolvedValue([output, { ...output, id: 'duplicate' }]);
    await expect(f.run()).rejects.toThrow('複数'); expect(f.ports.startOutput).not.toHaveBeenCalled();
    const g = fixture(); await expect(g.run(false)).rejects.toThrow('映像');
    expect(g.ports.createStream).not.toHaveBeenCalled();
  });
  it('does not abandon an output with uncertain creation status on stop', async () => {
    const f = fixture({ desired: 'stopped', egress_creation_attempted: true });
    await expect(f.run()).rejects.toThrow('未確定'); expect(f.session.phase).toBe('stopping');
  });
});
describe('program camera selection', () => {
  const layout = parseCameraLayout('{"primary":"a","backup":"b"}');
  it('new cameras do not take over the program', () => expect(selectCamera(layout, new Set(['a','b','new']))).toBe('a'));
  it('uses only an explicitly selected backup when the main camera is missing', () => {
    expect(selectCamera(layout, new Set(['b','new']))).toBe('b');
    expect(selectCamera(layout, new Set(['new']))).toBeNull();
  });
  it('rejects malformed layouts safely', () => expect(selectCamera(parseCameraLayout('bad'), new Set(['a']))).toBeNull());
});
