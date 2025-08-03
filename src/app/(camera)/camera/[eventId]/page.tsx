import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from 'next/server';
import { EventService } from "@/lib/database";
import { CameraStreamClient } from "./CameraStreamClient";

// Next.js 15: App Router専用の最適化設定
export const dynamic = 'force-dynamic'; // 動的パラメータとリアルタイムデータのため
export const runtime = 'nodejs'; // WebRTCとの互換性のためNode.jsランタイム

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

  // after() APIを使用してカメラ配信開始のアナリティクスを応答後に記録
  after(async () => {
    try {
      console.log('Camera stream page accessed:', {
        eventId,
        eventTitle: event.title,
        eventStatus: event.status,
        timestamp: new Date().toISOString(),
      });
      // 実際の実装では、アナリティクスサービスに送信
      // await analyticsService.trackCameraStreamAccess({ eventId, timestamp: new Date() });
    } catch (error) {
      console.error('Failed to record camera stream analytics:', error);
    }
  });

  return <CameraStreamClient event={event} />;
}
