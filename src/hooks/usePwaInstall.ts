/**
 * Re-exports PWA install state and actions from context.
 * Prefer using usePwaInstallContext() when inside the component tree.
 */
export { usePwaInstallContext as usePwaInstall } from "@/contexts/PwaInstallContext";
export type { PwaPlatform } from "@/contexts/PwaInstallContext";
