'use client';

import { useState, useEffect } from 'react';
import { CameraStreamInterface } from "@/components/camera/CameraStreamInterface";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface CameraStreamClientProps {
  event: {
    id: string;
    title: string;
    description?: string;
    status: string;
  };
}

export function CameraStreamClient({ event }: CameraStreamClientProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionData, setSessionData] = useState<{
    roomToken: string | null;
    roomName: string | null;
    storedEventId: string | null;
    participantName: string | null;
  }>({
    roomToken: null,
    roomName: null,
    storedEventId: null,
    participantName: null,
  });

  useEffect(() => {
    // Get room information from session storage after hydration
    const roomToken = sessionStorage.getItem("harecame_room_token");
    const roomName = sessionStorage.getItem("harecame_room_name");
    const storedEventId = sessionStorage.getItem("harecame_event_id");
    const participantName = sessionStorage.getItem("harecame_participant_name");

    console.log("Client-side session storage check:", {
      roomToken: roomToken ? "present" : "missing",
      roomName: roomName ? roomName : "missing",
      storedEventId: storedEventId ? storedEventId : "missing",
      expectedEventId: event.id,
      participantName: participantName ? participantName : "missing",
    });

    setSessionData({
      roomToken,
      roomName,
      storedEventId,
      participantName,
    });
    setIsLoading(false);
  }, [event.id]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p>読み込み中...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Validate session data
  if (!sessionData.roomToken || !sessionData.roomName || sessionData.storedEventId !== event.id) {
    console.error("Session validation failed:", {
      hasRoomToken: !!sessionData.roomToken,
      hasRoomName: !!sessionData.roomName,
      eventIdMatch: sessionData.storedEventId === event.id,
      storedEventId: sessionData.storedEventId,
      expectedEventId: event.id,
    });

    return (
      <div className="container mx-auto py-8 px-4">
        <Alert className="max-w-md mx-auto border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            セッション情報が見つかりません。再度参加コードから参加してください。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <CameraStreamInterface
        key={`${event.id}-${sessionData.roomToken}`}
        roomToken={sessionData.roomToken}
        roomName={sessionData.roomName}
        eventId={event.id}
        eventTitle={event.title}
        participantName={sessionData.participantName || undefined}
      />
    </div>
  );
}