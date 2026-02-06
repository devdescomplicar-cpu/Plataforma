/**
 * Calcula o intervalo de datas (início e fim do dia) no fuso Brasil (America/Sao_Paulo, GMT-3).
 * Garante consistência de datas e valores em toda a plataforma.
 *
 * - Para período custom: startDate/endDate como string (YYYY-MM-DD ou ISO).
 *   start/end = início e fim do dia no horário de São Paulo.
 * - Para períodos predefinidos: usa a data atual no fuso Brasil e calcula start/end.
 */
import {
  getBrazilDateParts,
  getLastDayOfMonth,
  startOfDayBrazil,
  endOfDayBrazil,
  parseDateStringAsBrazilDay,
} from './timezone.js';

function parseYMD(dateStr: string): { y: number; m: number; d: number } {
  const only = dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr;
  const [y, m, d] = only.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

export function getDateRange(
  period?: string,
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } {
  if (startDate && endDate) {
    const startYMD = parseYMD(startDate);
    const endYMD = parseYMD(endDate);
    return {
      start: startOfDayBrazil(startYMD.y, startYMD.m, startYMD.d),
      end: endOfDayBrazil(endYMD.y, endYMD.m, endYMD.d),
    };
  }

  const now = new Date();
  const br = getBrazilDateParts(now);
  const y = br.year;
  const m = br.month;
  const d = br.day;

  let start: Date;
  let end: Date;

  switch (period) {
    case 'current-month':
      start = startOfDayBrazil(y, m, 1);
      end = endOfDayBrazil(y, m, d);
      break;
    case 'last-month': {
      const lastMonth = m === 1 ? 12 : m - 1;
      const lastMonthYear = m === 1 ? y - 1 : y;
      const lastDay = getLastDayOfMonth(lastMonthYear, lastMonth);
      start = startOfDayBrazil(lastMonthYear, lastMonth, 1);
      end = endOfDayBrazil(lastMonthYear, lastMonth, lastDay);
      break;
    }
    case '3m': {
      // Últimos 3 meses incluindo o mês atual (mês atual + 2 meses anteriores)
      let startM = m - 2;
      let startY = y;
      if (startM < 1) {
        startM += 12;
        startY -= 1;
      }
      start = startOfDayBrazil(startY, startM, 1);
      end = endOfDayBrazil(y, m, d);
      break;
    }
    case '6m': {
      // Últimos 6 meses incluindo o mês atual (mês atual + 5 meses anteriores)
      let startM6 = m - 5;
      let startY6 = y;
      if (startM6 < 1) {
        startM6 += 12;
        startY6 -= 1;
      }
      start = startOfDayBrazil(startY6, startM6, 1);
      end = endOfDayBrazil(y, m, d);
      break;
    }
    case '12m': {
      // Últimos 12 meses incluindo o mês atual (mês atual + 11 meses anteriores)
      let startM12 = m - 11;
      let startY12 = y;
      if (startM12 < 1) {
        startM12 += 12;
        startY12 -= 1;
      }
      start = startOfDayBrazil(startY12, startM12, 1);
      end = endOfDayBrazil(y, m, d);
      break;
    }
    default:
      start = startOfDayBrazil(y, m, 1);
      end = endOfDayBrazil(y, m, d);
  }
  return { start, end };
}
