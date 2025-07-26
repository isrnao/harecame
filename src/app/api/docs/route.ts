import { NextRequest, NextResponse } from 'next/server';
import { generateAPIDocumentation, API_EXAMPLES, RATE_LIMIT_DOCS, AUTH_DOCS } from '@/lib/api-docs';
import { securityHeaders } from '@/lib/middleware';

// Next.js 15: API ドキュメントは静的コンテンツとしてキャッシュ
export const dynamic = 'force-static';

// GET /api/docs - API Documentation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';
  const section = searchParams.get('section');

  try {
    switch (section) {
      case 'examples':
        return NextResponse.json(
          {
            success: true,
            data: API_EXAMPLES,
          },
          { headers: securityHeaders() }
        );

      case 'rate-limits':
        return NextResponse.json(
          {
            success: true,
            data: RATE_LIMIT_DOCS,
          },
          { headers: securityHeaders() }
        );

      case 'authentication':
        return NextResponse.json(
          {
            success: true,
            data: AUTH_DOCS,
          },
          { headers: securityHeaders() }
        );

      default:
        // Return full OpenAPI specification
        const documentation = generateAPIDocumentation();

        if (format === 'yaml') {
          // Convert to YAML format (simplified)
          const yamlContent = `# Harecame API Documentation
# Generated on ${new Date().toISOString()}

openapi: "${documentation.openapi}"
info:
  title: "${documentation.info.title}"
  version: "${documentation.info.version}"
  description: "${documentation.info.description}"

# For full specification, use format=json
# Visit /api/docs?format=json for complete OpenAPI spec
`;

          return new NextResponse(yamlContent, {
            headers: {
              'Content-Type': 'text/yaml',
              ...securityHeaders(),
            },
          });
        }

        return NextResponse.json(
          {
            success: true,
            data: documentation,
            meta: {
              generatedAt: new Date().toISOString(),
              version: documentation.info.version,
              endpoints: Object.keys(documentation.paths).length,
            },
          },
          { headers: securityHeaders() }
        );
    }
  } catch (error) {
    console.error('Failed to generate API documentation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate API documentation',
      },
      { status: 500, headers: securityHeaders() }
    );
  }
}