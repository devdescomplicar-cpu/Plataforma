/**
 * Parse recurrence/offer data from external platforms.
 * Accepts string, object (interval/interval_count, billing_period, etc.) or raw JSON.
 * Returns normalized period and multiplier for due-date calculation.
 *
 * Reusable across the system (webhooks, subscriptions, etc.).
 */

export type RecurrencePeriod = 'day' | 'week' | 'month' | 'year';

export interface ParsedRecurrence {
  period: RecurrencePeriod;
  multiplier: number;
}

const DAYS_PER_PERIOD: Record<RecurrencePeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

/** Returns days for one unit of the given period (e.g. month → 30). */
export function getDaysPerPeriod(period: RecurrencePeriod): number {
  return DAYS_PER_PERIOD[period];
}

/**
 * Extracts a number from text using regex (first integer or decimal).
 */
function extractNumberFromText(text: string): number | null {
  const match = String(text).match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * Detects period from Portuguese/English keywords and optional number.
 * Returns period and suggested multiplier (e.g. "trimestral" → month, 3).
 */
function detectPeriodFromKeywords(text: string): { period: RecurrencePeriod; multiplier: number } | null {
  const lower = text.trim().toLowerCase();
  if (!lower) return null;

  // Portuguese
  if (/\b(mensal|m[eê]s|por m[eê]s|1 m[eê]s)\b/.test(lower)) return { period: 'month', multiplier: 1 };
  if (/\b(trimestral|trimestre|3 meses)\b/.test(lower)) return { period: 'month', multiplier: 3 };
  if (/\b(semestral|semestre|6 meses)\b/.test(lower)) return { period: 'month', multiplier: 6 };
  if (/\b(anual|ano|anos?)\b/.test(lower)) return { period: 'year', multiplier: 1 };
  if (/\b(12 meses)\b/.test(lower)) return { period: 'month', multiplier: 12 };
  if (/\b(semanal|semana)\b/.test(lower)) return { period: 'week', multiplier: 1 };
  if (/\b(di[aá]rio|dia)\b/.test(lower)) return { period: 'day', multiplier: 1 };

  // English
  if (/\b(monthly|month)\b/.test(lower)) return { period: 'month', multiplier: 1 };
  if (/\b(quarterly|quarter)\b/.test(lower)) return { period: 'month', multiplier: 3 };
  if (/\b(semiannual|biannual|semi-annual|bi-annual)\b/.test(lower)) return { period: 'month', multiplier: 6 };
  if (/\b(yearly|annual|years?)\b/.test(lower)) return { period: 'year', multiplier: 1 };
  if (/\b(weekly|week)\b/.test(lower)) return { period: 'week', multiplier: 1 };
  if (/\b(daily|day)\b/.test(lower)) return { period: 'day', multiplier: 1 };

  // "N months" / "N meses"
  const monthsMatch = lower.match(/(\d+)\s*(meses?|months?)/);
  if (monthsMatch) {
    const n = Number.parseInt(monthsMatch[1], 10);
    if (n >= 1 && n <= 12) return { period: 'month', multiplier: n };
  }

  return null;
}

/**
 * Parses ISO 8601 duration (e.g. P1M, P3M, P1Y, P1W, P7D).
 */
function parseIso8601Duration(str: string): ParsedRecurrence | null {
  const s = String(str).trim().toUpperCase();
  const match = s.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/);
  if (!match) return null;

  const [, y, m, w, d] = match;
  if (y && Number(y) > 0) return { period: 'year', multiplier: Number(y) };
  if (m && Number(m) > 0) return { period: 'month', multiplier: Number(m) };
  if (w && Number(w) > 0) return { period: 'week', multiplier: Number(w) };
  if (d && Number(d) > 0) return { period: 'day', multiplier: Number(d) };
  return null;
}

/**
 * Parses recurrence from an object (e.g. { interval: "month", interval_count: 3 }).
 */
function parseFromObject(obj: Record<string, unknown>): ParsedRecurrence | null {
  const interval = (obj.interval ?? obj.frequency ?? obj.period ?? '') as string;
  const count = obj.interval_count ?? obj.intervalCount ?? obj.count ?? obj.multiplier;
  const countNum =
    typeof count === 'number' ? count : typeof count === 'string' ? Number.parseInt(count, 10) : 1;
  const multiplier = Number.isNaN(countNum) || countNum < 1 ? 1 : countNum;

  const intervalLower = String(interval).trim().toLowerCase();
  if (intervalLower.includes('day') || intervalLower === 'd') return { period: 'day', multiplier };
  if (intervalLower.includes('week') || intervalLower === 'w') return { period: 'week', multiplier };
  if (intervalLower.includes('month') || intervalLower === 'm') return { period: 'month', multiplier };
  if (intervalLower.includes('year') || intervalLower === 'y' || intervalLower.includes('annual')) return { period: 'year', multiplier };

  const billingPeriod = (obj.billing_period ?? obj.billingPeriod) as string | undefined;
  if (billingPeriod) return parseIso8601Duration(billingPeriod);

  const recurrence = (obj.recurrence ?? obj.recurrence_type) as string | undefined;
  if (recurrence) return parseRecurrence(recurrence);

  return null;
}

/**
 * Main entry: parse recurrence from JSON data (string or object).
 * Fallback: extract number + keywords, then assume monthly (1).
 *
 * @param jsonData - Mapped value from webhook (string like "trimestral", "3 months", "P3M") or object with interval/interval_count, billing_period, etc.
 * @returns Normalized { period, multiplier } for due-date calculation.
 */
export function parseRecurrence(
  jsonData: string | Record<string, unknown> | null | undefined
): ParsedRecurrence {
  const defaultResult: ParsedRecurrence = { period: 'month', multiplier: 1 };

  if (jsonData == null) return defaultResult;

  if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
    const fromObj = parseFromObject(jsonData as Record<string, unknown>);
    if (fromObj) return fromObj;
    return defaultResult;
  }

  const str = String(jsonData).trim();
  if (!str) return defaultResult;

  // ISO 8601 duration
  const fromIso = parseIso8601Duration(str);
  if (fromIso) return fromIso;

  // Keywords (PT/EN)
  const fromKeywords = detectPeriodFromKeywords(str);
  if (fromKeywords) return fromKeywords;

  // Fallback: extract number + period keyword
  const num = extractNumberFromText(str);
  const keywordResult = detectPeriodFromKeywords(str);
  if (keywordResult) {
    const multiplier = num != null && num >= 1 ? num : keywordResult.multiplier;
    return { period: keywordResult.period, multiplier };
  }
  if (num != null && num >= 1) return { period: 'month', multiplier: num };

  return defaultResult;
}

/**
 * Calculates total days from parsed recurrence and quantity.
 * Formula: (days per period × multiplier) × quantity.
 * Example: period month, multiplier 3, quantity 2 → 30×3×2 = 180 days.
 */
export function recurrenceToDays(
  parsed: ParsedRecurrence,
  quantity: number = 1
): number {
  const q = quantity >= 1 ? quantity : 1;
  return getDaysPerPeriod(parsed.period) * parsed.multiplier * q;
}
