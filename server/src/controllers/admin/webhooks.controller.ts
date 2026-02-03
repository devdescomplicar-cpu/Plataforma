import { Response, NextFunction } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';
import { createAuditLog, getAuditContextFromRequest, type AuditChangeItem } from '../../utils/audit.js';
import { z } from 'zod';

import { getFrontendUrl } from '../../utils/frontend-url.js';

function getWebhookBaseUrl(): string {
  const base = process.env.VITE_APP_URL ?? process.env.API_BASE_URL ?? '';
  const cleaned = String(base).trim().replace(/\/api\/?$/, '').replace(/\/$/, '');
  return cleaned || getFrontendUrl();
}

const webhookFieldMappingSchema = z.object({
  webhookField: z.string().min(1),
  systemField: z.string().min(1),
  label: z.string().min(1),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

const webhookActionSchema = z.object({
  type: z.enum(['create_member', 'update_member', 'send_email', 'add_to_group', 'remove_from_group']),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'contains', 'greater_than', 'less_than']),
    value: z.unknown(),
  })).optional(),
  config: z.object({
    telegramGroupId: z.string().optional(),
    emailTemplateId: z.string().optional(),
    memberStatus: z.enum(['ativo', 'inadimplente', 'cancelado']).optional(),
    productId: z.string().optional(),
  }),
});

const webhookBodySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  url: z.string().url().optional().or(z.literal('')),
  fieldMappings: z.array(webhookFieldMappingSchema).default([]),
  isActive: z.boolean().optional().default(false),
  testMode: z.boolean().optional().default(true),
  lastTestPayload: z.record(z.unknown()).optional(),
  actions: z.array(webhookActionSchema).default([]),
});

function mapWebhookToDto(wh: {
  id: string;
  name: string;
  url: string | null;
  serverUrl: string;
  isActive: boolean;
  testMode: boolean;
  lastTestPayload: unknown;
  actions: unknown;
  secret: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  fieldMappings?: { webhookField: string; systemField: string; label: string; prefix: string | null; suffix: string | null }[];
}) {
  return {
    id: wh.id,
    name: wh.name,
    url: wh.url ?? '',
    serverUrl: wh.serverUrl,
    fieldMappings: (wh.fieldMappings ?? []).map((m) => ({
      webhookField: m.webhookField,
      systemField: m.systemField,
      label: m.label,
      prefix: m.prefix ?? undefined,
      suffix: m.suffix ?? undefined,
    })),
    isActive: wh.isActive,
    testMode: wh.testMode,
    lastTestPayload: wh.lastTestPayload ?? undefined,
    actions: (Array.isArray(wh.actions) ? wh.actions : []) as unknown[],
    secret: wh.secret ?? undefined,
    userId: wh.userId,
    createdAt: wh.createdAt,
    updatedAt: wh.updatedAt,
  };
}

/** List webhooks (admin). Filter by userId when provided. */
export async function listWebhooks(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;
    const filterUserId = req.query.userId as string | undefined;
    const isAdmin = true; // admin routes only

    const where: { deletedAt: null; userId?: string } = { deletedAt: null };
    if (isAdmin && filterUserId) where.userId = filterUserId;

    const webhooks = await prisma.webhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { fieldMappings: true },
    });
    const data = webhooks.map(mapWebhookToDto);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** Get webhook by id (admin). */
export async function getWebhookById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const webhook = await prisma.webhook.findFirst({
      where: { id, deletedAt: null },
      include: { fieldMappings: true },
    });
    if (!webhook) {
      res.status(404).json({ success: false, error: { message: 'Webhook não encontrado' } });
      return;
    }
    res.json({ success: true, data: mapWebhookToDto(webhook) });
  } catch (e) {
    next(e);
  }
}

/** Create webhook (admin). Generates serverUrl and secret. */
export async function createWebhook(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Usuário não autenticado' } });
      return;
    }
    const parsed = webhookBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { message: 'Dados inválidos', details: parsed.error.errors },
      });
      return;
    }
    const data = parsed.data;
    const webhookId = randomUUID();
    const serverUrl = `${getWebhookBaseUrl()}/api/webhooks/receive/${webhookId}`;
    const secret = `whsec_${randomBytes(32).toString('hex')}`;

    const webhook = await prisma.webhook.create({
      data: {
        id: webhookId,
        name: data.name,
        url: data.url || null,
        serverUrl,
        isActive: data.isActive,
        testMode: data.testMode,
        actions: (data.actions ?? []) as object,
        secret,
        userId,
        fieldMappings: {
          create: (data.fieldMappings ?? []).map((m) => ({
            webhookField: m.webhookField,
            systemField: m.systemField,
            label: m.label,
            prefix: m.prefix ?? null,
            suffix: m.suffix ?? null,
          })),
        },
      },
      include: { fieldMappings: true },
    });
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId,
      action: 'create',
      entity: 'Webhook',
      entityId: webhook.id,
      payload: {
        description: `Webhook '${webhook.name}' criado`,
        name: webhook.name,
        serverUrl: webhook.serverUrl,
      },
    });
    res.status(201).json({ success: true, data: mapWebhookToDto(webhook) });
  } catch (e) {
    next(e);
  }
}

