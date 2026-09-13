// Do not log request headers or full URLs: they may contain credentials.
export async function register() { console.info('Harecame server initialized'); }
export async function onRequestError(
  error: Error & { digest?: string },
  request: { method?: string },
  context: { routePath: string; routeType: string },
) {
  console.error('Server request failed', { name: error.name, digest: error.digest,
    method: request.method, route: context.routePath, routeType: context.routeType });
}
