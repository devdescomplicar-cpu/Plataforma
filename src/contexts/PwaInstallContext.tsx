import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type PwaPlatform = "desktop" | "android" | "ios" | "unknown";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
    return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const STORAGE_KEY = "pwa-install-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

export interface PwaInstallContextValue {
  isStandalone: boolean;
  canPrompt: boolean;
  platform: PwaPlatform;
  showBanner: boolean;
  install: () => Promise<void>;
  /** When dontShowAgain is true, the modal won't open again automatically. */
  dismiss: (dontShowAgain?: boolean) => void;
  showInstructions: () => void;
  isInstalling: boolean;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>("unknown");
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setPlatform(getPlatform());
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
      setCanPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (isStandalone) return;
    if (platform === "ios") {
      setShowBanner(!wasDismissed());
      return;
    }
    if (platform === "android" && canPrompt) {
      setShowBanner(!wasDismissed());
      return;
    }
    if (platform === "desktop") {
      setShowBanner(!wasDismissed());
    }
  }, [isStandalone, canPrompt, platform]);

  const install = useCallback(async () => {
    if (!deferredEvent) return;
    setIsInstalling(true);
    try {
      await deferredEvent.prompt();
      const { outcome } = await deferredEvent.userChoice;
      if (outcome === "accepted") setShowBanner(false);
    } finally {
      setIsInstalling(false);
    }
  }, [deferredEvent]);

  const dismiss = useCallback(() => {
    setDismissed();
    setShowBanner(false);
  }, []);

  const showInstructions = useCallback(() => {
    setShowBanner(true);
  }, []);

  const value: PwaInstallContextValue = {
    isStandalone,
    canPrompt: Boolean(deferredEvent),
    platform,
    showBanner: showBanner && !isStandalone,
    install,
    dismiss,
    showInstructions,
    isInstalling,
  };

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstallContext(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    return {
      isStandalone: false,
      canPrompt: false,
      platform: "unknown",
      showBanner: false,
      install: async () => {},
      dismiss: (_dontShowAgain?: boolean) => {},
      showInstructions: () => {},
      isInstalling: false,
    };
  }
  return ctx;
}
