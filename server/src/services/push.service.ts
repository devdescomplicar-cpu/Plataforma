import webpush from 'web-push';

const mailto = process.env.VAPID_MAILTO || 'mailto:support@descomplicar.app';
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

let configured = false;

export function getVapidPublicKey(): string | null {
  return publicKey && privateKey ? publicKey : null;
}

export function isPushConfigured(): boolean {
  if (configured) return true;
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(mailto, publicKey, privateKey);
    configured = true;
    return true;
  } catch {
    return false;
  }
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function sendPushNotification(
  subscription: PushSubscriptionPayload,
  payload: string | Record<string, unknown>
): Promise<boolean> {
  if (!isPushConfigured()) {
    throw new Error('VAPID keys not configured');
  }
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      body,
      {
        TTL: 86400,
        urgency: 'normal',
      }
    );
    return true;
  } catch (err) {
    const code = err && typeof err === 'object' && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 0;
    if (code === 410 || code === 404) {
      return false;
    }
    throw err;
  }
}
