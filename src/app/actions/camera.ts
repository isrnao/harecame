'use server';

import { EventService, CameraConnectionService } from '@/lib/database';
import { generateAccessToken } from '@/lib/livekit';
import { AuthService } from '@/lib/auth';
import { z } from 'zod';

// Form validation schema
const cameraJoinSchema = z.object({
  participationCode: z.string()
    .min(1, '参加コードは必須です')
    .max(10, '参加コードは10文字以内で入力してください')
    .regex(/^[A-Z0-9]+$/, '参加コードは英数字（大文字）で入力してください'),
  participantName: z.string()
    .max(100, '参加者名は100文字以内で入力してください')
    .optional(),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    screenResolution: z.string().optional(),
    connectionType: z.string().optional(),
    platform: z.string().optional(),
    browser: z.string().optional(),
  }).optional(),
});

export type CameraJoinState = {
  success: boolean;
  message: string;
  errors?: {
    participationCode?: string[];
    participantName?: string[];
  };
  eventId?: string;
  roomToken?: string;
  roomName?: string;
  cameraConnectionId?: string;
  authToken?: string;
  liveKitToken?: string;
};

export async function joinCameraAction(
  prevState: CameraJoinState,
  formData: FormData
): Promise<CameraJoinState> {
  try {
    console.log('joinCameraAction called with formData');
    
    // Extract form data
    const rawData = {
      participationCode: (formData.get('participationCode') as string)?.toUpperCase(),
      participantName: formData.get('participantName') as string,
      deviceInfo: {
        userAgent: formData.get('userAgent') as string,
        screenResolution: formData.get('screenResolution') as string,
        connectionType: formData.get('connectionType') as string,
        platform: formData.get('platform') as string,
        browser: formData.get('browser') as string,
      },
    };

    console.log('Extracted form data:', { 
      participationCode: rawData.participationCode,
      participantName: rawData.participantName 
    });

    // Validate form data
    const validationResult = cameraJoinSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error);
      return {
        success: false,
        message: '入力内容に誤りがあります',
        errors: validationResult.error.flatten().fieldErrors,
      };
    }

    const { participationCode, participantName, deviceInfo } = validationResult.data;

    console.log('Looking for event with participation code:', participationCode);

    // Find event by participation code
    const event = await EventService.getByParticipationCode(participationCode);
    if (!event) {
      console.error('Event not found for participation code:', participationCode);
      return {
        success: false,
        message: '参加コードが見つかりません。正しいコードを入力してください。',
        errors: {
          participationCode: ['参加コードが見つかりません'],
        },
      };
    }

    console.log('Found event:', { id: event.id, title: event.title, status: event.status });

    // Check if event is active
    if (event.status === 'ended') {
      console.error('Event has ended:', event.id);
      return {
        success: false,
        message: 'このイベントは既に終了しています。',
        errors: {
          participationCode: ['イベントは終了しています'],
        },
      };
    }

    // Generate unique participant ID
    const participantId = `camera_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log('Generated participant ID:', participantId);

    // Create camera connection record
    console.log('Creating camera connection record...');
    const cameraConnection = await CameraConnectionService.create({
      eventId: event.id,
      participantId,
      participantName: participantName || undefined,
      deviceInfo: deviceInfo || {},
    });
    console.log('Camera connection created:', cameraConnection.id);

    // Generate authentication token for camera operator
    let authToken: string;
    try {
      console.log('Generating camera authentication token...');
      authToken = await AuthService.generateCameraToken(
        participantId,
        event.id,
        participantName || undefined
      );
      console.log('Camera authentication token generated successfully');
    } catch (error) {
      console.error('Failed to generate camera authentication token:', error);
      return {
        success: false,
        message: '認証トークンの生成に失敗しました。もう一度お試しください。',
      };
    }

    // Generate LiveKit access token
    let roomToken: string;
    let liveKitToken: string;
    try {
      console.log('Generating LiveKit token for room:', event.livekitRoomName);
      roomToken = await generateAccessToken(
        event.livekitRoomName,
        participantId,
        {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          metadata: JSON.stringify({
            participantName: participantName || participantId,
            cameraConnectionId: cameraConnection.id,
          }),
        }
      );
      
      // Generate additional LiveKit token using AuthService
      liveKitToken = await AuthService.generateLiveKitToken(
        participantId,
        event.id,
        participantName || undefined
      );
      
      console.log('LiveKit tokens generated successfully');
    } catch (error) {
      console.error('Failed to generate LiveKit token:', error);
      return {
        success: false,
        message: 'アクセストークンの生成に失敗しました。もう一度お試しください。',
      };
    }

    console.log('Camera join successful, returning success state');
    return {
      success: true,
      message: 'イベントに参加しました',
      eventId: event.id,
      roomToken,
      roomName: event.livekitRoomName,
      cameraConnectionId: cameraConnection.id,
      authToken,
      liveKitToken,
    };
  } catch (error) {
    console.error('Failed to join camera:', error);
    return {
      success: false,
      message: 'カメラの参加に失敗しました。もう一度お試しください。',
    };
  }
}

// Get event info by participation code (for QR code generation)
export async function getEventByParticipationCode(
  participationCode: string
): Promise<{ success: boolean; event?: unknown; message?: string }> {
  try {
    const event = await EventService.getByParticipationCode(participationCode.toUpperCase());
    
    if (!event) {
      return {
        success: false,
        message: '参加コードが見つかりません',
      };
    }

    return {
      success: true,
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        scheduledAt: event.scheduledAt,
        status: event.status,
        participationCode: event.participationCode,
      },
    };
  } catch (error) {
    console.error('Failed to get event by participation code:', error);
    return {
      success: false,
      message: 'イベント情報の取得に失敗しました',
    };
  }
}