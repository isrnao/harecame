import { Room, RoomOptions, VideoPresets } from 'livekit-client';
import { AccessToken } from 'livekit-server-sdk';

// LiveKit client configuration
export const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

if (!livekitUrl) {
  throw new Error('Missing NEXT_PUBLIC_LIVEKIT_URL environment variable');
}

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

// Server-side token generation
export async function generateAccessToken(
  roomName: string,
  participantName: string,
  options: {
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
    metadata?: string;
  } = {}
): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Missing LiveKit API credentials');
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    metadata: options.metadata,
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: options.canPublish ?? true,
    canSubscribe: options.canSubscribe ?? true,
    canPublishData: options.canPublishData ?? true,
  });

  return await at.toJwt();
}