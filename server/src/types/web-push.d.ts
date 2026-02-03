/**
 * Type declaration for 'web-push' (no official @types/web-push).
 * Minimal typing for the API used in push.service.ts.
 */
declare module 'web-push' {
  export function setVapidDetails(
    mailto: string,
    publicKey: string,
    privateKey: string
  ): void;

  export function sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string | Buffer | null,
    options?: {
      vapidDetails?: { publicKey: string; privateKey: string };
      TTL?: number;
      urgency?: 'very-low' | 'low' | 'normal' | 'high';
    }
  ): Promise<{ statusCode: number }>;
}
