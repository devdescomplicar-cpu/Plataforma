/**
 * CPF/CNPJ formatting and validation (frontend).
 * Backend stores only digits; format for display.
 */

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function allSameDigit(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCPF(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (allSameDigit(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== Number(digits[10])) return false;
  return true;
}

const CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function isValidCNPJ(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (allSameDigit(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * CNPJ_W1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (d1 !== Number(digits[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(digits[i]) * CNPJ_W2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  if (d2 !== Number(digits[13])) return false;
  return true;
}

/** Validates CPF or CNPJ (11 or 14 digits). Empty is valid (optional). */
export function validateCpfCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length === 0) return true;
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

/** Format for display: CPF 000.000.000-00, CNPJ 00.000.000/0001-00 */
export function formatCpfCnpj(digits: string | null | undefined): string {
  if (!digits || digits.length === 0) return '—';
  const d = onlyDigits(digits);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return digits;
}

/** Normalize input to digits only (for sending to API). */
export function normalizeCpfCnpj(value: string): string {
  return onlyDigits(value);
}
