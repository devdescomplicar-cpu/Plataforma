/**
 * Base URL da aplicação (usado em links, meta tags, etc.).
 * Definir no .env: VITE_APP_URL (ex: https://descomplicar.pratiko.app.br)
 * Vazio = mesma origem (links relativos).
 */
const raw = import.meta.env.VITE_APP_URL;
export const appBaseUrl =
  typeof raw === 'string' && raw.trim() !== '' && raw !== 'undefined'
    ? raw.trim().replace(/\/$/, '')
    : '';

/**
 * Basename para React Router quando a app é servida em subpath.
 * Ex: VITE_APP_URL=https://x.com/app -> basename = "/app"
 */
export function getRouterBasename(): string {
  if (!appBaseUrl) return '';
  try {
    const path = new URL(appBaseUrl).pathname;
    return path === '/' ? '' : path;
  } catch {
    return '';
  }
}
