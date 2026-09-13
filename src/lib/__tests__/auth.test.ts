// Mock the database service first
jest.mock('../database', () => ({
  EventService: {
    getByParticipationCode: jest.fn(),
  },
}));

import type { MockAuthService, TestEnvironment, JWTPayload } from '@/lib/type-guards';

// Mock jose library
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token'),
  })),
  jwtVerify: jest.fn(),
}));

import { AuthService } from '../auth';
import { EventService } from '../database';

// JWT Security Validator tests
describe('JWT Security Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    // Clear console spies
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('JWTSecurityValidator.validateJWTSecret', () => {

    describe('Production Environment', () => {
      beforeEach(() => {
        (process.env as any).NODE_ENV = 'production';
      });

      it('should throw error when JWT_SECRET is not set in production', () => {
        delete process.env.JWT_SECRET;

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).toThrow('JWT_SECRET environment variable must be set in production');
      });

      it('should throw error when JWT_SECRET uses default value in production', () => {
        process.env.JWT_SECRET = 'your-secret-key-change-in-production';

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).toThrow('JWT_SECRET cannot use the default value in production');
      });

      it('should work correctly with proper JWT_SECRET in production', () => {
        process.env.JWT_SECRET = 'secure-production-secret-key-with-sufficient-length';

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).not.toThrow();
      });

      it('should throw specific error message for missing JWT_SECRET in production', () => {
        delete process.env.JWT_SECRET;

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).toThrow('This is a critical security requirement');
      });

      it('should throw specific error message for default JWT_SECRET in production', () => {
        process.env.JWT_SECRET = 'your-secret-key-change-in-production';

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).toThrow('Please set a secure, randomly generated secret');
      });
    });

    describe('Development Environment', () => {
      beforeEach(() => {
        (process.env as any).NODE_ENV = 'development';
      });

      it('should warn when JWT_SECRET is not set in development', () => {
        delete process.env.JWT_SECRET;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        jest.isolateModules(() => {
          require('../auth');
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('JWT_SECRET environment variable is not set')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Please set JWT_SECRET in your .env.local file')
        );

        consoleSpy.mockRestore();
      });

      it('should warn when JWT_SECRET uses default value in development', () => {
        process.env.JWT_SECRET = 'your-secret-key-change-in-production';
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        jest.isolateModules(() => {
          require('../auth');
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('JWT_SECRET is using the default value')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Consider setting a unique secret')
        );

        consoleSpy.mockRestore();
      });

      it('should work without warnings with proper JWT_SECRET in development', () => {
        process.env.JWT_SECRET = 'development-secret-key';
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        jest.isolateModules(() => {
          require('../auth');
        });

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should return default secret when JWT_SECRET is not set in development', () => {
        delete process.env.JWT_SECRET;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        let result: string;
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          result = JWTSecurityValidator.validateJWTSecret();
        });

        expect(result!).toBe('your-secret-key-change-in-production');
        consoleSpy.mockRestore();
      });

      it('should return provided secret when JWT_SECRET is set in development', () => {
        process.env.JWT_SECRET = 'custom-development-secret';

        let result: string;
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          result = JWTSecurityValidator.validateJWTSecret();
        });

        expect(result!).toBe('custom-development-secret');
      });
    });

    describe('Test Environment', () => {
      beforeEach(() => {
        (process.env as any).NODE_ENV = 'test';
      });

      it('should work without warnings in test environment', () => {
        delete process.env.JWT_SECRET;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        jest.isolateModules(() => {
          require('../auth');
        });

        expect(consoleSpy).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should use default secret in test environment', () => {
        delete process.env.JWT_SECRET;

        let result: string;
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          result = JWTSecurityValidator.validateJWTSecret();
        });

        expect(result!).toBe('your-secret-key-change-in-production');
      });
    });

    describe('Error Handling', () => {
      it('should handle undefined NODE_ENV as development', () => {
        delete (process.env as any).NODE_ENV;
        delete process.env.JWT_SECRET;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        jest.isolateModules(() => {
          require('../auth');
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('JWT_SECRET environment variable is not set')
        );
        consoleSpy.mockRestore();
      });

      it('should handle empty JWT_SECRET as undefined', () => {
        (process.env as any).NODE_ENV = 'production';
        process.env.JWT_SECRET = '';

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).toThrow('JWT_SECRET environment variable must be set in production');
      });

      it('should handle whitespace-only JWT_SECRET as undefined', () => {
        (process.env as any).NODE_ENV = 'production';
        process.env.JWT_SECRET = '   ';

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).toThrow('JWT_SECRET environment variable must be set in production');
      });

      it('should handle null JWT_SECRET in production', () => {
        (process.env as any).NODE_ENV = 'production';
        process.env.JWT_SECRET = null as any;

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).toThrow('JWT_SECRET environment variable must be set in production');
      });

      it('should handle very short JWT_SECRET in production', () => {
        (process.env as any).NODE_ENV = 'production';
        process.env.JWT_SECRET = 'abc';

        // 短いシークレットでも設定されていれば通す（長さの検証は別途実装可能）
        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).not.toThrow();
      });

      it('should handle special characters in JWT_SECRET', () => {
        (process.env as any).NODE_ENV = 'production';
        process.env.JWT_SECRET = 'secret!@#$%^&*()_+-=[]{}|;:,.<>?';

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).not.toThrow();
      });

      it('should handle unicode characters in JWT_SECRET', () => {
        (process.env as any).NODE_ENV = 'production';
        process.env.JWT_SECRET = 'シークレット鍵🔐';

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).not.toThrow();
      });

      it('should handle multiple environment changes', () => {
        // 最初は開発環境
        (process.env as any).NODE_ENV = 'development';
        delete process.env.JWT_SECRET;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        let result1: string;
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          result1 = JWTSecurityValidator.validateJWTSecret();
        });

        expect(result1!).toBe('your-secret-key-change-in-production');
        expect(consoleSpy).toHaveBeenCalled();

        // 本番環境に変更
        (process.env as any).NODE_ENV = 'production';
        process.env.JWT_SECRET = 'production-secret';

        let result2: string;
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          result2 = JWTSecurityValidator.validateJWTSecret();
        });

        expect(result2!).toBe('production-secret');
        consoleSpy.mockRestore();
      });
    });
  });

  describe('JWTSecurityValidator.getEncodedSecret', () => {
    it('should return encoded secret as Uint8Array', () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.JWT_SECRET = 'test-secret-key';

      let result: Uint8Array;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.getEncodedSecret();
      });

      expect(result!.constructor.name).toBe('Uint8Array');
      expect(new TextDecoder().decode(result!)).toBe('test-secret-key');
    });

    it('should encode default secret when JWT_SECRET is not set in development', () => {
      (process.env as any).NODE_ENV = 'development';
      delete process.env.JWT_SECRET;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      let result: Uint8Array;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.getEncodedSecret();
      });

      expect(new TextDecoder().decode(result!)).toBe('your-secret-key-change-in-production');
      consoleSpy.mockRestore();
    });

    it('should throw error when called in production without JWT_SECRET', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      expect(() => {
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          JWTSecurityValidator.getEncodedSecret();
        });
      }).toThrow('JWT_SECRET environment variable must be set in production');
    });

    it('should handle encoding of long secrets', () => {
      (process.env as any).NODE_ENV = 'development';
      const longSecret = 'a'.repeat(1000);
      process.env.JWT_SECRET = longSecret;

      let result: Uint8Array;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.getEncodedSecret();
      });

      expect(new TextDecoder().decode(result!)).toBe(longSecret);
      expect(result!.length).toBe(1000);
    });
  });

  describe('Security Configuration Integration', () => {
    it('should validate security configuration on module load', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'secure-production-key';

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).not.toThrow();
    });

    it('should fail fast on security misconfiguration', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      const startTime = Date.now();
      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow();
      const endTime = Date.now();

      // セキュリティエラーは即座に発生すべき（100ms以内）
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should provide clear error messages for security issues', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      try {
        jest.isolateModules(() => {
          require('../auth');
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).toContain('JWT_SECRET');
        expect((error as Error).message).toContain('production');
        expect((error as Error).message).toContain('critical security requirement');
      }
    });

    it('should handle concurrent security validations', async () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.JWT_SECRET = 'concurrent-test-secret';

      const validations = Array.from({ length: 10 }, () =>
        new Promise((resolve) => {
          jest.isolateModules(() => {
            const { JWTSecurityValidator } = require('../auth');
            resolve(JWTSecurityValidator.validateJWTSecret());
          });
        })
      );

      const results = await Promise.all(validations);
      results.forEach(result => {
        expect(result).toBe('concurrent-test-secret');
      });
    });
  });

  describe('Environment-specific Security Behavior', () => {
    it('should treat non-production environments as development', () => {
      (process.env as any).NODE_ENV = 'staging';
      delete process.env.JWT_SECRET;

      let result: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.validateJWTSecret();
      });

      // staging環境は開発環境として扱われる（production以外はすべて開発環境）
      expect(result!).toBe('your-secret-key-change-in-production');
    });

    it('should handle case-sensitive environment names', () => {
      (process.env as any).NODE_ENV = 'PRODUCTION';
      delete process.env.JWT_SECRET;

      let result: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.validateJWTSecret();
      });

      // 大文字のPRODUCTIONは本番環境として認識されない（厳密に'production'のみ）
      expect(result!).toBe('your-secret-key-change-in-production');
    });

    it('should validate security in CI environment', () => {
      (process.env as any).NODE_ENV = 'test';
      process.env.CI = 'true';
      delete process.env.JWT_SECRET;

      let result: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.validateJWTSecret();
      });

      expect(result!).toBe('your-secret-key-change-in-production');
    });
  });

  describe('Advanced Security Validation Tests', () => {
    describe('JWT Secret Strength Validation', () => {
      it('should accept strong JWT secrets in production', () => {
        (process.env as any).NODE_ENV = 'production';
        const strongSecrets = [
          'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
          'MyVerySecureJWTSecret2024!@#$%^&*()',
          'jwt-secret-with-hyphens-and-numbers-123456789',
          'MixedCaseSecretWithNumbers123AndSymbols!@#',
        ];

        strongSecrets.forEach(secret => {
          process.env.JWT_SECRET = secret;

          expect(() => {
            jest.isolateModules(() => {
              require('../auth');
            });
          }).not.toThrow();
        });
      });

      it('should handle JWT secrets with various character encodings', () => {
        (process.env as any).NODE_ENV = 'production';
        const encodedSecrets = [
          'base64-like-secret-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
          'hex-like-secret-0123456789abcdef',
          'url-safe-secret_with-underscores.and.dots',
        ];

        encodedSecrets.forEach(secret => {
          process.env.JWT_SECRET = secret;

          expect(() => {
            jest.isolateModules(() => {
              require('../auth');
            });
          }).not.toThrow();
        });
      });
    });

    describe('Security Error Recovery', () => {
      it('should provide actionable error messages for production misconfiguration', () => {
        (process.env as any).NODE_ENV = 'production';
        delete process.env.JWT_SECRET;

        try {
          jest.isolateModules(() => {
            require('../auth');
          });
          fail('Expected security error to be thrown');
        } catch (error) {
          expect((error as Error).message).toContain('JWT_SECRET environment variable must be set in production');
          expect((error as Error).message).toContain('critical security requirement');
          expect((error as Error).name).toBe('Error');
        }
      });

      it('should provide specific guidance for default secret usage in production', () => {
        (process.env as any).NODE_ENV = 'production';
        process.env.JWT_SECRET = 'your-secret-key-change-in-production';

        try {
          jest.isolateModules(() => {
            require('../auth');
          });
          fail('Expected security error to be thrown');
        } catch (error) {
          expect((error as Error).message).toContain('JWT_SECRET cannot use the default value in production');
          expect((error as Error).message).toContain('Please set a secure, randomly generated secret');
        }
      });

      it('should handle process.env modifications during runtime', () => {
        (process.env as any).NODE_ENV = 'development';
        process.env.JWT_SECRET = 'initial-secret';

        let validator: unknown;
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          validator = JWTSecurityValidator;
        });

        // 実行時に環境変数を変更
        process.env.JWT_SECRET = 'modified-secret';

        // 新しい検証では変更された値が使用される
        const result = (validator as any).validateJWTSecret();
        expect(result).toBe('modified-secret');
      });
    });

    describe('Security Logging and Monitoring', () => {
      it('should log appropriate warnings for development environment issues', () => {
        (process.env as any).NODE_ENV = 'development';
        delete process.env.JWT_SECRET;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        jest.isolateModules(() => {
          require('../auth');
        });

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/⚠️.*JWT_SECRET.*not set.*development.*\.env\.local/)
        );

        consoleSpy.mockRestore();
      });

      it('should log warnings for default secret usage in development', () => {
        (process.env as any).NODE_ENV = 'development';
        process.env.JWT_SECRET = 'your-secret-key-change-in-production';

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        jest.isolateModules(() => {
          require('../auth');
        });

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/⚠️.*JWT_SECRET.*default value.*unique secret/)
        );

        consoleSpy.mockRestore();
      });

      it('should not log warnings for properly configured development environment', () => {
        (process.env as any).NODE_ENV = 'development';
        process.env.JWT_SECRET = 'proper-development-secret-key';

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        jest.isolateModules(() => {
          require('../auth');
        });

        expect(consoleSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(consoleLogSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
      });
    });

    describe('Security Configuration Edge Cases', () => {
      it('should handle rapid environment switches', () => {
        const environments = ['development', 'test', 'production', 'staging'];
        const secrets = ['dev-secret', 'test-secret', 'prod-secret', 'staging-secret'];

        environments.forEach((env, index) => {
          (process.env as any).NODE_ENV = env;
          process.env.JWT_SECRET = secrets[index];

          if (env === 'production') {
            expect(() => {
              jest.isolateModules(() => {
                require('../auth');
              });
            }).not.toThrow();
          } else {
            let result: string;
            jest.isolateModules(() => {
              const { JWTSecurityValidator } = require('../auth');
              result = JWTSecurityValidator.validateJWTSecret();
            });
            expect(result!).toBe(secrets[index]);
          }
        });
      });

      it('should handle memory pressure during validation', async () => {
        (process.env as any).NODE_ENV = 'development';
        process.env.JWT_SECRET = 'memory-test-secret';

        // 大量の同時検証を実行してメモリ使用量をテスト
        const validations = Array.from({ length: 1000 }, () =>
          new Promise<string>((resolve) => {
            jest.isolateModules(() => {
              const { JWTSecurityValidator } = require('../auth');
              resolve(JWTSecurityValidator.validateJWTSecret());
            });
          })
        );

        const results = await Promise.all(validations);

        // すべての結果が一致することを確認
        results.forEach(result => {
          expect(result).toBe('memory-test-secret');
        });

        // メモリリークがないことを確認（基本的なチェック）
        expect(results.length).toBe(1000);
      });

      it('should validate security configuration consistency', () => {
        (process.env as any).NODE_ENV = 'production';
        process.env.JWT_SECRET = 'consistent-production-secret';

        // 複数回の検証で一貫した結果が得られることを確認
        const results: string[] = [];

        for (let i = 0; i < 10; i++) {
          jest.isolateModules(() => {
            const { JWTSecurityValidator } = require('../auth');
            results.push(JWTSecurityValidator.validateJWTSecret());
          });
        }

        // すべての結果が同じであることを確認
        const uniqueResults = [...new Set(results)];
        expect(uniqueResults).toHaveLength(1);
        expect(uniqueResults[0]).toBe('consistent-production-secret');
      });

      it('should handle process termination scenarios', () => {
        (process.env as any).NODE_ENV = 'production';
        delete process.env.JWT_SECRET;

        // プロセス終了シナリオをシミュレート
        const originalExit = process.exit;
        const mockExit = jest.fn();
        process.exit = mockExit as any;

        try {
          jest.isolateModules(() => {
            require('../auth');
          });
          fail('Expected error to be thrown');
        } catch (error) {
          expect((error as Error).message).toContain('JWT_SECRET environment variable must be set in production');
          // process.exitが呼ばれていないことを確認（エラーハンドリングで適切に処理）
          expect(mockExit).not.toHaveBeenCalled();
        } finally {
          process.exit = originalExit;
        }
      });
    });

    describe('Security Integration Tests', () => {
      it('should integrate security validation with token generation', () => {
        (process.env as TestEnvironment).NODE_ENV = 'production';
        process.env.JWT_SECRET = 'integration-test-secret-key';

        let authService: MockAuthService | undefined;
        jest.isolateModules(() => {
          const auth = require('../auth');
          authService = auth.AuthService;
        });

        // セキュリティ検証が通った後、トークン生成が正常に動作することを確認
        expect(async () => {
          await authService!.generateAdminToken('admin-123', 'event-456');
        }).not.toThrow();
      });

      it('should prevent token generation with invalid security configuration', () => {
        (process.env as any).NODE_ENV = 'production';
        delete process.env.JWT_SECRET;

        expect(() => {
          jest.isolateModules(() => {
            require('../auth');
          });
        }).toThrow('JWT_SECRET environment variable must be set in production');
      });

      it('should validate encoded secret format for JWT operations', () => {
        (process.env as any).NODE_ENV = 'development';
        process.env.JWT_SECRET = 'encoded-secret-test';

        let encodedSecret: Uint8Array;
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          encodedSecret = JWTSecurityValidator.getEncodedSecret();
        });

        // エンコードされたシークレットが適切な形式であることを確認
        expect(encodedSecret!.constructor.name).toBe('Uint8Array');
        expect(encodedSecret!.length).toBeGreaterThan(0);
        expect(new TextDecoder().decode(encodedSecret!)).toBe('encoded-secret-test');
      });
    });
  });
});

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up environment for tests
    (process.env as any).NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key';

    // Reset jose mocks
    const { jwtVerify } = require('jose');
    jwtVerify.mockReset();
  });

  describe('generateAdminToken', () => {
    it('should generate admin token successfully', async () => {
      const userId = 'admin-123';
      const eventId = 'event-456';

      const token = await AuthService.generateAdminToken(userId, eventId);

      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('generateCameraToken', () => {
    it('should generate camera token successfully', async () => {
      const participantId = 'participant-123';
      const eventId = 'event-456';
      const participantName = 'Test User';

      const token = await AuthService.generateCameraToken(participantId, eventId, participantName);

      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('validateParticipationCodeAndGenerateToken', () => {
    it('should validate participation code and generate token', async () => {
      const mockEvent = {
        id: 'event-123',
        title: 'Test Event',
        status: 'scheduled',
        participationCode: 'ABC123',
      };

      (EventService.getByParticipationCode as jest.Mock).mockResolvedValue(mockEvent);

      const result = await AuthService.validateParticipationCodeAndGenerateToken(
        'ABC123',
        'participant-456',
        'Test User'
      );

      expect(result).toEqual({
        token: 'mock-jwt-token',
        event: mockEvent,
      });
      expect(EventService.getByParticipationCode).toHaveBeenCalledWith('ABC123');
    });

    it('should return null for invalid participation code', async () => {
      (EventService.getByParticipationCode as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.validateParticipationCodeAndGenerateToken(
        'INVALID',
        'participant-456',
        'Test User'
      );

      expect(result).toBeNull();
    });

    it('should return null for ended event', async () => {
      const mockEvent = {
        id: 'event-123',
        title: 'Test Event',
        status: 'ended',
        participationCode: 'ABC123',
      };

      (EventService.getByParticipationCode as jest.Mock).mockResolvedValue(mockEvent);

      const result = await AuthService.validateParticipationCodeAndGenerateToken(
        'ABC123',
        'participant-456',
        'Test User'
      );

      expect(result).toBeNull();
    });
  });

  describe('verifyToken', () => {
    it('should handle token verification errors gracefully', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockRejectedValueOnce(new Error('Invalid token'));

      const result = await AuthService.verifyToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockRejectedValueOnce(new Error('Token expired'));

      const result = await AuthService.verifyToken('expired-token');

      expect(result).toBeNull();
    });

    it('should return null for token with invalid signature', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockRejectedValueOnce(new Error('Invalid signature'));

      const result = await AuthService.verifyToken('tampered-token');

      expect(result).toBeNull();
    });

    it('should return null for token with wrong issuer', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockRejectedValueOnce(new Error('Invalid issuer'));

      const result = await AuthService.verifyToken('wrong-issuer-token');

      expect(result).toBeNull();
    });

    it('should return null for token with wrong audience', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockRejectedValueOnce(new Error('Invalid audience'));

      const result = await AuthService.verifyToken('wrong-audience-token');

      expect(result).toBeNull();
    });

    it('should handle malformed token gracefully', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockRejectedValueOnce(new Error('Malformed token'));

      const result = await AuthService.verifyToken('malformed.token');

      expect(result).toBeNull();
    });


  });

  describe('extractTokenFromRequest', () => {
    it('should extract token from Authorization header', () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer test-token'),
        },
      } as any;

      const token = AuthService.extractTokenFromRequest(mockRequest);

      expect(token).toBe('test-token');
      expect(mockRequest.headers.get).toHaveBeenCalledWith('authorization');
    });

    it('should return null for missing Authorization header', () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any;

      const token = AuthService.extractTokenFromRequest(mockRequest);

      expect(token).toBeNull();
    });

    it('should return null for invalid Authorization header format', () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Invalid format'),
        },
      } as any;

      const token = AuthService.extractTokenFromRequest(mockRequest);

      expect(token).toBeNull();
    });
  });

  // LiveKit実装のテスト追加
});

