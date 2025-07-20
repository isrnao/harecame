// Database initialization and migration utilities
import { supabaseAdmin } from './supabase';
import { readFileSync } from 'fs';
import { join } from 'path';

export class DatabaseInitializer {
  // Initialize database schema
  static async initializeSchema(): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    try {
      // Read the schema SQL file
      const schemaPath = join(process.cwd(), 'database', 'schema.sql');
      const schemaSql = readFileSync(schemaPath, 'utf-8');

      // Execute the schema SQL
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql: schemaSql
      });

      if (error) {
        throw new Error(`Failed to initialize database schema: ${error.message}`);
      }

      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  // Check if database is properly initialized
  static async checkDatabaseHealth(): Promise<{
    isHealthy: boolean;
    tables: string[];
    missingTables: string[];
  }> {
    const requiredTables = [
      'events',
      'camera_connections',
      'stream_status',
      'event_logs'
    ];

    if (!supabaseAdmin) {
      return {
        isHealthy: false,
        tables: [],
        missingTables: requiredTables
      };
    }

    try {
      // Check if tables exist
      const { data: tables, error } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', requiredTables);

      if (error) {
        throw new Error(`Failed to check database health: ${error.message}`);
      }

      const existingTables = tables.map(t => t.table_name);
      const missingTables = requiredTables.filter(
        table => !existingTables.includes(table)
      );

      return {
        isHealthy: missingTables.length === 0,
        tables: existingTables,
        missingTables
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        isHealthy: false,
        tables: [],
        missingTables: requiredTables
      };
    }
  }

  // Create sample data for testing
  static async createSampleData(): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    try {
      // Create a sample event
      const { data: event, error: eventError } = await supabaseAdmin
        .from('events')
        .insert({
          title: 'サンプル運動会',
          description: 'テスト用のサンプルイベントです',
          scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          participation_code: 'SAMPLE',
          livekit_room_name: 'sample_event_room',
          youtube_stream_url: 'https://www.youtube.com/watch?v=sample',
          youtube_video_id: 'sample'
        })
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to create sample event: ${eventError.message}`);
      }

      // Create sample stream status
      await supabaseAdmin
        .from('stream_status')
        .insert({
          event_id: event.id,
          is_live: false,
          active_camera_count: 0,
          youtube_viewer_count: 0,
          stream_health: 'unknown'
        });

      // Create sample camera connection
      await supabaseAdmin
        .from('camera_connections')
        .insert({
          event_id: event.id,
          participant_id: 'sample_participant',
          participant_name: 'サンプル参加者',
          device_info: {
            userAgent: 'Sample User Agent',
            screenResolution: '1920x1080',
            connectionType: '4g',
            platform: 'mobile',
            browser: 'chrome'
          },
          stream_quality: {
            resolution: '720p',
            frameRate: 30,
            bitrate: 2000,
            codec: 'h264'
          },
          status: 'inactive'
        });

      // Create sample log entry
      await supabaseAdmin
        .from('event_logs')
        .insert({
          event_id: event.id,
          log_type: 'event_created',
          message: 'Sample event created for testing',
          metadata: {
            source: 'database_initializer',
            version: '1.0.0'
          }
        });

      console.log('Sample data created successfully');
    } catch (error) {
      console.error('Failed to create sample data:', error);
      throw error;
    }
  }

  // Clean up sample data
  static async cleanupSampleData(): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    try {
      const { error } = await supabaseAdmin
        .from('events')
        .delete()
        .eq('participation_code', 'SAMPLE');

      if (error) {
        throw new Error(`Failed to cleanup sample data: ${error.message}`);
      }

      console.log('Sample data cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup sample data:', error);
      throw error;
    }
  }
}