/** Update webhook (admin). */
export async function updateWebhook(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const parsed = webhookBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { message: 'Dados inválidos', details: parsed.error.errors },
      });
      return;
    }
    const body = parsed.data;
    const existing = await prisma.webhook.findFirst({
      where: { id, deletedAt: null },
      include: { fieldMappings: true },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Webhook não encontrado' } });
      return;
    }

    const updateData: Parameters<typeof prisma.webhook.update>[0]['data'] = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.url !== undefined) updateData.url = body.url || null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.testMode !== undefined) updateData.testMode = body.testMode;
    if (body.lastTestPayload !== undefined) updateData.lastTestPayload = body.lastTestPayload as object;
    if (body.actions !== undefined) updateData.actions = body.actions as object;

    if (body.fieldMappings !== undefined) {
      await prisma.webhookFieldMapping.deleteMany({ where: { webhookId: id } });
      if (body.fieldMappings.length > 0) {
        await prisma.webhookFieldMapping.createMany({
          data: body.fieldMappings.map((m) => ({
            webhookId: id,
            webhookField: m.webhookField,
            systemField: m.systemField,
            label: m.label,
            prefix: m.prefix ?? null,
            suffix: m.suffix ?? null,
          })),
        });
      }
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data: updateData,
      include: { fieldMappings: true },
    });
    const changes: AuditChangeItem[] = [];
    if (body.name !== undefined && body.name !== existing.name) {
      changes.push({ field: 'name', label: 'Nome', oldValue: existing.name, newValue: body.name });
    }
    if (body.url !== undefined && (body.url || null) !== (existing.url ?? null)) {
      changes.push({ field: 'url', label: 'URL', oldValue: existing.url ?? null, newValue: body.url || null });
    }
    if (body.isActive !== undefined && body.isActive !== existing.isActive) {
      changes.push({ field: 'isActive', label: 'Ativo', oldValue: existing.isActive, newValue: body.isActive });
    }
    if (body.testMode !== undefined && body.testMode !== existing.testMode) {
      changes.push({ field: 'testMode', label: 'Modo teste', oldValue: existing.testMode, newValue: body.testMode });
    }
    const webhookDesc = changes.length
      ? `Webhook '${existing.name}': ${changes.map((c) => c.label).join(', ')} alterados`
      : `Webhook '${existing.name}' atualizado`;
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: userId!,
      action: 'update',
      entity: 'Webhook',
      entityId: id,
      payload: {
        description: webhookDesc,
        summary: changes.length ? `Alterado(s): ${changes.map((c) => c.label).join(', ')}` : 'Configuração atualizada',
        changes: changes.length ? changes : undefined,
        entityName: existing.name,
      },
    });
    res.json({ success: true, data: mapWebhookToDto(webhook) });
  } catch (e) {
    next(e);
  }
}

/** List all webhook logs (admin) – for Histórico tab. */
export async function listAllWebhookLogs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || 100), 10) || 100, 500);
    const offset = Math.max(0, parseInt(String(req.query.offset || 0), 10));
    const logs = await prisma.webhookLog.findMany({
      where: { webhook: { deletedAt: null } },
      include: { webhook: { select: { name: true } } },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      skip: offset,
    });
    const data = logs.map((log) => ({
      id: log.id,
      webhookId: log.webhookId,
      webhookName: log.webhook.name,
      webhookTestMode: log.processedInTestMode,
      method: log.method,
      url: log.url,
      headers: (log.headers as Record<string, string>) ?? {},
      body: (log.body as Record<string, unknown>) ?? {},
      statusCode: log.statusCode,
      response: log.response as Record<string, unknown> | null,
      error: log.error,
      receivedAt: log.receivedAt,
    }));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** Get webhook logs (admin) – per webhook. */
