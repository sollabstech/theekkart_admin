import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { sendOrderEvent } from '@/lib/sendOrderEvent';

// POST /api/order-event
// Body: { orderId, event } ONLY — title/body/token are never accepted from
// the caller. Called by the Customer and Partner Flutter apps (see
// lib/config/api_config.dart in each) right after they successfully change
// an order; calls are fire-and-forget on their end, so a failure here must
// never be the thing that breaks anything for them — it's just logged.
// The Admin website's own pages don't call this HTTP route — they use the
// app/actions/orderEvents.js Server Action instead, which calls the same
// sendOrderEvent() logic in-process without ever needing this secret.
//
// Auth: requires header `x-notify-secret` to match ORDER_EVENT_SECRET
// (server-only env var, set in Vercel, never NEXT_PUBLIC_).

function secretsMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request) {
  const secret = request.headers.get('x-notify-secret');
  if (!secretsMatch(secret, process.env.ORDER_EVENT_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { orderId, event } = payload || {};
  const result = await sendOrderEvent(orderId, event);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  }
  return NextResponse.json(result);
}
