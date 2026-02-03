import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback para Suspense ao carregar rotas lazy.
 * Evita layout shift com altura mínima e skeleton consistente.
 */
export const PageLoader = () => (
  <div className="flex min-h-[60vh] w-full flex-col gap-6 p-6" aria-busy="true" aria-label="Carregando página">
    <div className="flex gap-4">
      <Skeleton className="h-24 flex-1 rounded-lg" />
      <Skeleton className="h-24 flex-1 rounded-lg" />
      <Skeleton className="h-24 flex-1 rounded-lg" />
    </div>
    <Skeleton className="h-[320px] w-full rounded-lg" />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  </div>
);
