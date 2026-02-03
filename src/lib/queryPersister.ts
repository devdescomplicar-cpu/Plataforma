import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const PERSIST_KEY = "descomplicar-query-cache";

/**
 * Persister para localStorage. Em SSR (window indefinido) não persiste.
 * Usado por PersistQueryClientProvider para exibir dados instantaneamente ao navegar/reabrir.
 */
export const queryPersister = createSyncStoragePersister({
  storage: typeof window === "undefined" ? undefined : window.localStorage,
  key: PERSIST_KEY,
  throttleTime: 1000,
});