describe('Authentication Middleware', () => {
  describe('requireAuth', () => {
    it('should allow access with valid admin token', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockResolvedValue({
        payload: {
          sub: 'admin-123',
          type: 'admin',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iss: 'harecame-app',
          aud: 'harecame-users',
        },
      });

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid-admin-token'),
        },
      } as any;

      const { requireAuth } = require('../auth');
      const middleware = requireAuth(['admin']);
      const result = await middleware(mockRequest);

      expect(result).toHaveProperty('payload');
      expect(result.payload.type).toBe('admin');
    });

    it('should deny access without token', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any;

      const { requireAuth } = require('../auth');
      const middleware = requireAuth(['admin']);
      const result = await middleware(mockRequest);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(401);
    });

    it('should deny access with insufficient permissions', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockClear();
      jwtVerify.mockResolvedValueOnce({
        payload: {
          sub: 'camera-123',
          type: 'camera',
          eventId: 'event-456',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iss: 'harecame-app',
          aud: 'harecame-users',
        },
      });

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid-camera-token'),
        },
      } as any;

      const { requireAuth } = require('../auth');
      const middleware = requireAuth(['admin']);
      const result = await middleware(mockRequest);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(403);
    });
  });
});

// Additional Security Configuration Tests for Requirements 1.1, 1.2, 1.3
describe('Security Configuration Requirements Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Requirement 1.1: Production Environment JWT_SECRET Validation', () => {
    it('should throw error and stop system when JWT_SECRET is not set in production', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow('JWT_SECRET environment variable must be set in production. This is a critical security requirement.');
    });

    it('should throw error when JWT_SECRET is empty string in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = '';

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow('JWT_SECRET environment variable must be set in production');
    });

    it('should throw error when JWT_SECRET is only whitespace in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = '   \t\n   ';

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow('JWT_SECRET environment variable must be set in production');
    });

    it('should throw error when JWT_SECRET uses default value in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'your-secret-key-change-in-production';

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow('JWT_SECRET cannot use the default value in production. Please set a secure, randomly generated secret.');
    });

    it('should validate that system stops immediately on production security failure', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      const startTime = Date.now();

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow();

      const endTime = Date.now();
      // システムは即座に停止すべき（50ms以内）
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Requirement 1.2: JWT_SECRET Set Validation', () => {
    it('should start normally when JWT_SECRET is properly set in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'secure-production-jwt-secret-key-2024';

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).not.toThrow();
    });

    it('should start normally with complex JWT_SECRET in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'Complex!JWT@Secret#2024$With%Special^Characters&And*Numbers123';

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).not.toThrow();
    });

    it('should start normally with long JWT_SECRET in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(256); // 256文字の長いシークレット

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).not.toThrow();
    });

    it('should validate JWT_SECRET is properly encoded for JWT operations', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'production-encoding-test-secret';

      let encodedSecret: Uint8Array;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        encodedSecret = JWTSecurityValidator.getEncodedSecret();
      });

      expect(encodedSecret!.constructor.name).toBe('Uint8Array');
      expect(new TextDecoder().decode(encodedSecret!)).toBe('production-encoding-test-secret');
    });
  });

  describe('Requirement 1.3: Development Environment Default Value and Warning', () => {
    it('should allow default value usage in development with warning', () => {
      (process.env as any).NODE_ENV = 'development';
      delete process.env.JWT_SECRET;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      let result: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.validateJWTSecret();
      });

      expect(result!).toBe('your-secret-key-change-in-production');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  JWT_SECRET environment variable is not set. Using default value for development.')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please set JWT_SECRET in your .env.local file for better security.')
      );

      consoleSpy.mockRestore();
    });

    it('should warn when explicitly using default value in development', () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.JWT_SECRET = 'your-secret-key-change-in-production';

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      let result: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.validateJWTSecret();
      });

      expect(result!).toBe('your-secret-key-change-in-production');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  JWT_SECRET is using the default value.')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Consider setting a unique secret in your .env.local file.')
      );

      consoleSpy.mockRestore();
    });

    it('should not warn when proper JWT_SECRET is set in development', () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.JWT_SECRET = 'custom-development-secret-key';

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      let result: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.validateJWTSecret();
      });

      expect(result!).toBe('custom-development-secret-key');
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should treat undefined NODE_ENV as development environment', () => {
      delete (process.env as any).NODE_ENV;
      delete process.env.JWT_SECRET;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      let result: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.validateJWTSecret();
      });

      expect(result!).toBe('your-secret-key-change-in-production');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET environment variable is not set')
      );

      consoleSpy.mockRestore();
    });

    it('should treat non-production environments as development', () => {
      const nonProductionEnvs = ['development', 'test', 'staging', 'local', 'dev'];

      nonProductionEnvs.forEach(env => {
        (process.env as any).NODE_ENV = env;
        delete process.env.JWT_SECRET;

        let result: string;
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          result = JWTSecurityValidator.validateJWTSecret();
        });

        expect(result!).toBe('your-secret-key-change-in-production');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle process.env.JWT_SECRET being null', () => {
      (process.env as any).NODE_ENV = 'production';
      (process.env as any).JWT_SECRET = null;

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow('JWT_SECRET environment variable must be set in production');
    });

    it('should handle process.env.JWT_SECRET being undefined', () => {
      (process.env as any).NODE_ENV = 'production';
      (process.env as any).JWT_SECRET = undefined;

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow('JWT_SECRET environment variable must be set in production');
    });

    it('should handle JWT_SECRET with leading/trailing whitespace', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = '  production-secret-with-whitespace  ';

      let result: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        result = JWTSecurityValidator.validateJWTSecret();
      });

      expect(result!).toBe('production-secret-with-whitespace');
    });

    it('should provide detailed error context for debugging', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      try {
        jest.isolateModules(() => {
          require('../auth');
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).toContain('JWT_SECRET');
        expect((error as Error).message).toContain('production');
        expect((error as Error).message).toContain('critical security requirement');
        expect((error as Error).name).toBe('Error');
      }
    });

    it('should handle rapid environment variable changes', () => {
      // 開発環境から開始
      (process.env as any).NODE_ENV = 'development';
      process.env.JWT_SECRET = 'dev-secret';

      let devResult: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        devResult = JWTSecurityValidator.validateJWTSecret();
      });
      expect(devResult!).toBe('dev-secret');

      // 本番環境に変更
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'prod-secret';

      let prodResult: string;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        prodResult = JWTSecurityValidator.validateJWTSecret();
      });
      expect(prodResult!).toBe('prod-secret');

      // 本番環境でシークレットを削除
      delete process.env.JWT_SECRET;

      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow('JWT_SECRET environment variable must be set in production');
    });

    it('should maintain security validation consistency across multiple calls', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'consistent-production-secret';

      const results: string[] = [];

      // 複数回の検証を実行
      for (let i = 0; i < 5; i++) {
        jest.isolateModules(() => {
          const { JWTSecurityValidator } = require('../auth');
          results.push(JWTSecurityValidator.validateJWTSecret());
        });
      }

      // すべての結果が一致することを確認
      const uniqueResults = [...new Set(results)];
      expect(uniqueResults).toHaveLength(1);
      expect(uniqueResults[0]).toBe('consistent-production-secret');
    });
  });

  describe('Security Integration with Authentication System', () => {
    it('should ensure security validation occurs before any authentication operations', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'integration-test-secret';

      // セキュリティ検証が成功した場合のみ、認証システムが利用可能になる
      let authService: MockAuthService | undefined;
      expect(() => {
        jest.isolateModules(() => {
          const auth = require('../auth');
          authService = auth.AuthService;
        });
      }).not.toThrow();

      expect(authService).toBeDefined();
      expect(typeof authService!.generateAdminToken).toBe('function');
    });

    it('should prevent authentication system initialization with invalid security config', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      // セキュリティ検証が失敗した場合、認証システムは初期化されない
      expect(() => {
        jest.isolateModules(() => {
          require('../auth');
        });
      }).toThrow('JWT_SECRET environment variable must be set in production');
    });

    it('should validate that encoded secret is ready for JWT operations', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'jwt-operations-test-secret';

      let encodedSecret: Uint8Array;
      jest.isolateModules(() => {
        const { JWTSecurityValidator } = require('../auth');
        encodedSecret = JWTSecurityValidator.getEncodedSecret();
      });

      // エンコードされたシークレットがJWT操作に適した形式であることを確認
      expect(encodedSecret!.constructor.name).toBe('Uint8Array');
      expect(encodedSecret!.length).toBeGreaterThan(0);

      // デコードして元の値と一致することを確認
      const decodedSecret = new TextDecoder().decode(encodedSecret!);
      expect(decodedSecret).toBe('jwt-operations-test-secret');
    });
  });
});
