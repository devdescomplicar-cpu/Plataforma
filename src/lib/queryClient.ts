import { QueryClient } from "@tanstack/react-query";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Query client configurado para SaaS de alta performance:
 * - staleTime 5 min: reduz refetch desnecessários
 * - retry 2: evita loops longos em falhas
 * - refetchOnWindowFocus false: menos requisições ao alternar abas
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES_MS,
      gcTime: FIVE_MINUTES_MS * 2, // 10 min (ex-cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
