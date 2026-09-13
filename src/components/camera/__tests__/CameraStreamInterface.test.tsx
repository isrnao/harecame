import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CameraStreamInterface } from '../CameraStreamInterface';
const listeners = new Map<string, () => void>();
const mockRoom = { connect: jest.fn(), disconnect: jest.fn(),
  on: jest.fn((e: string, fn: () => void) => listeners.set(e, fn)), off: jest.fn((e: string) => listeners.delete(e)),
  localParticipant: { publishTrack: jest.fn() } };
const mockTrack = () => ({ stop: jest.fn(), isMuted: false,
  async mute() { this.isMuted = true; }, async unmute() { this.isMuted = false; } });
jest.mock('livekit-client', () => ({
  Room: jest.fn(() => mockRoom), RoomEvent: { Reconnecting: 'reconnecting', Reconnected: 'reconnected', Disconnected: 'disconnected' },
  LocalVideoTrack: jest.fn(() => mockTrack()), LocalAudioTrack: jest.fn(() => mockTrack()), Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
}));
const props = { roomToken: 'old-token', roomName: 'room', eventId: 'event-a', eventTitle: '試合', participantName: '担当者' };
const stopVideo = jest.fn(), stopAudio = jest.fn();
const stream = { getTracks: () => [{ stop: stopVideo }, { stop: stopAudio }], getVideoTracks: () => [{ stop: stopVideo }], getAudioTracks: () => [{ stop: stopAudio }] };
const getMedia = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); listeners.clear();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: getMedia } });
  getMedia.mockResolvedValue(stream); mockRoom.connect.mockResolvedValue(undefined); mockRoom.disconnect.mockResolvedValue(undefined);
  mockRoom.localParticipant.publishTrack.mockResolvedValue(undefined);
  sessionStorage.setItem('harecame_camera_auth_event-a', 'camera-auth');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { roomToken: 'fresh-token', cameraConnectionId: 'camera-a' } }) });
});
it('previews locally and only publishes after the operator starts, with a fresh credential', async () => {
  render(<CameraStreamInterface {...props} />);
  await waitFor(() => expect(getMedia).toHaveBeenCalledTimes(1));
  expect(mockRoom.connect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'カメラを開始' }));
  await screen.findByText('映像送信中');
  expect(mockRoom.connect).toHaveBeenCalledWith(expect.any(String), 'fresh-token');
  expect(mockRoom.localParticipant.publishTrack).toHaveBeenCalledTimes(2);
  const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Headers;
  expect(headers.get('Authorization')).toBe('Bearer camera-auth');
});
it('releases all media when grant renewal fails and displays the failure', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ success: false, error: 'イベントは終了しています' }) });
  render(<CameraStreamInterface {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'カメラを開始' }));
  await screen.findByText('イベントは終了しています');
  expect(stopVideo).toHaveBeenCalled(); expect(stopAudio).toHaveBeenCalled();
  expect(mockRoom.connect).not.toHaveBeenCalled();
});
it('releases tracks if the component unmounts before getUserMedia resolves', async () => {
  let resolve!: (value: typeof stream) => void;
  getMedia.mockReturnValue(new Promise(r => { resolve = r; }));
  const view = render(<CameraStreamInterface {...props} />); view.unmount();
  await act(async () => { resolve(stream); });
  expect(stopVideo).toHaveBeenCalled(); expect(stopAudio).toHaveBeenCalled();
});
it('shows reconnecting and recovered states from LiveKit', async () => {
  render(<CameraStreamInterface {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'カメラを開始' })); await screen.findByText('映像送信中');
  act(() => listeners.get('reconnecting')?.()); expect(screen.getByRole('status')).toHaveTextContent('再接続中');
  act(() => listeners.get('reconnected')?.()); expect(screen.getByRole('status')).toHaveTextContent('映像送信中');
  fireEvent.click(screen.getByRole('button', { name: '送信を停止' }));
  await screen.findByText('未接続'); expect(stopVideo).toHaveBeenCalled(); expect(stopAudio).toHaveBeenCalled();
});
it('does not publish when camera permission is denied', async () => {
  getMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
  render(<CameraStreamInterface {...props} />);
  await screen.findByText('カメラ・マイクへのアクセスが拒否されました');
  expect(mockRoom.localParticipant.publishTrack).not.toHaveBeenCalled();
});
