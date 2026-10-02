import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Lazily initializes the Admin SDK from a service-account JSON stored as a
// server-only env var. Never prefix this with NEXT_PUBLIC_ — it must not
// reach the client bundle. Shared by every API route that needs
// firebase-admin (notify, order-event).
export function getAdminApp() {
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
