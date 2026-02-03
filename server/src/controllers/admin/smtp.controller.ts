import { Response, NextFunction } from 'express';
import { encrypt } from '../../utils/encrypt.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';
import { createAuditLog, getAuditContextFromRequest } from '../../utils/audit.js';
import { clearEmailCache, sendEmail } from '../../services/email.service.js';

/** Get SMTP config (first active or first ever). */
export async function getSmtpConfig(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const config = await prisma.smtpConfig.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        host: true,
        port: true,
        secure: true,
        user: true,
        fromEmail: true,
        fromName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ success: true, data: config });
  } catch (e) {
    next(e);
  }
}

/** Create or update SMTP config (admin). */
export async function upsertSmtpConfig(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as {
      host: string;
      port?: number;
      secure?: boolean;
      user?: string;
      password?: string;
      fromEmail: string;
      fromName?: string;
      active?: boolean;
    };
    if (!body.host || !body.fromEmail) {
      res.status(400).json({ success: false, error: { message: 'Host e fromEmail são obrigatórios' } });
      return;
    }
    const existing = await prisma.smtpConfig.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const passEncrypted = body.password ? encrypt(body.password) : undefined;
    const baseData = {
      host: body.host,
      port: body.port ?? 587,
      secure: body.secure ?? false,
      user: body.user ?? null,
      fromEmail: body.fromEmail,
      fromName: body.fromName ?? null,
      active: body.active ?? true,
    };
    type ConfigSelect = { id: string; host: string; port: number; secure: boolean; user: string | null; fromEmail: string; fromName: string | null; active: boolean; createdAt: Date; updatedAt: Date };
    let config: ConfigSelect;
    if (existing) {
      config = await prisma.smtpConfig.update({
        where: { id: existing.id },
        data: { ...baseData, ...(passEncrypted !== undefined && { passEncrypted }) },
        select: {
          id: true,
          host: true,
          port: true,
          secure: true,
          user: true,
          fromEmail: true,
          fromName: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      }) as ConfigSelect;
    } else {
      config = await prisma.smtpConfig.create({
        data: { ...baseData, passEncrypted: passEncrypted ?? null },
        select: {
          id: true,
          host: true,
          port: true,
          secure: true,
          user: true,
          fromEmail: true,
          fromName: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      }) as ConfigSelect;
    }
    const smtpDesc = existing
      ? `Configuração SMTP alterada (host: ${config.host}, from: ${config.fromEmail})`
      : `Configuração SMTP criada (host: ${config.host}, from: ${config.fromEmail})`;
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: existing ? 'update' : 'create',
      entity: 'SmtpConfig',
      entityId: config.id,
      payload: {
        description: smtpDesc,
        summary: existing ? 'Configuração SMTP alterada' : 'Configuração SMTP criada',
        host: config.host,
        fromEmail: config.fromEmail,
      },
    });
    clearEmailCache();
    res.json({ success: true, data: config });
  } catch (e) {
    next(e);
  }
}

/** GET /api/admin/smtp/logs – Histórico de e-mails enviados. */
export async function listEmailLogs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || 100), 10) || 100, 500);
    const offset = Math.max(0, parseInt(String(req.query.offset || 0), 10));
    const logs = await prisma.emailLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        to: true,
        subject: true,
        status: true,
        errorMessage: true,
        origin: true,
        templateId: true,
        sentAt: true,
      },
    });
    res.json({ success: true, data: logs });
  } catch (e) {
    next(e);
  }
}

/** Test SMTP config: send a test email to the provided address. */
export async function testSmtpConfig(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as { email?: string };
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!email || !email.includes('@')) {
      res.status(400).json({
        success: false,
        error: { message: 'Informe um e-mail válido para o teste' },
      });
      return;
    }

    const subject = 'Teste SMTP - DescompliCAR';
    const text =
      'Este é um e-mail de teste. Se você recebeu esta mensagem, a configuração SMTP está funcionando corretamente.';

    const result = await sendEmail(email, subject, text);

    await prisma.emailLog.create({
      data: {
        to: email,
        subject,
        status: result.sent ? 'success' : 'error',
        errorMessage: result.error ?? null,
        origin: 'smtp_test',
      },
    });

    if (result.sent) {
      console.log(`[smtp/test] E-mail de teste enviado para ${email}`);
      res.json({
        success: true,
        data: { message: `E-mail de teste enviado para ${email}. Verifique a caixa de entrada e o spam.` },
      });
    } else {
      console.warn('[smtp/test] Falha ao enviar (verifique host, porta, usuário e senha)');
      res.status(200).json({
        success: false,
        error: {
          message:
            result.error ?? 'Falha ao enviar o e-mail. Verifique host, porta, usuário e senha na configuração SMTP.',
        },
      });
    }
  } catch (e) {
    next(e);
  }
}
