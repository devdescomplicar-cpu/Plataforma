/**
 * URL base do frontend para links (reset-password, planos, etc.).
 * Usa VITE_APP_URL ou FRONTEND_URL. Em produção, NUNCA usa localhost.
 */

function getRaw(): string {
  const raw =
    process.env.VITE_APP_URL ??
    process.env.FRONTEND_URL ??
    process.env.API_BASE_URL ??
    '';
  return String(raw).trim().replace(/\/api\/?$/, '').replace(/\/$/, '');
}

export function getFrontendUrl(): string {
  const base = getRaw();
  const isProduction = process.env.NODE_ENV === 'production';

  if (base && base.length > 0) {
    return base;
  }

  if (isProduction) {
    console.error(
      '[frontend-url] VITE_APP_URL ou FRONTEND_URL obrigatório em produção. Defina no .env.'
    );
  }

  return 'http://localhost:5173';
}
