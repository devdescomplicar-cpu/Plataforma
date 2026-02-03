/**
 * Substituição de variáveis em templates de notificação.
 * Variáveis disponíveis: nome_usuario, nome_cliente, veiculo, estado_checklist,
 * data_vencimento, link_plataforma, link_planos, link_recuperar_senha (mesmo que link_reset_senha, com token),
 * link_reset_senha (link de redefinição com token), nome_plano, nome_oferta, status_usuario.
 */

import { getFrontendUrl } from "./frontend-url.js";

function getPlatformBaseUrl(): string {
  return getFrontendUrl();
}

export interface TemplateVariablesContext {
  nome_usuario?: string;
  nome_cliente?: string;
  veiculo?: string;
  estado_checklist?: string;
  data_vencimento?: string;
  link_plataforma?: string;
  link_planos?: string;
  link_recuperar_senha?: string;
  link_reset_senha?: string;
  nome_plano?: string;
  nome_oferta?: string;
  status_usuario?: string;
}

function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function checklistStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pendente",
    in_progress: "Em andamento",
    completed: "Concluído",
  };
  return map[status] ?? status;
}

function accountStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    trial: "Trial",
    cancelled: "Cancelado",
    vencido: "Vencido",
  };
  return map[status] ?? status;
}

/**
 * Monta o contexto de variáveis a partir dos dados disponíveis.
 * Passe apenas os dados que existem no contexto da notificação.
 */
export function buildTemplateContext(
  data: {
    userName?: string;
    clientName?: string;
    vehicle?: { brand: string; model: string; year: number };
    checklistStatus?: string;
    expirationDate?: Date | string | null;
    planName?: string;
    offerName?: string;
    accountStatus?: string;
    /** Link completo com token (usado em recuperação de senha) */
    resetPasswordLink?: string;
  } = {}
): TemplateVariablesContext {
  const baseUrl = getPlatformBaseUrl();
  const vehicleStr =
    data.vehicle != null
      ? `${data.vehicle.brand} ${data.vehicle.model} ${data.vehicle.year}`
      : undefined;

  return {
    nome_usuario: data.userName ?? "",
    nome_cliente: data.clientName ?? "",
    veiculo: vehicleStr ?? "",
    estado_checklist:
      data.checklistStatus != null
        ? checklistStatusLabel(data.checklistStatus)
        : "",
    data_vencimento: formatDateBR(data.expirationDate),
    link_plataforma: baseUrl,
    link_planos: `${baseUrl}/planos`,
    /** Mesmo que link_reset_senha: link com token para criar nova senha (não aponta para /forgot-password). */
    link_recuperar_senha: data.resetPasswordLink ?? "",
    link_reset_senha: data.resetPasswordLink ?? "",
    nome_plano: data.planName ?? "",
    nome_oferta: data.offerName ?? "",
    status_usuario:
      data.accountStatus != null
        ? accountStatusLabel(data.accountStatus)
        : "",
  };
}

/**
 * Substitui {{var}} no texto pelo valor do contexto.
 */
export function replaceTemplateVariables(
  text: string,
  context: TemplateVariablesContext
): string {
  let result = text;
  const keys: (keyof TemplateVariablesContext)[] = [
    "nome_usuario",
    "nome_cliente",
    "veiculo",
    "estado_checklist",
    "data_vencimento",
    "link_plataforma",
    "link_planos",
    "link_recuperar_senha",
    "link_reset_senha",
    "nome_plano",
    "nome_oferta",
    "status_usuario",
  ];
  for (const key of keys) {
    const value = context[key] ?? "";
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, String(value));
  }
  return result;
}
