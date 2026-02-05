/**
 * Formatação de datas no fuso Brasil (America/Sao_Paulo, GMT-3).
 * Todas as datas exibidas na plataforma devem usar estas funções para consistência.
 */

const TZ_BR = 'America/Sao_Paulo';

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** Data no formato dd/MM/yyyy (Brasil) */
export function formatDateBR(value: Date | string): string {
  const d = toDate(value);
  return d.toLocaleDateString('pt-BR', { timeZone: TZ_BR });
}

/** Data e hora no formato dd/MM/yyyy HH:mm (Brasil) */
export function formatDateTimeBR(value: Date | string): string {
  const d = toDate(value);
  return d.toLocaleString('pt-BR', {
    timeZone: TZ_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Data e hora completa (Brasil) */
export function formatDateTimeFullBR(value: Date | string): string {
  const d = toDate(value);
  return d.toLocaleString('pt-BR', {
    timeZone: TZ_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Retorna a data “hoje” no fuso Brasil como string YYYY-MM-DD (para uso em date inputs) */
export function todayBR(): string {
  const d = new Date();
  const br = new Date(d.toLocaleString('en-US', { timeZone: TZ_BR }));
  const y = br.getFullYear();
  const m = String(br.getMonth() + 1).padStart(2, '0');
  const day = String(br.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
