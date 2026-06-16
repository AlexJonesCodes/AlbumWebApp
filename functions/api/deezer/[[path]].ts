const API_PREFIX = '/api/deezer/';

function getUpstreamPath(requestUrl: URL): string {
  const path = requestUrl.pathname.startsWith(API_PREFIX)
    ? requestUrl.pathname.slice(API_PREFIX.length)
    : '';

  return path.replace(/^\/+|\/+$/g, '');
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const incomingUrl = new URL(context.request.url);
  const path = getUpstreamPath(incomingUrl);

  if (!path) {
    return Response.json(
      { error: 'Missing Deezer API path.' },
      { status: 400 },
    );
  }

  const upstreamUrl = new URL(`https://api.deezer.com/${path}`);
  upstreamUrl.search = incomingUrl.search;

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const headers = new Headers(upstreamResponse.headers);
  headers.set('cache-control', 'public, max-age=300');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}
