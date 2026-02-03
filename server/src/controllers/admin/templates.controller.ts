import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';
import { createAuditLog, getAuditContextFromRequest, type AuditChangeItem } from '../../utils/audit.js';
import { sendEmail } from '../../services/email.service.js';
import { getFrontendUrl } from '../../utils/frontend-url.js';
import {
  buildTemplateContext,
  replaceTemplateVariables,
} from '../../utils/template-variables.js';

const TRIGGERS = [
  'welcome',
  'subscription_expiring',
  'subscription_expired',
  'password_recovery',
  'non_renewal_warning',
] as const;
const CHANNELS = ['pwa', 'email'] as const;

type Trigger = (typeof TRIGGERS)[number];
type Channel = (typeof CHANNELS)[number];

function parseBody(
  body: Record<string, unknown>
): {
  name?: string | null;
  trigger: Trigger;
  channel: Channel;
  daysOffset: number | null;
  subject?: string | null;
  title?: string | null;
  body: string;
  active?: boolean;
} | null {
  const trigger = body.trigger as string;
  const channel = body.channel as string;
  if (!TRIGGERS.includes(trigger as Trigger) || !CHANNELS.includes(channel as Channel)) return null;
  const bodyStr = typeof body.body === 'string' ? body.body.trim() : '';
  if (!bodyStr) return null;
  let daysOffset: number | null = null;
  if (
    trigger === 'subscription_expiring' ||
    trigger === 'subscription_expired' ||
    trigger === 'non_renewal_warning'
  ) {
    const n = body.daysOffset;
    if (n === undefined || n === null) return null;
    const d = Number(n);
    if (!Number.isInteger(d)) return null;
    if (trigger === 'subscription_expiring' && d < 1) return null;
    if ((trigger === 'subscription_expired' || trigger === 'non_renewal_warning') && d < 0)
      return null;
    daysOffset = d;
  }
  return {
    name: typeof body.name === 'string' ? body.name.trim() || null : undefined,
    trigger: trigger as Trigger,
    channel: channel as Channel,
    daysOffset,
    subject: typeof body.subject === 'string' ? body.subject.trim() || null : undefined,
    title: typeof body.title === 'string' ? body.title.trim() || null : undefined,
    body: bodyStr,
    active: body.active === undefined ? undefined : Boolean(body.active),
  };
}

/** List notification templates (admin). */
export async function listTemplates(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const trigger = req.query.trigger as string | undefined;
    const channel = req.query.channel as string | undefined;
    const where: { deletedAt: null; trigger?: string; channel?: string } = { deletedAt: null };
    if (trigger && TRIGGERS.includes(trigger as Trigger)) where.trigger = trigger;
    if (channel && CHANNELS.includes(channel as Channel)) where.channel = channel;
    const templates = await prisma.notificationTemplate.findMany({
      where,
      orderBy: [{ trigger: 'asc' }, { channel: 'asc' }, { daysOffset: 'asc' }],
      select: {
        id: true,
        name: true,
        trigger: true,
        channel: true,
        daysOffset: true,
        subject: true,
        title: true,
        body: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ success: true, data: templates });
  } catch (e) {
    next(e);
  }
}

/** Get template by id (admin). */
export async function getTemplateById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const template = await prisma.notificationTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!template) {
      res.status(404).json({ success: false, error: { message: 'Template não encontrado' } });
      return;
    }
    res.json({ success: true, data: template });
  } catch (e) {
    next(e);
  }
}

/** Create notification template (admin). */
export async function createTemplate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = parseBody(req.body as Record<string, unknown>);
    if (!parsed) {
      res.status(400).json({
        success: false,
        error: {
          message:
            'Dados inválidos: trigger (welcome|subscription_expiring|subscription_expired|password_recovery|non_renewal_warning), channel (pwa|email), body obrigatório. Para expiring/expired/non_renewal_warning informe daysOffset.',
        },
      });
      return;
    }
    if (parsed.channel === 'pwa' && !parsed.title) {
      res.status(400).json({ success: false, error: { message: 'Para canal PWA o título é obrigatório' } });
      return;
    }
    if (parsed.channel === 'email' && !parsed.subject) {
      res.status(400).json({ success: false, error: { message: 'Para canal e-mail o assunto é obrigatório' } });
      return;
    }
    const template = await prisma.notificationTemplate.create({
      data: {
        name: parsed.name ?? null,
        trigger: parsed.trigger,
        channel: parsed.channel,
        daysOffset: parsed.daysOffset,
        subject: parsed.subject ?? null,
        title: parsed.title ?? null,
        body: parsed.body,
        active: parsed.active ?? true,
      },
    });
    const triggerLabel = template.trigger === 'welcome' ? 'bem-vindo' : template.trigger === 'subscription_expiring' ? 'assinatura a vencer' : template.trigger === 'subscription_expired' ? 'assinatura vencida' : template.trigger;
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'create',
      entity: 'NotificationTemplate',
      entityId: template.id,
      payload: {
        description: `Template de notificação (${triggerLabel}, ${template.channel}) criado`,
        trigger: template.trigger,
        channel: template.channel,
        daysOffset: template.daysOffset,
      },
    });
    res.status(201).json({ success: true, data: template });
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002'
      ? 'Já existe um template com este gatilho, canal e dias.'
      : undefined;
    if (msg) {
      res.status(409).json({ success: false, error: { message: msg } });
      return;
    }
    next(e);
  }
}

