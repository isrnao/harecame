import { Room, VideoPresets } from 'livekit-client';
import type { RoomOptions } from 'livekit-client';

// LiveKit client configuration
export const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;


// Default room options for camera operators
export const defaultRoomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
    videoCodec: 'vp8',
    dtx: true,
    red: true,
  },
};

// Create LiveKit room instance
export function createRoom(options?: Partial<RoomOptions>): Room {
  return new Room({
    ...defaultRoomOptions,
    ...options,
  });
}
