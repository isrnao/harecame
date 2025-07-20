import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if we have valid URLs (not placeholder values)
const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  if (url.includes('your_supabase_url_here')) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const hasValidSupabaseConfig = isValidUrl(supabaseUrl) && supabaseAnonKey && !supabaseAnonKey.includes('your_supabase');

if (!hasValidSupabaseConfig) {
  console.warn('Supabase configuration not available - using mock mode');
}

export const supabase = hasValidSupabaseConfig && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Server-side client with service role key
export const supabaseAdmin = hasValidSupabaseConfig && 
  supabaseUrl && 
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your_supabase')
  ? createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null;