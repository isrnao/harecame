-- Harecame Sample Data for Development
-- This file contains sample data for testing the Harecame application

-- Insert sample events
INSERT INTO events (title, description, scheduled_at, participation_code, livekit_room_name, youtube_stream_url, youtube_video_id) VALUES
('春の運動会 2024', '小学校の春の運動会です。徒競走、リレー、ダンスなどの競技があります。', NOW() + INTERVAL '1 day', 'SPRING', 'spring_sports_2024', 'https://www.youtube.com/watch?v=spring2024', 'spring2024'),
('文化祭発表会', '中学校の文化祭での発表会です。合唱、演劇、ダンスの発表があります。', NOW() + INTERVAL '3 days', 'CULTURE', 'culture_festival_2024', 'https://www.youtube.com/watch?v=culture2024', 'culture2024'),
('卒業式', '高校の卒業式です。卒業証書授与式と記念撮影を行います。', NOW() + INTERVAL '7 days', 'GRAD24', 'graduation_ceremony_2024', 'https://www.youtube.com/watch?v=grad2024', 'grad2024');

-- Insert sample camera connections
INSERT INTO camera_connections (event_id, participant_id, participant_name, device_info, stream_quality, status) VALUES
(
  (SELECT id FROM events WHERE participation_code = 'SPRING'),
  'parent_001',
  '田中太郎',
  '{"userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "screenResolution": "1179x2556", "connectionType": "4g", "platform": "mobile", "browser": "safari"}',
  '{"resolution": "720p", "frameRate": 30, "bitrate": 2500, "codec": "h264"}',
  'active'
),
(
  (SELECT id FROM events WHERE participation_code = 'SPRING'),
  'parent_002',
  '佐藤花子',
  '{"userAgent": "Mozilla/5.0 (Android 13; Mobile; rv:109.0)", "screenResolution": "1080x2400", "connectionType": "wifi", "platform": "mobile", "browser": "chrome"}',
  '{"resolution": "1080p", "frameRate": 30, "bitrate": 4000, "codec": "h264"}',
  'active'
),
(
  (SELECT id FROM events WHERE participation_code = 'CULTURE'),
  'teacher_001',
  '山田先生',
  '{"userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "screenResolution": "1920x1080", "connectionType": "wifi", "platform": "desktop", "browser": "chrome"}',
  '{"resolution": "1080p", "frameRate": 60, "bitrate": 5000, "codec": "h264"}',
  'connecting'
);

-- Insert sample stream status
INSERT INTO stream_status (event_id, is_live, active_camera_count, current_active_camera, youtube_viewer_count, stream_health) VALUES
(
  (SELECT id FROM events WHERE participation_code = 'SPRING'),
  true,
  2,
  (SELECT id FROM camera_connections WHERE participant_id = 'parent_002'),
  45,
  'good'
),
(
  (SELECT id FROM events WHERE participation_code = 'CULTURE'),
  false,
  0,
  NULL,
  0,
  'unknown'
);

-- Insert sample event logs
INSERT INTO event_logs (event_id, camera_connection_id, log_type, message, metadata) VALUES
(
  (SELECT id FROM events WHERE participation_code = 'SPRING'),
  (SELECT id FROM camera_connections WHERE participant_id = 'parent_001'),
  'camera_connected',
  'Camera connected successfully',
  '{"ip_address": "192.168.1.100", "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"}'
),
(
  (SELECT id FROM events WHERE participation_code = 'SPRING'),
  (SELECT id FROM camera_connections WHERE participant_id = 'parent_002'),
  'camera_connected',
  'Camera connected successfully',
  '{"ip_address": "192.168.1.101", "user_agent": "Mozilla/5.0 (Android 13; Mobile; rv:109.0)"}'
),
(
  (SELECT id FROM events WHERE participation_code = 'SPRING'),
  NULL,
  'stream_started',
  'Live stream started',
  '{"youtube_stream_id": "spring2024", "start_time": "2024-07-19T10:00:00Z"}'
);