import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl">イベントが見つかりません</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              指定されたイベントは存在しないか、既に終了している可能性があります。
            </p>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                以下をご確認ください：
              </p>
              <ul className="text-sm text-gray-600 text-left space-y-1">
                <li>• イベントIDが正しく入力されているか</li>
                <li>• イベントがまだ有効かどうか</li>
                <li>• URLが正しいかどうか</li>
              </ul>
            </div>
            <div className="pt-4">
              <Button asChild className="w-full">
                <Link href="/">
                  ホームに戻る
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}