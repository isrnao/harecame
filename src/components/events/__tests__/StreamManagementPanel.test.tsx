import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StreamManagementPanel } from '../StreamManagementPanel';
import { apiRequest } from '@/lib/api-client';
import type { CameraConnectionClient } from '@/types';
jest.mock('@/lib/api-client', () => ({ apiRequest: jest.fn() }));
const cameras = ['main', 'backup', 'new'].map(id => ({ id, participantId: id, participantName: id, status: 'active' })) as CameraConnectionClient[];
const current = { phase: 'live', desired: 'live', selectedCamera: 'main', fallbackCamera: 'backup', lastError: null };
const onChange = jest.fn();
const props = { eventId: 'event', cameras, streamStatus: null, activeCamera: cameras[1]!, onActiveCameraChange: onChange };
beforeEach(() => { jest.clearAllMocks(); jest.mocked(apiRequest).mockResolvedValue(current); });
it('restores persisted choices without confusing the selected primary with the on-air backup', async () => {
  render(<StreamManagementPanel {...props} />);
  await waitFor(() => expect(screen.getByLabelText('メインカメラ')).toHaveValue('main'));
  expect(screen.getByLabelText('予備カメラ')).toHaveValue('backup');
  expect(screen.getByText('使用中のカメラ: backup')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'カメラ選択を反映' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
  expect(onChange).not.toHaveBeenCalled();
});
it('clears a conflicting backup before submitting a primary selection', async () => {
  render(<StreamManagementPanel {...props} />);
  await waitFor(() => expect(screen.getByLabelText('予備カメラ')).toHaveValue('backup'));
  fireEvent.change(screen.getByLabelText('メインカメラ'), { target: { value: 'backup' } });
  expect(screen.getByLabelText('予備カメラ')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'カメラ選択を反映' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/events/event/control', expect.objectContaining({
    body: JSON.stringify({ action: 'select', cameraId: 'backup', fallbackCameraId: null }),
  })));
});
it('does not overwrite an in-progress edit on the next poll', async () => {
  jest.useFakeTimers();
  const view = render(<StreamManagementPanel {...props} />);
  try {
    await act(async () => {});
    fireEvent.change(screen.getByLabelText('メインカメラ'), { target: { value: 'new' } });
    await act(async () => { await jest.advanceTimersByTimeAsync(5000); });
    expect(screen.getByLabelText('メインカメラ')).toHaveValue('new');
    expect(apiRequest).toHaveBeenCalledTimes(2);
  } finally { view.unmount(); jest.useRealTimers(); }
});
