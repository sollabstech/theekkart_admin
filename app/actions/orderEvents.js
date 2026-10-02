'use server';

import { sendOrderEvent } from '@/lib/sendOrderEvent';

// Called by the Admin website's own client components right after they
// change an order (see orders/page.js and orders/[id]/page.js). Runs on the
// server via Next.js's Server Action RPC, so it reaches sendOrderEvent()
// in-process — no HTTP hop, and no need to ever put ORDER_EVENT_SECRET in
// the browser bundle (that secret is reserved for the Customer/Partner apps
// calling /api/order-event over the public network).
//
// Fire-and-forget from the caller's side: never throws, so a failed push
// never blocks or surfaces an error for an order change that already
// succeeded in Firestore.
export async function triggerOrderEvent(orderId, event) {
  try {
    await sendOrderEvent(orderId, event);
  } catch (e) {
    console.error('triggerOrderEvent failed', orderId, event, e.message);
  }
}
