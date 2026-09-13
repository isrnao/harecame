const fs = require('node:fs');
const path = require('node:path');
const mode = process.argv[2] || 'verify';
const dynamic = ['/events', '/events/create', '/events/[eventId]/dashboard', '/camera/[eventId]', '/watch/[eventId]'];
if (mode === 'check-config') {
  const files = [
    'src/app/(organizer)/events/page.tsx', 'src/app/(organizer)/events/create/page.tsx',
    'src/app/(organizer)/events/[eventId]/dashboard/page.tsx',
  ];
  for (const file of files) {
    if (!/dynamic\s*=\s*['"]force-dynamic['"]/.test(fs.readFileSync(file, 'utf8'))) throw new Error(`Authenticated route must be dynamic: ${file}`);
  }
  console.log('Authenticated route configuration verified');
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join('.next', 'prerender-manifest.json'), 'utf8'));
  const appPaths = JSON.parse(fs.readFileSync(path.join('.next', 'server', 'app-paths-manifest.json'), 'utf8'));
  for (const route of dynamic) {
    const exists = Object.keys(appPaths).some(key => key.replace(/\/\([^/]+\)/g, '').replace(/\/page$/, '') === route);
    if (!exists) throw new Error(`Expected route is missing from the build: ${route}`);
    const prefix = route.split('/[')[0];
    const prerendered = Object.entries(manifest.routes).some(([key, value]) =>
      key === route || value.srcRoute === route || (route.includes('[') && key.startsWith(`${prefix}/`)));
    if (prerendered) throw new Error(`Request-specific route was prerendered: ${route}`);
  }
  if (!manifest.routes['/login']) throw new Error('Public login page was not prerendered');
  console.log('Build output verified: protected routes exist and contain no prerendered user data');
}
