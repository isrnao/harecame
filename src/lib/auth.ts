import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { EventService } from "./database";
import type { EventClient } from "@/types";

// JWT Secret validation and security
export class JWTSecurityValidator {
  private static readonly DEFAULT_SECRET =
    "your-secret-key-change-in-production";

  /**
   * Validate JWT_SECRET environment variable based on environment
   */
  static validateJWTSecret(): string {
    const jwtSecret = process.env.JWT_SECRET?.trim();
    const environment = process.env.NODE_ENV || "development";

    // 本番環境でJWT_SECRETが未設定または空の場合はエラーを投げる
    if (
      environment === "production" &&
      (!jwtSecret || jwtSecret.length === 0)
    ) {
      throw new Error(
        "JWT_SECRET environment variable must be set in production. " +
          "This is a critical security requirement."
      );
    }

    // 本番環境でデフォルト値が使用されている場合もエラー
    if (environment === "production" && jwtSecret === this.DEFAULT_SECRET) {
      throw new Error(
        "JWT_SECRET cannot use the default value in production. " +
          "Please set a secure, randomly generated secret."
      );
    }

    // 開発環境でJWT_SECRETが未設定の場合は警告を出力
    if (environment === "development" && !jwtSecret) {
      console.warn(
        "⚠️  JWT_SECRET environment variable is not set. Using default value for development. " +
          "Please set JWT_SECRET in your .env.local file for better security."
      );
      return this.DEFAULT_SECRET;
    }

    // 開発環境でデフォルト値が明示的に設定されている場合も警告
    if (environment === "development" && jwtSecret === this.DEFAULT_SECRET) {
      console.warn(
        "⚠️  JWT_SECRET is using the default value. " +
          "Consider setting a unique secret in your .env.local file."
      );
    }

    return jwtSecret || this.DEFAULT_SECRET;
  }

  /**
   * Get validated JWT secret as TextEncoder
   */
  static getEncodedSecret(): Uint8Array {
    const secret = this.validateJWTSecret();
    return new TextEncoder().encode(secret);
  }
}

// JWT configuration with security validation
const JWT_SECRET = JWTSecurityValidator.getEncodedSecret();
const JWT_ISSUER = "harecame-app";
const JWT_AUDIENCE = "harecame-users";

// Token types
export type TokenType = "admin" | "organizer" | "camera" | "viewer";

// JWT payload interface
export interface JWTPayload {
  sub: string; // Subject (user/participant ID)
  type: TokenType; // Token type
  eventId?: string; // Event ID for event-specific tokens
  participantName?: string; // Participant name for camera operators
  iat: number; // Issued at
  exp: number; // Expires at
  iss: string; // Issuer
  aud: string; // Audience
  [key: string]: unknown; // Index signature for jose compatibility
}

// Token generation functions
export class AuthService {
  /**
   * Generate admin token for event organizers
   */
  static async generateAdminToken(
    userId: string,
    eventId?: string
  ): Promise<string> {
    const payload: JWTPayload = {
      sub: userId,
      type: "admin",
      eventId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    };

    return await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(JWT_SECRET);
  }

  /**
   * Generate organizer token for event creators
   */
  static async generateOrganizerToken(
    userId: string,
    eventId: string
  ): Promise<string> {
    const payload: JWTPayload = {
      sub: userId,
      type: "organizer",
      eventId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    };

    return await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(JWT_SECRET);
  }

  /**
   * Generate camera operator token
   */
  static async generateCameraToken(
    participantId: string,
    eventId: string,
    participantName?: string
  ): Promise<string> {
    const payload: JWTPayload = {
      sub: participantId,
      type: "camera",
      eventId,
      participantName,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60, // 8 hours
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    };

    return await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(JWT_SECRET);
  }

  /**
   * Generate viewer token (optional, for analytics)
   */
  static async generateViewerToken(
    viewerId: string,
    eventId: string
  ): Promise<string> {
    const payload: JWTPayload = {
      sub: viewerId,
      type: "viewer",
      eventId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 4 * 60 * 60, // 4 hours
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    };

    return await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(JWT_SECRET);
  }

