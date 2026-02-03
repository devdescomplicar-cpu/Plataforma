import { useEffect, useRef } from "react";
import { useUser } from "@/hooks/useUser";
import { apiBaseUrl, apiClient } from "@/lib/api";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function subscriptionToPayload(sub: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const p256dh = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  const toBase64 = (buf: ArrayBuffer | null) => {
    if (!buf) return "";
    const arr = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
    return window.btoa(binary);
  };
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: toBase64(p256dh), auth: toBase64(auth) },
  };
}

/**
 * Requests notification permission and registers push subscription with the backend.
 * Call this on user gesture (e.g. button click) so the browser shows the permission prompt.
 * Returns true if subscription was registered, false otherwise.
 */
export async function requestAndSubscribePush(): Promise<boolean> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  if (Notification.permission === "denied") return false;

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await fetch(`${apiBaseUrl}/push/vapid-public-key`);
    if (!keyRes.ok) return false;
    const keyJson = (await keyRes.json()) as { success?: boolean; data?: { publicKey?: string } };
    const publicKey = keyJson.data?.publicKey;
    if (!publicKey) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const res = await apiClient.post<{ success: boolean }>("/push/subscribe", {
      subscription: subscriptionToPayload(sub),
    });
    return res.success === true;
  } catch (err) {
    // Push not available (e.g. HTTP, unsupported browser, or service unavailable)
    if (import.meta.env.DEV && err instanceof Error) {
      console.debug("[Push] Registration skipped:", err.name, err.message);
    }
    return false;
  }
}

/**
 * Registers the current device for push notifications when the user is logged in.
 * Call once when the app layout is mounted (authenticated).
 */
export function usePushSubscribe(): void {
  const { data: userData } = useUser();
  const subscribed = useRef(false);

  useEffect(() => {
    if (!userData?.user || subscribed.current) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "denied") return;

    let cancelled = false;

    const run = async () => {
      try {
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted" || cancelled) return;

        const reg = await navigator.serviceWorker.ready;
        if (cancelled) return;

        const keyRes = await fetch(`${apiBaseUrl}/push/vapid-public-key`);
        if (!keyRes.ok || cancelled) return;
        const keyJson = (await keyRes.json()) as { success?: boolean; data?: { publicKey?: string } };
        const publicKey = keyJson.data?.publicKey;
        if (!publicKey || cancelled) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }
        if (cancelled) return;

        const res = await apiClient.post<{ success: boolean }>("/push/subscribe", {
          subscription: subscriptionToPayload(sub),
        });
        if (res.success) subscribed.current = true;
      } catch (err) {
        // Push not available (AbortError, DOMException, etc.) - fail silently
        if (import.meta.env.DEV && err instanceof Error) {
          console.debug("[Push] Auto-subscribe skipped:", err.name);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userData?.user]);
}
