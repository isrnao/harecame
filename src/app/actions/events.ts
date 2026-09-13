"use server";
import { revalidatePath } from 'next/cache';
import { createEvent, deleteEvent, getPublicEvent } from '@/server/events';
import { sessionActor } from '@/server/access';
import { AppError } from '@/server/errors';
import { z } from 'zod';

export type EventCreationState = { success: boolean; message: string; eventId?: string;
  errors?: { title?: string[]; description?: string[]; scheduledAt?: string[] } };
export async function createEventAction(_previous: EventCreationState, form: FormData): Promise<EventCreationState> {
  try {
    const scheduled = form.get('scheduledAt');
    const date = scheduled ? new Date(String(scheduled)) : undefined;
    if (date && Number.isNaN(date.getTime())) throw new AppError(400, '開催日時を確認してください');
    const event = await createEvent(await sessionActor(), { title: form.get('title'),
      description: form.get('description') || undefined, scheduledAt: date?.toISOString() });
    revalidatePath('/events');
    return { success: true, message: 'イベントを作成しました', eventId: event.id };
  } catch (error) {
    return { success: false, message: error instanceof AppError ? error.message : 'イベントの作成に失敗しました',
      ...(error instanceof z.ZodError && { errors: error.flatten().fieldErrors }) };
  }
}
export async function getEventById(id: string) { return getPublicEvent(id); }
export async function deleteEventAction(id: string) {
  try {
    await deleteEvent(await sessionActor(), id);
    revalidatePath('/events');
    return { success: true, message: 'イベントを削除しました' };
  } catch (error) {
    return { success: false, message: error instanceof AppError ? error.message : '削除に失敗しました' };
  }
}
