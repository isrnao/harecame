'use client';

import { useActionState, useOptimistic, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createEventAction, type EventCreationState } from '@/app/actions/events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar, FileText, Type } from 'lucide-react';

// Form validation schema
const eventFormSchema = z.object({
  title: z.string().min(1, 'イベント名は必須です').max(255, 'イベント名は255文字以内で入力してください'),
  description: z.string().max(1000, '説明は1000文字以内で入力してください').optional(),
  scheduledAt: z.string().optional(),
});

type EventFormData = z.infer<typeof eventFormSchema>;

const initialState: EventCreationState = {
  success: false,
  message: '',
};

export function EventCreationForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createEventAction, initialState);
  
  // Optimistic state for immediate UI feedback
  const [optimisticState, setOptimisticState] = useOptimistic(
    state,
    (currentState, optimisticValue: Partial<EventCreationState>) => ({
      ...currentState,
      ...optimisticValue,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
  });

  const onSubmit = async (data: EventFormData) => {
    // Show optimistic feedback
    setOptimisticState({
      success: false,
      message: 'イベントを作成中...',
    });

    startTransition(() => {
      const formData = new FormData();
      formData.append('title', data.title);
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.scheduledAt) {
        formData.append('scheduledAt', data.scheduledAt);
      }
      
      formAction(formData);
    });
  };

  // Handle successful creation
  if (state.success && state.eventId) {
    // Redirect to the event dashboard after successful creation
    router.push(`/events/${state.eventId}/dashboard`);
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          新しいイベントを作成
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          ライブ配信イベントの基本情報を入力してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              イベント名 *
            </Label>
            <Input
              id="title"
              placeholder="例: 春の運動会 2024"
              {...register('title')}
              className={`min-h-[48px] touch-manipulation ${errors.title ? 'border-red-500' : ''}`}
              disabled={isPending}
              autoComplete="off"
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
            {state.errors?.title && (
              <p className="text-sm text-red-500">{state.errors.title[0]}</p>
            )}
          </div>

          {/* Event Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              説明（任意）
            </Label>
            <Textarea
              id="description"
              placeholder="イベントの詳細や注意事項を入力してください"
              rows={4}
              {...register('description')}
              className={`touch-manipulation ${errors.description ? 'border-red-500' : ''}`}
              disabled={isPending}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
            {state.errors?.description && (
              <p className="text-sm text-red-500">{state.errors.description[0]}</p>
            )}
          </div>

          {/* Scheduled Date/Time */}
          <div className="space-y-2">
            <Label htmlFor="scheduledAt" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              開始予定日時（任意）
            </Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              {...register('scheduledAt')}
              className={`min-h-[48px] touch-manipulation ${errors.scheduledAt ? 'border-red-500' : ''}`}
              disabled={isPending}
            />
            {errors.scheduledAt && (
              <p className="text-sm text-red-500">{errors.scheduledAt.message}</p>
            )}
            {state.errors?.scheduledAt && (
              <p className="text-sm text-red-500">{state.errors.scheduledAt[0]}</p>
            )}
          </div>

          {/* Status Message */}
          {optimisticState.message && (
            <div className={`p-4 rounded-md ${
              optimisticState.success 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : state.errors 
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {optimisticState.message}
            </div>
          )}

          {/* Action Buttons - タッチ最適化 */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 min-h-[48px] touch-manipulation"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  作成中...
                </>
              ) : (
                'イベントを作成'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/events')}
              disabled={isPending}
              className="sm:flex-none min-h-[48px] touch-manipulation"
            >
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}