/** Update notification template (admin). */
export async function updateTemplate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.notificationTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Template não encontrado' } });
      return;
    }
    const parsed = parseBody(req.body as Record<string, unknown>);
    if (!parsed) {
      res.status(400).json({
        success: false,
        error: { message: 'Dados inválidos. Verifique trigger, channel, body e daysOffset quando aplicável.' },
      });
      return;
    }
    if (parsed.channel === 'pwa' && !parsed.title) {
      res.status(400).json({ success: false, error: { message: 'Para canal PWA o título é obrigatório' } });
      return;
    }
    if (parsed.channel === 'email' && !parsed.subject) {
      res.status(400).json({ success: false, error: { message: 'Para canal e-mail o assunto é obrigatório' } });
      return;
    }
    const template = await prisma.notificationTemplate.update({
      where: { id },
      data: {
        name: parsed.name ?? null,
        trigger: parsed.trigger,
        channel: parsed.channel,
        daysOffset: parsed.daysOffset,
        subject: parsed.subject ?? null,
        title: parsed.title ?? null,
        body: parsed.body,
        ...(parsed.active !== undefined && { active: parsed.active }),
        updatedAt: new Date(),
      },
    });
    const templateChanges: AuditChangeItem[] = [];
    if (parsed.trigger !== existing.trigger) {
      templateChanges.push({ field: 'trigger', label: 'Gatilho', oldValue: existing.trigger, newValue: parsed.trigger });
    }
    if (parsed.channel !== existing.channel) {
      templateChanges.push({ field: 'channel', label: 'Canal', oldValue: existing.channel, newValue: parsed.channel });
    }
    if (parsed.daysOffset !== existing.daysOffset) {
      templateChanges.push({ field: 'daysOffset', label: 'Dias (offset)', oldValue: existing.daysOffset, newValue: parsed.daysOffset });
    }
    if ((parsed.subject ?? null) !== (existing.subject ?? null)) {
      templateChanges.push({ field: 'subject', label: 'Assunto', oldValue: existing.subject ?? null, newValue: parsed.subject ?? null });
    }
    if ((parsed.title ?? null) !== (existing.title ?? null)) {
      templateChanges.push({ field: 'title', label: 'Título', oldValue: existing.title ?? null, newValue: parsed.title ?? null });
    }
    if (parsed.active !== undefined && parsed.active !== existing.active) {
      templateChanges.push({ field: 'active', label: 'Ativo', oldValue: existing.active, newValue: parsed.active });
    }
    const triggerLabel = template.trigger === 'welcome' ? 'bem-vindo' : template.trigger === 'subscription_expiring' ? 'assinatura a vencer' : template.trigger === 'subscription_expired' ? 'assinatura vencida' : template.trigger;
    const templateDesc = templateChanges.length
      ? `Template de notificação (${triggerLabel}, ${template.channel}): ${templateChanges.map((c) => c.label).join(', ')} alterados`
      : `Template de notificação (${triggerLabel}, ${template.channel}) atualizado`;
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'update',
      entity: 'NotificationTemplate',
      entityId: template.id,
      payload: {
        description: templateDesc,
        summary: templateChanges.length ? `Alterado(s): ${templateChanges.map((c) => c.label).join(', ')}` : 'Template atualizado',
        changes: templateChanges.length ? templateChanges : undefined,
      },
    });
    res.json({ success: true, data: template });
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002'
      ? 'Já existe um template com este gatilho, canal e dias.'
      : undefined;
    if (msg) {
      res.status(409).json({ success: false, error: { message: msg } });
      return;
    }
    next(e);
  }
}

/** Soft delete notification template (admin). */
export async function softDeleteTemplate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.notificationTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Template não encontrado' } });
      return;
    }
    const now = new Date();
    await prisma.notificationTemplate.update({
      where: { id },
      data: { deletedAt: now, updatedAt: now },
    });
    const triggerLabel = existing.trigger === 'welcome' ? 'bem-vindo' : existing.trigger === 'subscription_expiring' ? 'assinatura a vencer' : existing.trigger === 'subscription_expired' ? 'assinatura vencida' : existing.trigger;
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'delete',
      entity: 'NotificationTemplate',
      entityId: id,
      payload: {
        description: `Template de notificação (${triggerLabel}, ${existing.channel}) excluído`,
        entityName: existing.name ?? `${existing.trigger}/${existing.channel}`,
      },
    });
    res.json({ success: true, data: { id } });
  } catch (e) {
    next(e);
  }
}

