import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from './prisma.service.js';
import { decrypt } from '../utils/encrypt.js';

type Cached = { transporter: Transporter; from: string };

let cached: Cached | null = null;

/** Limpa o cache (chamar após atualizar config SMTP). */
export function clearEmailCache(): void {
  cached = null;
}

async function getTransporterAndFrom(): Promise<Cached | null> {
  if (cached) return cached;
  const config = await prisma.smtpConfig.findFirst({
    where: { deletedAt: null, active: true },
    orderBy: { createdAt: 'desc' },
    select: {
      host: true,
      port: true,
      secure: true,
      user: true,
      passEncrypted: true,
      fromEmail: true,
      fromName: true,
    },
  });
  if (!config) return null;
  const pass =
    config.passEncrypted && !config.passEncrypted.startsWith('$2')
      ? decrypt(config.passEncrypted)
      : process.env.SMTP_PASSWORD ?? '';
  if (config.user && !pass) return null;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user && pass
        ? { user: config.user, pass }
        : undefined,
  });
  const from = config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;
  cached = { transporter, from };
  return cached;
}

/** Verifica se há config para envio (senha no banco ou SMTP_PASSWORD no .env). */
export function isEmailConfigured(): boolean {
  return true;
}

export type SendEmailResult = { sent: boolean; error?: string };

/** Sends one email. Returns { sent, error? } for logging. */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<SendEmailResult> {
  const c = await getTransporterAndFrom();
  if (!c) return { sent: false, error: 'SMTP não configurado ou inativo' };
  try {
    await c.transporter.sendMail({
      from: c.from,
      to,
      subject,
      text,
      ...(html && { html }),
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { sent: false, error: message };
  }
}
