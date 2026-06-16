interface Env {}

interface PagesContext {
  request: Request;
  params: {
    path?: string;
  };
  env: Env;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const incomingUrl = new URL(context.request.url);
  const path = context.params.path ?? '';
  const upstreamUrl = new URL(`https://api.deezer.com/${path}`);
  upstreamUrl.search = incomingUrl.search;

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: context.request.method,
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
