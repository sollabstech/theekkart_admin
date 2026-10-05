import { NextResponse } from 'next/server';
import { getMessaging } from 'firebase-admin/messaging';
import { getAdminApp } from '@/lib/firebaseAdmin';
import { diagnosePush } from '@/lib/pushDiagnostics';

// GET /api/push-status — is push configured on THIS server? Returns yes/no
// facts only (never the key or the secret). Used by Admin → Notifications.
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await diagnosePush({ getApp: getAdminApp, getMessaging });
  return NextResponse.json(result);
}
