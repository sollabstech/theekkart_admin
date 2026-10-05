// Is push set up? Answers the questions behind "push notifications don't
// work": is the service account configured, are its credentials accepted by
// Firebase, is the app-to-server secret set. Server-only; `messaging` is
// injectable so it can be tested without Firebase.

/** FCM error codes that mean "we reached Firebase and it understood us" (the dummy token itself is bad). */
const REACHED = new Set([
  'messaging/invalid-argument',
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

const TIMEOUT_MS = 8000;
const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timed out'), { code: 'diagnostic/timeout' })), ms)),
]);

export async function diagnosePush({ env = process.env, getApp, getMessaging, timeoutMs = TIMEOUT_MS } = {}) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const out = {
    serviceAccountConfigured: false,
    serviceAccountProject: null,
    credentialsValid: null, // true / false / null = couldn't tell
    orderEventSecretConfigured: !!env.ORDER_EVENT_SECRET,
    detail: '',
  };

  if (!raw || !String(raw).trim()) {
    out.detail = 'FIREBASE_SERVICE_ACCOUNT_KEY is not set on the server.';
    return out;
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    out.detail = 'FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON — paste the whole downloaded key file.';
    return out;
  }
  out.serviceAccountProject = parsed.project_id || null;
  if (!parsed.private_key || !parsed.client_email) {
    out.detail = 'FIREBASE_SERVICE_ACCOUNT_KEY is missing private_key / client_email — use a "service account" key from Firebase → Project settings → Service accounts.';
    return out;
  }
  out.serviceAccountConfigured = true;

  const app = getApp ? getApp() : null;
  if (!app) { out.detail = 'The server could not start Firebase Admin with that key.'; return out; }

  try {
    // validate_only dry run: nothing is delivered, but the credentials are really used
    await withTimeout(getMessaging(app).send({ token: 'diagnostic-token-not-real', notification: { title: 'x', body: 'x' } }, true), timeoutMs);
    out.credentialsValid = true;
  } catch (e) {
    const code = e?.code || '';
    if (REACHED.has(code)) out.credentialsValid = true;
    else if (/auth|credential|permission|unauthenticated|token-refresh|invalid_grant/i.test(code + ' ' + (e?.message || ''))) {
      out.credentialsValid = false;
      out.detail = `Firebase rejected the service account (${code || e.message}). Generate a new private key and update the setting.`;
    } else {
      out.detail = `Could not reach Firebase to verify the key (${code || e?.message || 'unknown error'}).`;
    }
  }
  if (out.credentialsValid === true) out.detail = 'Push is ready on the server.';
  if (!out.orderEventSecretConfigured) out.detail += ' ORDER_EVENT_SECRET is not set, so the apps cannot trigger order notifications.';
  return out;
}
