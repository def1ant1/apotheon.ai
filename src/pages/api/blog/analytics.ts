import type { APIRoute } from 'astro';

export const prerender = false;

export const OPTIONS: APIRoute = () =>
  new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: unknown = await request.json();
    let events = 0;
    if (
      typeof body === 'object' &&
      body !== null &&
      'events' in body &&
      Array.isArray((body as { events: unknown }).events)
    ) {
      events = (body as { events: unknown[] }).events.length;
    }
    return new Response(JSON.stringify({ status: 'accepted', echo: events }), {
      status: 202,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      },
    });
  }
};
