import { NextResponse } from 'next/server';

// The previous generated specification described obsolete authentication and mock APIs.
// Keep an explicit migration response until a complete OpenAPI contract is maintained.
export function GET() {
  return NextResponse.json({ success: false,
    error: '旧API仕様の提供は終了しました。現在のAPI契約はリポジトリのREADMEを参照してください。',
    documentation: 'https://github.com/isrnao/harecame/blob/develop/README.md#api',
  }, { status: 410 });
}
