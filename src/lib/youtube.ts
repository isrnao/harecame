// YouTube API configuration and utilities

export interface YouTubeLiveStream {
  id: string;
  title: string;
  description: string;
  streamUrl: string;
  streamKey: string;
  status: "created" | "live" | "complete";
  scheduledStartTime?: string;
  viewerCount?: number;
  chatId?: string;
}

export interface CreateLiveStreamOptions {
  title: string;
  description?: string;
  scheduledStartTime?: Date;
  privacy: "public" | "unlisted" | "private";
}

export interface YouTubeStreamStats {
  viewerCount: number;
  isLive: boolean;
  duration?: string;
  chatMessageCount?: number;
}

// Generate YouTube embed URL
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
}

// Generate YouTube watch URL
export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Extract video ID from YouTube URL
export function extractVideoIdFromUrl(url: string): string | null {
  const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match?.[1] || null;
}
