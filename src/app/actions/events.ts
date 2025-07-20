'use server';

import { revalidatePath } from 'next/cache';
import { EventService } from '@/lib/database';
import { createYouTubeLiveStream } from '@/lib/youtube';

// Form validation schema
import { z } from 'zod';

const eventCreationSchema = z.object({
  title: z.string().min(1, 'イベント名は必須です').max(255, 'イベント名は255文字以内で入力してください'),
  description: z.string().max(1000, '説明は1000文字以内で入力してください').optional(),
  scheduledAt: z.string().optional().transform((val) => val ? new Date(val) : undefined),
});

export type EventCreationState = {
  success: boolean;
  message: string;
  errors?: {
    title?: string[];
    description?: string[];
    scheduledAt?: string[];
  };
  eventId?: string;
};

export async function createEventAction(
  prevState: EventCreationState,
  formData: FormData
): Promise<EventCreationState> {
  try {
    // Extract form data
    const rawData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      scheduledAt: formData.get('scheduledAt') as string,
    };

    // Validate form data
    const validationResult = eventCreationSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return {
        success: false,
        message: '入力内容に誤りがあります',
        errors: validationResult.error.flatten().fieldErrors,
      };
    }

    const { title, description, scheduledAt } = validationResult.data;

    // Create event in database
    const event = await EventService.create({
      title,
      description: description || undefined,
      scheduledAt,
    });

    // Create YouTube Live stream
    try {
      const youtubeStream = await createYouTubeLiveStream({
        title: event.title,
        description: event.description,
        scheduledStartTime: event.scheduledAt,
        privacy: 'unlisted', // Default to unlisted for privacy
      });

      // Update event with YouTube stream information
      await EventService.update(event.id, {
        youtubeStreamUrl: youtubeStream.streamUrl,
        youtubeStreamKey: youtubeStream.streamKey,
        youtubeVideoId: youtubeStream.id,
      });
    } catch (youtubeError) {
      console.error('Failed to create YouTube stream:', youtubeError);
      // Continue without YouTube integration for now
    }

    // Revalidate the events page
    revalidatePath('/events');
    
    return {
      success: true,
      message: 'イベントが正常に作成されました',
      eventId: event.id,
    };
  } catch (error) {
    console.error('Failed to create event:', error);
    return {
      success: false,
      message: 'イベントの作成に失敗しました。もう一度お試しください。',
    };
  }
}

export async function getEventById(eventId: string) {
  try {
    const event = await EventService.getById(eventId);
    return event;
  } catch (error) {
    console.error('Failed to get event:', error);
    return null;
  }
}

export async function deleteEventAction(eventId: string): Promise<{ success: boolean; message: string }> {
  try {
    await EventService.delete(eventId);
    revalidatePath('/events');
    
    return {
      success: true,
      message: 'イベントが削除されました',
    };
  } catch (error) {
    console.error('Failed to delete event:', error);
    return {
      success: false,
      message: 'イベントの削除に失敗しました',
    };
  }
}