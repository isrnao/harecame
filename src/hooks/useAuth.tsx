import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

// Authentication types
export interface AuthUser {
  id: string;
  type: 'admin' | 'organizer' | 'camera' | 'viewer';
  eventId?: string;
  participantName?: string;
  token: string;
  expiresAt: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

// Local storage keys
const AUTH_STORAGE_KEY = 'harecame-auth';
const TOKEN_STORAGE_KEY = 'harecame-token';

// 開発環境での二重実行を防ぐためのフラグ
let isAuthInitialized = false;

// Custom hook for authentication management
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  // Initialize auth state from localStorage
  useEffect(() => {
    // 開発環境での二重実行を防ぐ
    if (isAuthInitialized) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const initializeAuth = () => {
      try {
        const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
        const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

        if (storedAuth && storedToken) {
          const user: AuthUser = JSON.parse(storedAuth);

          // Check if token is expired
          if (new Date(user.expiresAt) > new Date()) {
            setAuthState({
              user,
              isLoading: false,
              error: null,
            });
            isAuthInitialized = true;
            return;
          } else {
            // Token expired, clear storage
            localStorage.removeItem(AUTH_STORAGE_KEY);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
          }
        }

        setAuthState({
          user: null,
          isLoading: false,
          error: null,
        });
        isAuthInitialized = true;
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setAuthState({
          user: null,
          isLoading: false,
          error: 'Failed to initialize authentication',
        });
        isAuthInitialized = true;
      }
    };

    initializeAuth();

    // クリーンアップ時にフラグをリセット（開発環境でのホットリロード対応）
    return () => {
      if (process.env.NODE_ENV === 'development') {
        isAuthInitialized = false;
      }
    };
  }, []);

  // Admin login
  const loginAsAdmin = useCallback(async (adminKey: string, eventId?: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminKey, eventId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const user: AuthUser = {
        id: data.data.user.id,
        type: data.data.user.type,
        eventId: data.data.user.eventId,
        token: data.data.token,
        expiresAt: data.data.expiresAt,
      };

      // Store auth data
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_STORAGE_KEY, user.token);

      setAuthState({
        user,
        isLoading: false,
        error: null,
      });

      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  // Camera operator authentication via participation code
  const authenticateCamera = useCallback(async (
    participationCode: string,
    participantId?: string,
    participantName?: string
  ) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/events/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: participationCode,
          participantId,
          participantName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      const user: AuthUser = {
        id: data.data.participant.id,
        type: 'camera',
        eventId: data.data.event.id,
        participantName: data.data.participant.name,
        token: data.data.tokens.accessToken,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
      };

      // Store auth data
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_STORAGE_KEY, user.token);

      setAuthState({
        user,
        isLoading: false,
        error: null,
      });

      return {
        user,
        event: data.data.event,
        liveKitToken: data.data.tokens.liveKitToken,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      // Call logout API if user is admin
      if (authState.user?.type === 'admin') {
        await fetch('/api/auth/admin', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authState.user.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);

      setAuthState({
        user: null,
        isLoading: false,
        error: null,
      });
    }
  }, [authState.user]);

  // Check if user has specific permission
  const hasPermission = useCallback((
    requiredType: AuthUser['type'] | AuthUser['type'][],
    eventId?: string
  ): boolean => {
    if (!authState.user) return false;

    const requiredTypes = Array.isArray(requiredType) ? requiredType : [requiredType];

    // Admin has all permissions
    if (authState.user.type === 'admin') return true;

    // Check if user type is in required types
    if (!requiredTypes.includes(authState.user.type)) return false;

    // Check event-specific permissions
    if (eventId && authState.user.eventId !== eventId) return false;

    return true;
  }, [authState.user]);

  // Get authorization header for API calls
  const getAuthHeader = useCallback((): Record<string, string> => {
    if (!authState.user?.token) return {};

    return {
      'Authorization': `Bearer ${authState.user.token}`,
    };
  }, [authState.user]);

  // Check if token is about to expire (within 5 minutes)
  const isTokenExpiringSoon = useCallback((): boolean => {
    if (!authState.user) return false;

    const expiresAt = new Date(authState.user.expiresAt);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    return expiresAt <= fiveMinutesFromNow;
  }, [authState.user]);

  return {
    ...authState,
    loginAsAdmin,
    authenticateCamera,
    logout,
    hasPermission,
    getAuthHeader,
    isTokenExpiringSoon,
  };
}

// Hook for protected routes
export function useRequireAuth(
  requiredType?: AuthUser['type'] | AuthUser['type'][],
  eventId?: string
) {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      // Redirect to login or show error
      console.warn('Authentication required');
    } else if (requiredType && !auth.hasPermission(requiredType, eventId)) {
      // Insufficient permissions
      console.warn('Insufficient permissions');
    }
  }, [auth, requiredType, eventId]);

  return auth;
}

// Context provider component (optional, for global auth state)
const AuthContext = createContext<ReturnType<typeof useAuth> | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext value={auth}>
      {children}
    </AuthContext>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
