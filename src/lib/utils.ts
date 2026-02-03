import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Garante que URLs de imagens de veículos usem a API (HTTPS, mesmo domínio).
 * Converte URLs antigas do MinIO (localhost, http) em /api/vehicle-images/:key.
 */
export function toPublicImageUrl(url: string | undefined | null): string | undefined {
  if (url == null || url === "") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/api/vehicle-images/")) return trimmed;
  const match = trimmed.match(/\/vehicle-images\/(.+)$/);
  if (match?.[1]) return `/api/vehicle-images/${match[1]}`;
  if (trimmed.startsWith("http://") || trimmed.includes("localhost")) return undefined;
  return trimmed;
}
