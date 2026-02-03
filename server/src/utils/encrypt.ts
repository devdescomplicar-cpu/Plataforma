/**
 * Criptografia reversível para dados sensíveis (ex: senha SMTP).
 * Usa AES-256-GCM. Chave derivada de JWT_SECRET ou ENCRYPTION_KEY.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;

function getKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ??
    process.env.JWT_SECRET ??
    'default-encryption-key-change-in-production';
  return createHash('sha256').update(secret).digest();
}

/**
 * Criptografa um texto. Retorna string base64 (iv + authTag + ciphertext).
 */
export function encrypt(plain: string): string {
  if (!plain) return '';
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString('base64');
}

/**
 * Descriptografa um texto. Retorna string vazia se inválido.
 */
export function decrypt(encoded: string): string {
  if (!encoded || encoded.length < 32) return '';
  try {
    const buf = Buffer.from(encoded, 'base64');
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return '';
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const key = getKey();
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch {
    return '';
  }
}