/** GET /api/admin/templates/usage – Histórico de gatilhos utilizados. */
export async function listTemplateUsageLog(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || 100), 10) || 100, 500);
    const offset = Math.max(0, parseInt(String(req.query.offset || 0), 10));
    const logs = await prisma.notificationTemplateUsageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        template: { select: { id: true, name: true, trigger: true, channel: true } },
      },
    });
    const data = logs.map((log) => ({
      id: log.id,
      templateId: log.templateId,
      templateName: log.template.name ?? `${log.template.trigger}/${log.template.channel}`,
      trigger: log.trigger,
      channel: log.channel,
      recipientInfo: log.recipientInfo,
      success: log.success,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt,
    }));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET ?? 'secret';

/** Test template: send to a selected user with real data (admin). */
export async function testTemplate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as { userId?: string };
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'Selecione um usuário para o teste' },
      });
      return;
    }

    const template = await prisma.notificationTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!template) {
      res.status(404).json({ success: false, error: { message: 'Template não encontrado' } });
      return;
    }

    if (template.channel !== 'email') {
      res.status(400).json({
        success: false,
        error: { message: 'Teste disponível apenas para templates de e-mail' },
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        accounts: {
          where: { deletedAt: null },
          take: 1,
          select: {
            status: true,
            trialEndsAt: true,
            subscriptions: {
              where: { deletedAt: null },
              orderBy: { startDate: 'desc' },
              take: 1,
              select: {
                endDate: true,
                plan: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Usuário não encontrado' } });
      return;
    }
    if (!user.email) {
      res.status(400).json({
        success: false,
        error: { message: 'Usuário não possui e-mail cadastrado' },
      });
      return;
    }

    const account = user.accounts[0];
    const subscription = account?.subscriptions[0];
    const plan = subscription?.plan;
    const expirationDate =
      account?.trialEndsAt ?? subscription?.endDate ?? null;

    /** Link com token para redefinir senha: mesmo valor para {{link_recuperar_senha}} e {{link_reset_senha}}. */
    const payload = { userId: user.id, purpose: 'password_reset' as const };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const resetPasswordLink = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    const ctx = buildTemplateContext({
      userName: user.name,
      expirationDate,
      planName: plan?.name,
      accountStatus: account?.status,
      resetPasswordLink,
    });

    const subject = replaceTemplateVariables(template.subject ?? '', ctx);
    const emailBody = replaceTemplateVariables(template.body, ctx);

    const isHtml = emailBody.includes('<') && emailBody.includes('>');
    const textFallback = isHtml
      ? emailBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : emailBody;

    const result = await sendEmail(
      user.email,
      subject,
      textFallback,
      isHtml ? emailBody : undefined
    );

    await prisma.emailLog.create({
      data: {
        to: user.email,
        subject,
        status: result.sent ? 'success' : 'error',
        errorMessage: result.error ?? null,
        origin: 'template_test',
        templateId: template.id,
      },
    });

    await prisma.notificationTemplateUsageLog.create({
      data: {
        templateId: template.id,
        trigger: template.trigger,
        channel: template.channel,
        recipientInfo: `${user.name} <${user.email}>`,
        success: result.sent,
        errorMessage: result.error ?? null,
      },
    });

    const triggerLabel =
      template.trigger === 'welcome'
        ? 'bem-vindo'
        : template.trigger === 'subscription_expiring'
          ? 'assinatura a vencer'
          : template.trigger === 'subscription_expired'
            ? 'assinatura vencida'
            : template.trigger;
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'notification_test',
      entity: 'NotificationTemplate',
      entityId: template.id,
      payload: {
        description: `E-mail de teste do template (${triggerLabel}, e-mail) enviado para '${user.name}' (${user.email})`,
        trigger: template.trigger,
        channel: template.channel,
        targetUserEmail: user.email,
        targetUserName: user.name,
        sent: result.sent,
      },
    });

    if (result.sent) {
      res.json({
        success: true,
        data: {
          message: `E-mail de teste enviado para ${user.email} (${user.name})`,
        },
      });
    } else {
      res.status(502).json({
        success: false,
        error: {
          message:
            result.error ?? 'Falha ao enviar. Verifique a configuração SMTP (host, porta, usuário e senha).',
        },
      });
    }
  } catch (e) {
    next(e);
  }
}
