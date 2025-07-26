import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EventService } from "@/lib/database";
import { CameraStreamClient } from "./CameraStreamClient";

interface CameraStreamPageProps {
  params: Promise<{ eventId: string }>;
}

export async function generateMetadata({
  params,
}: CameraStreamPageProps): Promise<Metadata> {
  const { eventId } = await params;

  try {
    const event = await EventService.getById(eventId);
    if (!event) {
      return {
        title: "イベントが見つかりません - Harecame",
      };
    }

    return {
      title: `${event.title} - カメラ配信 | Harecame`,
      description: `${event.title}にカメラオペレーターとして参加`,
    };
  } catch {
    return {
      title: "エラー - Harecame",
    };
  }
}

export default async function CameraStreamPage({
  params,
}: CameraStreamPageProps) {
  const { eventId } = await params;

  let event;

  try {
    // Get event information
    event = await EventService.getById(eventId);
    if (!event) {
      notFound();
    }

    // Check if event is still active
    if (event.status === "ended") {
      redirect("/camera/join?error=event_ended");
    }
  } catch (error) {
    console.error("Failed to load event:", error);
    // エラーの詳細をログに記録
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        eventId,
      });
    }
    notFound();
  }

  return <CameraStreamClient event={event} />;
}