export async function getWebhookLogs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit || 100), 10) || 100, 500);
    const existing = await prisma.webhook.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Webhook não encontrado' } });
      return;
    }
    const logs = await prisma.webhookLog.findMany({
      where: { webhookId: id },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
    const data = logs.map((log) => ({
      id: log.id,
      webhookId: log.webhookId,
      webhookName: existing.name,
      webhookTestMode: log.processedInTestMode,
      method: log.method,
      url: log.url,
      headers: (log.headers as Record<string, string>) ?? {},
      body: (log.body as Record<string, unknown>) ?? {},
      statusCode: log.statusCode,
      response: log.response as Record<string, unknown> | null,
      error: log.error,
      receivedAt: log.receivedAt,
    }));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** Test webhook (admin). Receives payload and stores as lastTestPayload + creates log. */
export async function testWebhook(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const webhook = await prisma.webhook.findFirst({
      where: { id, deletedAt: null },
      include: { fieldMappings: true },
    });
    if (!webhook) {
      res.status(404).json({ success: false, error: { message: 'Webhook não encontrado' } });
      return;
    }
    if (!webhook.testMode) {
      res.status(400).json({
        success: false,
        error: { message: 'Webhook não está em modo teste. Ative o modo teste para testar.' },
      });
      return;
    }
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    await prisma.webhook.update({
      where: { id },
      data: { lastTestPayload: payload as object },
    });
    await prisma.webhookLog.create({
      data: {
        webhookId: id,
        method: req.method,
        url: req.url || req.originalUrl || '',
        headers: (req.headers as Record<string, string>) ?? {},
        body: payload as object,
        statusCode: 200,
        response: { message: 'Webhook recebido em modo teste' } as object,
        error: null,
      },
    });
    res.json({
      success: true,
      data: {
        success: true,
        message: 'Webhook recebido em modo teste',
        payload,
        webhook: {
          id: webhook.id,
          name: webhook.name,
          fieldMappings: webhook.fieldMappings.map((m) => ({
            webhookField: m.webhookField,
            systemField: m.systemField,
            label: m.label,
            prefix: m.prefix ?? undefined,
            suffix: m.suffix ?? undefined,
          })),
        },
      },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Reprocess last test payload in production mode (admin).
 * Sends lastTestPayload to the receive endpoint with internal header so it creates/updates the user.
 */
export async function reprocessWebhook(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const webhook = await prisma.webhook.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, lastTestPayload: true, fieldMappings: { select: { id: true } } },
    });
    if (!webhook) {
      res.status(404).json({ success: false, error: { message: 'Webhook não encontrado' } });
      return;
    }
    const payload = webhook.lastTestPayload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({
        success: false,
        error: { message: 'Nenhum payload de teste salvo. Envie um POST em modo teste primeiro.' },
      });
      return;
    }
    if (!webhook.fieldMappings?.length) {
      res.status(400).json({
        success: false,
        error: { message: 'Webhook sem mapeamentos. Configure os campos antes de reprocessar.' },
      });
      return;
    }
    const baseUrl =
      process.env.API_BASE_URL ||
      process.env.VITE_APP_URL ||
      (req.protocol && req.get('host') ? `${req.protocol}://${req.get('host')}` : 'http://localhost:3001');
    const receiveUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/receive/${id}`;
    const secret = process.env.WEBHOOK_REPROCESS_SECRET || 'reprocess-internal';
    const response = await fetch(receiveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Reprocess': secret,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (e) {
    next(e);
  }
}

/** Activate webhook (admin). Requires fieldMappings. */
export async function activateWebhook(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const webhook = await prisma.webhook.findFirst({
      where: { id, deletedAt: null },
      include: { fieldMappings: true },
    });
    if (!webhook) {
      res.status(404).json({ success: false, error: { message: 'Webhook não encontrado' } });
      return;
    }
    if (!webhook.fieldMappings?.length) {
      res.status(400).json({
        success: false,
        error: { message: 'Configure os mapeamentos de campos antes de ativar o webhook' },
      });
      return;
    }
    const updated = await prisma.webhook.update({
      where: { id },
      data: { isActive: true, testMode: false },
      include: { fieldMappings: true },
    });
    res.json({
      success: true,
      data: {
        success: true,
        message: 'Webhook ativado com sucesso',
        webhook: mapWebhookToDto(updated),
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Deactivate webhook (admin). */
export async function deactivateWebhook(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.webhook.findFirst({
      where: { id, deletedAt: null },
      include: { fieldMappings: true },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Webhook não encontrado' } });
      return;
    }
    const updated = await prisma.webhook.update({
      where: { id },
      data: { isActive: false, testMode: true },
      include: { fieldMappings: true },
    });
    res.json({
      success: true,
      data: {
        success: true,
        message: 'Webhook desativado (modo teste ativado)',
        webhook: mapWebhookToDto(updated),
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Soft delete webhook (admin). */
export async function softDeleteWebhook(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.webhook.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Webhook não encontrado' } });
      return;
    }
    await prisma.webhook.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId!,
      action: 'delete',
      entity: 'Webhook',
      entityId: id,
      payload: {
        description: `Webhook '${existing.name}' desativado`,
        entityName: existing.name,
      },
    });
    res.json({ success: true, data: { message: 'Webhook desativado com sucesso' } });
  } catch (e) {
    next(e);
  }
}
