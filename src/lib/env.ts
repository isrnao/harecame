// Environment variable validation and configuration

export interface EnvironmentConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  livekit: {
    url: string;
    apiKey?: string;
    apiSecret?: string;
  };
  youtube: {
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
  };
  nextAuth: {
    secret?: string;
    url: string;
  };
}

// Validate required environment variables
export function validateEnvironment(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    livekit: {
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
      apiKey: process.env.LIVEKIT_API_KEY,
      apiSecret: process.env.LIVEKIT_API_SECRET,
    },
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY,
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    },
    nextAuth: {
      secret: process.env.NEXTAUTH_SECRET,
      url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    },
  };

  // Validate required client-side variables
  const requiredClientVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: config.supabase.url },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: config.supabase.anonKey },
    { key: 'NEXT_PUBLIC_LIVEKIT_URL', value: config.livekit.url },
  ];

  const missingClientVars = requiredClientVars.filter(({ value }) => !value);

  if (missingClientVars.length > 0) {
    const missing = missingClientVars.map(({ key }) => key).join(', ');
    throw new Error(`Missing required environment variables: ${missing}`);
  }

  return config;
}

// Get environment configuration (client-safe)
export function getClientConfig() {
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    livekit: {
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL!,
    },
  };
}

// Check if all integrations are configured
export function checkIntegrationStatus() {
  const config = validateEnvironment();
  
  return {
    supabase: !!(config.supabase.url && config.supabase.anonKey),
    livekit: !!(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret),
    youtube: !!(config.youtube.apiKey && config.youtube.clientId && config.youtube.clientSecret),
  };
}