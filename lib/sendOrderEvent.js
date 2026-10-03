import { getAdminApp } from '@/lib/firebaseAdmin';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { handleOrderEvent, KNOWN_EVENTS } from './orderEventCore.js';

// Server-only entry point of the order notification system. Called from two
// places: app/api/order-event/route.js (the public, secret-gated HTTP
// endpoint the Customer/Partner Flutter apps call) and
// app/actions/orderEvents.js (a Next.js Server Action the Admin website's
// own client pages call in-process — no HTTP hop, no secret needed, since
// this module only ever runs on the server).
//
// All the logic (who is told what, no duplicates) lives in
// ./orderEventCore.js so it can be tested without Firebase credentials.

export { KNOWN_EVENTS };

export async function sendOrderEvent(orderId, event) {
  const app = getAdminApp();
  if (!app) {
    return { error: 'FIREBASE_SERVICE_ACCOUNT_KEY not configured (or invalid JSON)', status: 500 };
  }
  return handleOrderEvent({ db: getFirestore(app), messaging: getMessaging(app), orderId, event });
}
