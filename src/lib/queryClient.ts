import { QueryClient } from "@tanstack/react-query";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Query client configurado para SaaS de alta performance:
 * - staleTime 5 min: reduz refetch desnecessários
 * - gcTime 24h: compatível com persistência em localStorage (dados instantâneos ao reabrir/navegar)
 * - retry 2: evita loops longos em falhas
 * - refetchOnWindowFocus false: menos requisições ao alternar abas
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES_MS,
      gcTime: ONE_DAY_MS,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
