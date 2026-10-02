import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Lazily initialize the Admin SDK from a service-account JSON stored as a
// server-only env var. Never prefix this with NEXT_PUBLIC_ — it must not
// reach the client bundle.
function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    return null;
  }
  return initializeApp({ credential: cert(serviceAccount) });
}

// POST /api/notify
// Body: { token?, tokens?, title, body, data? }  (unchanged — existing callers
// don't need to change)
// Uses the FCM HTTP v1 API via firebase-admin (service account), replacing
// the deprecated/sunset FCM Legacy HTTP API. Set FIREBASE_SERVICE_ACCOUNT_KEY
// in .env.local — see the setup note left in .env.local.example.
export async function POST(request) {
  const app = getAdminApp();
  if (!app) {
    return NextResponse.json(
      { error: 'FIREBASE_SERVICE_ACCOUNT_KEY not configured (or invalid JSON) in .env.local' },
      { status: 500 }
    );
  }

  const { token, tokens, title, body, data } = await request.json();
  const recipients = tokens?.length ? tokens : token ? [token] : [];
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No FCM token(s) provided' }, { status: 400 });
  }

  // FCM v1 requires every `data` value to be a string.
  const stringData = Object.fromEntries(
    Object.entries(data ?? {}).map(([k, v]) => [k, String(v)])
  );

  const messaging = getMessaging(app);

  try {
    if (recipients.length === 1) {
      const messageId = await messaging.send({
        token: recipients[0],
        notification: { title, body },
        data: stringData,
        android: { priority: 'high' },
      });
      return NextResponse.json({ ok: true, result: { messageId } });
    }

    // sendEachForMulticast is the v1-API equivalent of the Legacy API's
    // registration_ids multicast — it internally sends one message per
    // token (max 500 per call), matching the existing 500-token
    // client-side batching in notifications/page.js.
    const result = await messaging.sendEachForMulticast({
      tokens: recipients,
      notification: { title, body },
      data: stringData,
      android: { priority: 'high' },
    });
    return NextResponse.json({
      ok: result.successCount > 0,
      result: { successCount: result.successCount, failureCount: result.failureCount },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
