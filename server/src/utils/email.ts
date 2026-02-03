/**
 * Normaliza e-mail para comparação e armazenamento: trim + minúsculas.
 * Garante que login/registro/busca aceitem maiúsculas ou minúsculas.
 */
export function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}
