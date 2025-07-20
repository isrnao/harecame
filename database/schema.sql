-- Harecame Database Schema
-- This file contains the database schema for the Harecame application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
  participation_code VARCHAR(10) UNIQUE NOT NULL,
  youtube_stream_url TEXT,
  youtube_stream_key TEXT,
  youtube_video_id VARCHAR(50),
  livekit_room_name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Camera connections table
CREATE TABLE IF NOT EXISTS camera_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  participant_id VARCHAR(255) NOT NULL,
  participant_name VARCHAR(255),
  device_info JSONB DEFAULT '{}',
  stream_quality JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'connecting' CHECK (status IN ('connecting', 'active', 'inactive', 'error')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  disconnected_at TIMESTAMP WITH TIME ZONE
);

-- Stream status table (for real-time monitoring)
CREATE TABLE IF NOT EXISTS stream_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  is_live BOOLEAN DEFAULT FALSE,
  active_camera_count INTEGER DEFAULT 0,
  current_active_camera UUID REFERENCES camera_connections(id),
  youtube_viewer_count INTEGER DEFAULT 0,
  stream_health VARCHAR(20) DEFAULT 'unknown' CHECK (stream_health IN ('excellent', 'good', 'poor', 'critical', 'unknown')),
  last_switch_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event logs table (for debugging and analytics)
CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  camera_connection_id UUID REFERENCES camera_connections(id) ON DELETE SET NULL,
  log_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_participation_code ON events(participation_code);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

CREATE INDEX IF NOT EXISTS idx_camera_connections_event_id ON camera_connections(event_id);
CREATE INDEX IF NOT EXISTS idx_camera_connections_status ON camera_connections(status);
CREATE INDEX IF NOT EXISTS idx_camera_connections_participant_id ON camera_connections(participant_id);

CREATE INDEX IF NOT EXISTS idx_stream_status_event_id ON stream_status(event_id);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_id ON event_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(created_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stream_status_updated_at BEFORE UPDATE ON stream_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

-- Basic policies (can be customized based on authentication requirements)
-- For now, allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON events
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Allow all operations for authenticated users" ON camera_connections
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Allow all operations for authenticated users" ON stream_status
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Allow all operations for authenticated users" ON event_logs
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');