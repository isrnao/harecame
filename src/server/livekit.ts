import 'server-only';
import { AccessToken, EgressClient, RoomServiceClient, StreamOutput, StreamProtocol, TrackSource } from 'livekit-server-sdk';
import { AppError } from './errors';
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
    ttl: 600,
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: options.canPublish ?? true,
    canSubscribe: options.canSubscribe ?? false,
    canPublishData: options.canPublishData ?? false,
    canUpdateOwnMetadata: false,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
  });

  return await at.toJwt();
}
export function livekitServices() {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new AppError(503, 'LiveKitが未設定です');
  const host = url.replace(/^ws/, 'http');
  return { rooms: new RoomServiceClient(host, key, secret), egress: new EgressClient(host, key, secret) };
}
export function streamOutput(url: string) {
  return new StreamOutput({ protocol: StreamProtocol.RTMP, urls: [url] });
}
