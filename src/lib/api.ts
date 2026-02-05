// Base URL da API:
// - VITE_API_URL vazio → "/api" (mesma origem): dev = Vite proxy /api → 3001; produção = front+back na porta 3000, /api no mesmo host = sem CORS.
// - VITE_API_URL definido → usa esse valor (ex: outro domínio; aí o back precisa de CORS).
const raw = import.meta.env.VITE_API_URL;
const hasCustomUrl = typeof raw === "string" && raw.trim() !== "" && raw !== "undefined";
const API_URL = hasCustomUrl
  ? raw.trim().replace(/\/$/, "")
  : "/api";

const REQUEST_TIMEOUT_MS = 25_000;
const UPLOAD_TIMEOUT_MS = 90_000;

const MESSAGE_524 =
  "Timeout do servidor (Cloudflare). O backend demorou para responder. Verifique se o servidor está rodando e acessível pelo tunnel.";

function getMessageForStatus(status: number): string {
  switch (status) {
    case 524:
      return MESSAGE_524;
    case 502:
    case 503:
      return "Servidor indisponível. Verifique se o backend está rodando (dev: 3002, prod: 3000) e se o tunnel aponta para a porta correta.";
    case 404:
      return "Rota não encontrada. Confirme se o proxy/tunnel encaminha /api para o backend.";
    case 401:
      return "Não autenticado.";
    default:
      return `Erro ${status}. Tente novamente.`;
  }
}

function isHtmlBody(text: string): boolean {
  const t = text.trim();
  return t.startsWith("<!") || t.startsWith("<html");
}

// Para desenvolvimento, usar fetch nativo do browser

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    stack?: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Recuperar token do localStorage se existir
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.token ?? (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const text = await response.text();

      const safeMessage = (): string => {
        if (response.status === 524 || isHtmlBody(text)) return getMessageForStatus(response.status);
        return response.ok ? 'Resposta inválida do servidor' : getMessageForStatus(response.status);
      };

      let data: ApiResponse<T>;
      if (contentType?.includes('application/json') && text.trim()) {
        try {
          data = JSON.parse(text) as ApiResponse<T>;
        } catch {
          data = { success: false, error: { message: getMessageForStatus(response.status) } };
        }
      } else {
        data = {
          success: false,
          error: { message: safeMessage() },
        };
      }

      if (!response.ok) {
        if (response.status === 401) {
          this.setToken(null);
        }
        if (response.status === 403 && data.error?.message?.includes('Conta vencida')) {
          this.setToken(null);
        }
        throw new Error(data.error?.message || 'Request failed');
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(MESSAGE_524);
        }
        if (isHtmlBody(error.message)) {
          throw new Error(MESSAGE_524);
        }
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<ApiResponse<T>> {
    let queryString = '';
    if (params && Object.keys(params).length > 0) {
      const defined = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
      ) as Record<string, string>;
      if (Object.keys(defined).length > 0) {
        queryString = '?' + new URLSearchParams(defined).toString();
      }
    }
    return this.request<T>(endpoint + queryString, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {};

    const token = this.token ?? (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const text = await response.text();
      let data: ApiResponse<T>;

      if (contentType?.includes('application/json')) {
        if (!text.trim()) {
          console.error('Upload: server returned empty body', {
            url,
            status: response.status,
            statusText: response.statusText,
          });
          throw new Error(`Servidor retornou resposta vazia (${response.status}). Verifique os logs do servidor.`);
        }
        try {
          data = JSON.parse(text) as ApiResponse<T>;
        } catch {
          console.error('Upload: invalid JSON from server', { url, status: response.status, bodyPreview: text.slice(0, 200) });
          throw new Error(`Resposta inválida do servidor (${response.status}). Verifique os logs do servidor.`);
        }
      } else {
        const msg =
          response.status === 524 || isHtmlBody(text)
            ? getMessageForStatus(response.status)
            : response.ok
              ? 'Resposta inválida do servidor (não é JSON).'
              : `Erro ${response.status}: ${text.slice(0, 100) || response.statusText}`;
        throw new Error(msg);
      }

      if (!response.ok) {
        throw new Error(data.error?.message ?? getMessageForStatus(response.status));
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Tempo esgotado. O servidor pode estar lento ou as imagens muito grandes.');
        }
        if (isHtmlBody(error.message)) {
          throw new Error(MESSAGE_524);
        }
      }
      throw error;
    }
  }
}

export const apiClient = new ApiClient(API_URL);
export const apiBaseUrl = API_URL;