  /**
   * Verify and decode JWT token
   */
  static async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      return payload as JWTPayload;
    } catch (error) {
      console.error("Token verification failed:", error);
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromRequest(request: NextRequest): string | null {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    return authHeader.substring(7);
  }

  /**
   * Validate participation code and generate camera token
   */
  static async validateParticipationCodeAndGenerateToken(
    participationCode: string,
    participantId: string,
    participantName?: string
  ): Promise<{ token: string; event: EventClient } | null> {
    try {
      // Find event by participation code
      const event = await EventService.getByParticipationCode(
        participationCode.toUpperCase()
      );

      if (!event) {
        return null;
      }

      // Check if event is active (not ended)
      if (event.status === "ended") {
        throw new Error("Event has ended");
      }

      // Generate camera token
      const token = await this.generateCameraToken(
        participantId,
        event.id,
        participantName
      );

      return { token, event };
    } catch (error) {
      console.error("Participation code validation failed:", error);
      return null;
    }
  }

  /**
   * Check if user has admin access
   */
  static async hasAdminAccess(request: NextRequest): Promise<boolean> {
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      return false;
    }

    const payload = await this.verifyToken(token);

    return payload?.type === "admin";
  }

  /**
   * Check if user has organizer access for specific event
   */
  static async hasOrganizerAccess(
    request: NextRequest,
    eventId: string
  ): Promise<boolean> {
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      return false;
    }

    const payload = await this.verifyToken(token);

    return (
      payload?.type === "admin" ||
      (payload?.type === "organizer" && payload?.eventId === eventId)
    );
  }

  /**
   * Check if user has camera access for specific event
   */
  static async hasCameraAccess(
    request: NextRequest,
    eventId: string
  ): Promise<{
    hasAccess: boolean;
    participantId?: string;
    participantName?: string;
  }> {
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      return { hasAccess: false };
    }

    const payload = await this.verifyToken(token);

    if (!payload) {
      return { hasAccess: false };
    }

    // Admin and organizer have camera access
    if (
      payload.type === "admin" ||
      (payload.type === "organizer" && payload.eventId === eventId)
    ) {
      return { hasAccess: true, participantId: payload.sub };
    }

    // Camera operator has access to their specific event
    if (payload.type === "camera" && payload.eventId === eventId) {
      return {
        hasAccess: true,
        participantId: payload.sub,
        participantName: payload.participantName,
      };
    }

    return { hasAccess: false };
  }

  /**
   * Generate LiveKit access token for camera streaming
   *
   * ⚠️ **MOCK IMPLEMENTATION WARNING** ⚠️
   * This is currently a placeholder implementation that does NOT integrate with LiveKit.
   * It generates a JWT token using the application's secret instead of LiveKit's API.
   *
   * For production use, this method should be replaced with proper LiveKit token generation:
   * - Install @livekit/server-sdk
   * - Use AccessToken class from LiveKit SDK
   * - Configure with proper LiveKit API key and secret
   * - Set appropriate room permissions and metadata
   *
   * @param participantId - Unique identifier for the participant
   * @param eventId - Event ID to create room name
   * @param participantName - Optional display name for the participant
   * @returns Promise<string> - JWT token (currently mock implementation)
   *
   * @example
   * ```typescript
   * // Current mock implementation - DO NOT USE IN PRODUCTION
   * const token = await AuthService.generateLiveKitToken('user123', 'event456', 'John Doe');
   *
   * // Proper LiveKit implementation should be:
   * // import { AccessToken } from '@livekit/server-sdk';
   * // const token = new AccessToken(apiKey, apiSecret, { identity: participantId });
   * // token.addGrant({ room: `event-${eventId}`, roomJoin: true, canPublish: true });
   * // return await token.toJwt();
   * ```
   */
  static async generateLiveKitToken(
    participantId: string,
    eventId: string,
    participantName?: string
  ): Promise<string> {
    const environment = process.env.NODE_ENV || "development";

    // 本番環境での使用時に警告を出力
    if (environment === "production") {
      console.error(
        "🚨 CRITICAL: LiveKit token generation is using MOCK IMPLEMENTATION in production! " +
          "This will NOT work with actual LiveKit servers. " +
          "Please implement proper LiveKit token generation using @livekit/server-sdk before deploying to production."
      );
    } else {
      console.warn(
        "⚠️  LiveKit token generation is using mock implementation. " +
          "This is a placeholder that generates a JWT token using the application secret instead of LiveKit API. " +
          "For actual LiveKit integration, implement proper token generation using @livekit/server-sdk."
      );
    }

    // MOCK IMPLEMENTATION - This does NOT integrate with LiveKit
    // This is a placeholder that generates a JWT token using the application's secret
    // instead of LiveKit's proper token generation process
    const payload = {
      sub: participantId,
      room: `event-${eventId}`,
      name: participantName || participantId,
      permissions: {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 hours
      // Mock implementation marker
      mockImplementation: true,
      warning:
        "This token is generated by mock implementation and will not work with LiveKit servers",
    };

    return await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(JWT_SECRET);
  }
}

// Authentication middleware functions
export function requireAuth(allowedTypes: TokenType[] = ["admin"]) {
  return async (
    request: NextRequest
  ): Promise<{ payload: JWTPayload } | NextResponse> => {
    const token = AuthService.extractTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const payload = await AuthService.verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (!allowedTypes.includes(payload.type)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    return { payload };
  };
}

export function requireEventAccess(
  eventId: string,
  allowedTypes: TokenType[] = ["admin", "organizer"]
) {
  return async (
    request: NextRequest
  ): Promise<{ payload: JWTPayload } | NextResponse> => {
    const authResult = await requireAuth(["admin", "organizer", "camera"])(
      request
    );

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { payload } = authResult;

    // Admin always has access
    if (payload.type === "admin") {
      return { payload };
    }

    // Check event-specific access
    if (payload.eventId !== eventId) {
      return NextResponse.json(
        { success: false, error: "Access denied for this event" },
        { status: 403 }
      );
    }

    // Check if token type is allowed
    if (!allowedTypes.includes(payload.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions for this operation",
        },
        { status: 403 }
      );
    }

    return { payload };
  };
}

// Session management (for browser-based authentication)
export class SessionService {
  private static readonly SESSION_COOKIE_NAME = "harecame-session";
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Create session cookie
   */
  static createSessionCookie(token: string): string {
    const expires = new Date(Date.now() + this.SESSION_DURATION);

    return `${
      this.SESSION_COOKIE_NAME
    }=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=${expires.toUTCString()}`;
  }

  /**
   * Extract session token from cookies
   */
  static extractSessionToken(request: NextRequest): string | null {
    const cookies = request.headers.get("cookie");

    if (!cookies) {
      return null;
    }

    const sessionCookie = cookies
      .split(";")
      .find((cookie) =>
        cookie.trim().startsWith(`${this.SESSION_COOKIE_NAME}=`)
      );

    if (!sessionCookie) {
      return null;
    }

    return sessionCookie.split("=")[1] ?? null;
  }

  /**
   * Clear session cookie
   */
  static clearSessionCookie(): string {
    return `${this.SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}
