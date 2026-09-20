import { NextResponse } from 'next/server';

// POST /api/notify
// Body: { token?, tokens?, title, body, data? }
// Uses FCM Legacy HTTP API — set FCM_SERVER_KEY in .env.local
export async function POST(request) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    return NextResponse.json({ error: 'FCM_SERVER_KEY not configured in .env.local' }, { status: 500 });
  }

  const { token, tokens, title, body, data } = await request.json();
  const recipients = tokens?.length ? tokens : token ? [token] : [];
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No FCM token(s) provided' }, { status: 400 });
  }

  const payload = recipients.length === 1
    ? { to: recipients[0], notification: { title, body }, data: data ?? {}, priority: 'high', android: { priority: 'high' } }
    : { registration_ids: recipients, notification: { title, body }, data: data ?? {}, priority: 'high' };

  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
