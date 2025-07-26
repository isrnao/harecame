'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield } from 'lucide-react';

interface AdminLoginFormProps {
  onSuccess?: () => void;
  eventId?: string;
}

export function AdminLoginForm({ onSuccess, eventId }: AdminLoginFormProps) {
  const { loginAsAdmin, isLoading, error } = useAuth();
  const [adminKey, setAdminKey] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!adminKey.trim()) {
      setLocalError('管理者キーを入力してください');
      return;
    }

    try {
      await loginAsAdmin(adminKey, eventId);
      onSuccess?.();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '認証に失敗しました');
    }
  };

  const displayError = localError || error;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Shield className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle>管理者ログイン</CardTitle>
        <CardDescription>
          {eventId 
            ? 'イベント管理にアクセスするには管理者キーを入力してください'
            : 'システム管理にアクセスするには管理者キーを入力してください'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminKey">管理者キー</Label>
            <Input
              id="adminKey"
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="管理者キーを入力"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {displayError && (
            <Alert variant="destructive">
              <AlertDescription>{displayError}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !adminKey.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                認証中...
              </>
            ) : (
              'ログイン'
            )}
          </Button>
        </form>

        <div className="mt-4 text-sm text-gray-600 text-center">
          <p>管理者キーは環境変数で設定されています</p>
          <p className="text-xs mt-1">
            開発環境では <code className="bg-gray-100 px-1 rounded">ADMIN_KEY</code> を確認してください
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Protected admin route wrapper
interface AdminRouteProps {
  children: React.ReactNode;
  eventId?: string;
  fallback?: React.ReactNode;
}

export function AdminRoute({ children, eventId, fallback }: AdminRouteProps) {
  const { user, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !hasPermission('admin', eventId)) {
    return fallback || <AdminLoginForm eventId={eventId} />;
  }

  return <>{children}</>;
}