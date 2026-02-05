/**
 * Fuso horário Brasil (São Paulo) - America/Sao_Paulo, UTC-3.
 * Todas as datas/horários da plataforma são interpretados neste fuso.
 */

const BRAZIL_UTC_OFFSET_HOURS = 3; // Brasil = UTC-3 → 00:00 BRT = 03:00 UTC
const MS_PER_HOUR = 60 * 60 * 1000;

/** Retorna os componentes de data (ano, mês, dia) no fuso Brasil para um instante UTC. */
export function getBrazilDateParts(utcDate: Date = new Date()): { year: number; month: number; day: number } {
  const brazilTime = new Date(utcDate.getTime() - BRAZIL_UTC_OFFSET_HOURS * MS_PER_HOUR);
  return {
    year: brazilTime.getUTCFullYear(),
    month: brazilTime.getUTCMonth() + 1,
    day: brazilTime.getUTCDate(),
  };
}

/** Último dia do mês (1-31). month em 1-12. */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Instante UTC que representa 00:00:00.000 do dia dado no fuso Brasil. month 1-12, day 1-31. */
export function startOfDayBrazil(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, BRAZIL_UTC_OFFSET_HOURS, 0, 0, 0));
}

/** Instante UTC que representa 23:59:59.999 do dia dado no fuso Brasil. month 1-12, day 1-31. */
export function endOfDayBrazil(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 23 + BRAZIL_UTC_OFFSET_HOURS, 59, 59, 999));
}

/**
 * Interpreta uma string de data (YYYY-MM-DD ou ISO) como um dia no Brasil
 * e retorna o instante UTC do início desse dia em Brasil (00:00:00.000 BRT).
 * Usado ao salvar saleDate e ao filtrar por data.
 */
export function parseDateStringAsBrazilDay(dateStr: string): Date {
  const only = dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr;
  const [y, m, d] = only.split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return startOfDayBrazil(y, m, d);
}

/**
 * Retorna o intervalo UTC do primeiro ao último segundo do mês no fuso Brasil.
 * month 1-12.
 */
export function getBrazilMonthRange(year: number, month: number): { start: Date; end: Date } {
  const lastDay = getLastDayOfMonth(year, month);
  return {
    start: startOfDayBrazil(year, month, 1),
    end: endOfDayBrazil(year, month, lastDay),
  };
}

/** "Agora" em Brasil: retorna um Date cujos componentes de data (em Brasil) podem ser usados. */
export function nowInBrazil(): Date {
  return new Date();
}

/**
 * Calcula a diferença em dias entre duas datas, considerando apenas a data (dia/mês/ano),
 * ignorando horas/minutos/segundos. Usa o fuso horário do Brasil.
 * Retorna o número de dias completos entre as datas.
 */
export function daysDifferenceBrazil(date1: Date, date2: Date = new Date()): number {
  const br1 = getBrazilDateParts(date1);
  const br2 = getBrazilDateParts(date2);
  
  // Criar datas no início do dia (00:00:00) no fuso Brasil
  const start1 = startOfDayBrazil(br1.year, br1.month, br1.day);
  const start2 = startOfDayBrazil(br2.year, br2.month, br2.day);
  
  // Calcular diferença em milissegundos e converter para dias
  const diffMs = start2.getTime() - start1.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}