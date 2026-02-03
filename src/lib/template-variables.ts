/**
 * Variáveis disponíveis para uso em templates de notificação (PWA, e-mail).
 * Use a sintaxe {{nome_variavel}} no corpo, título ou assunto do template.
 *
 * Dependências: app-config (apenas no frontend para exibição).
 */

export const TEMPLATE_VARIABLES = [
  {
    key: "nome_usuario",
    label: "Nome do Usuário",
    description: "Nome do usuário (responsável pela conta)",
    example: "João Silva",
  },
  {
    key: "nome_cliente",
    label: "Nome do Cliente",
    description: "Nome do cliente (em contexto de venda/veículo)",
    example: "Maria Santos",
  },
  {
    key: "veiculo",
    label: "Veículo",
    description: "Descrição do veículo (marca, modelo, ano)",
    example: "Toyota Corolla 2023",
  },
  {
    key: "estado_checklist",
    label: "Estado do Veículo no Checklist",
    description: "Status do checklist (pendente, em andamento, concluído)",
    example: "Concluído",
  },
  {
    key: "data_vencimento",
    label: "Data de Vencimento",
    description: "Data de vencimento da assinatura ou trial",
    example: "15/03/2025",
  },
  {
    key: "link_plataforma",
    label: "Link da Plataforma",
    description: "URL base da plataforma",
    example: "https://app.exemplo.com",
  },
  {
    key: "link_planos",
    label: "Link Página de Planos",
    description: "URL da página de planos (plataforma/planos)",
    example: "https://app.exemplo.com/planos",
  },
  {
    key: "link_recuperar_senha",
    label: "Link para Recuperar Senha",
    description: "URL da página para solicitar recuperação (forgot-password)",
    example: "https://app.exemplo.com/forgot-password",
  },
  {
    key: "link_reset_senha",
    label: "Link de Redefinição (com token)",
    description: "Link único com token para redefinir senha (apenas em recuperação de senha)",
    example: "https://app.exemplo.com/reset-password?token=xxx",
  },
  {
    key: "nome_plano",
    label: "Nome do Plano",
    description: "Nome do plano de assinatura",
    example: "Plano Profissional",
  },
  {
    key: "nome_oferta",
    label: "Nome da Oferta",
    description: "Nome da oferta ou promoção",
    example: "Black Friday 2025",
  },
  {
    key: "status_usuario",
    label: "Status do Usuário",
    description: "Status da conta (ativo, trial, vencido, cancelado)",
    example: "Ativo",
  },
] as const;

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLES)[number]["key"];

export function getVariablePlaceholder(key: string): string {
  return `{{${key}}}`;
}

export function getVariablesPlaceholdersList(): string[] {
  return TEMPLATE_VARIABLES.map((v) => getVariablePlaceholder(v.key));
}
