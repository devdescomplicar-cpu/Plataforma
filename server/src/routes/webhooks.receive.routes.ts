import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../services/prisma.service.js';
import { executeWelcomeTrigger } from '../services/notification-trigger.service.js';
import { normalizeEmail } from '../utils/email.js';
import { createAuditLog, getAuditContextFromRequest } from '../utils/audit.js';
import { parseRecurrence, recurrenceToDays } from '../utils/parseRecurrence.js';

const router = Router();

/** Format date for log summary (DD/MM/YYYY). */
function formatDateForSummary(date: Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Derive human-readable oferta (Mensal, Trimestral, Semestral, Anual) from offerRaw. */
function formatOfertaForSummary(offerRaw: string | undefined): string {
  if (offerRaw == null || String(offerRaw).trim() === '') return '—';
  let offerData: string | Record<string, unknown> = String(offerRaw).trim();
  if (typeof offerData === 'string' && offerData.startsWith('{')) {
    try {
      const parsed = JSON.parse(offerData) as unknown;
      if (typeof parsed === 'object' && parsed !== null) offerData = parsed as Record<string, unknown>;
    } catch {
      // keep string
    }
  }
  const parsed = parseRecurrence(offerData);
  if (parsed.period === 'year') return parsed.multiplier === 1 ? 'Anual' : `${parsed.multiplier} anos`;
  if (parsed.period === 'month') {
    if (parsed.multiplier <= 1) return 'Mensal';
    if (parsed.multiplier <= 3) return 'Trimestral';
    if (parsed.multiplier <= 6) return 'Semestral';
    return 'Anual';
  }
  return '—';
}

/** Split plan display name into base name and oferta (e.g. "Pro - Anual" -> plano "Pro", oferta "Anual"). */
function splitPlanDisplay(planName: string | null | undefined): { plano: string; oferta: string } {
  if (!planName || !planName.trim()) return { plano: '—', oferta: '—' };
  const s = planName.trim();
  const dash = s.indexOf(' - ');
  if (dash > 0) return { plano: s.slice(0, dash).trim(), oferta: s.slice(dash + 3).trim() };
  return { plano: s, oferta: '—' };
}

/** Resumo for webhook log: action label + user data for "Ação" block in UI. */
function buildLogResumo(params: {
  userName: string;
  userEmail: string;
  cpfCnpj?: string | null;
  acao: string;
  planName?: string | null;
  offerRaw?: string;
  dataVencimento?: Date | null;
  statusAssinatura?: string;
}): {
  acaoLabel: string;
  usuario: { nome: string; email: string; cpfCnpj: string | null };
  plano: string;
  oferta: string;
  dataVencimento: string;
  status: string;
} {
  const status = (params.statusAssinatura ?? 'ativo').toLowerCase() === 'vencido' ? 'Vencido' : 'Ativo';
  const { plano, oferta: ofertaFromPlan } = splitPlanDisplay(params.planName);
  const oferta = ofertaFromPlan !== '—' ? ofertaFromPlan : formatOfertaForSummary(params.offerRaw);
  return {
    acaoLabel: params.acao,
    usuario: {
      nome: params.userName ?? '—',
      email: params.userEmail ?? '—',
      cpfCnpj: params.cpfCnpj ?? null,
    },
    plano,
    oferta,
    dataVencimento: formatDateForSummary(params.dataVencimento),
    status,
  };
}

/**
 * Resolves plan name from planId (cuid) or plan name. Used for account name.
 */
async function resolvePlanName(planIdOrName: string | undefined): Promise<string | null> {
  if (!planIdOrName || !planIdOrName.trim()) return null;
  const trimmed = planIdOrName.trim();
  const byId = await prisma.plan.findFirst({
    where: { id: trimmed, deletedAt: null },
    select: { name: true },
  });
  if (byId) return byId.name;
  const byName = await prisma.plan.findFirst({
    where: { name: trimmed, deletedAt: null },
    select: { name: true },
  });
  return byName?.name ?? null;
}

/**
 * Resolves plan ID from planId (cuid) or plan name. Used for Subscription.planId.
 */
async function resolvePlanId(planIdOrName: string | undefined): Promise<string | null> {
  if (!planIdOrName || !planIdOrName.trim()) return null;
  const trimmed = planIdOrName.trim();
  const byId = await prisma.plan.findFirst({
    where: { id: trimmed, deletedAt: null },
    select: { id: true },
  });
  if (byId) return byId.id;
  const byName = await prisma.plan.findFirst({
    where: { name: trimmed, deletedAt: null },
    select: { id: true },
  });
  return byName?.id ?? null;
}

/**
 * Maps parsed recurrence to durationMonths (1, 3, 6, 12) for Plan lookup.
 */
function recurrenceToDurationMonths(parsed: { period: string; multiplier: number }): number {
  if (parsed.period === 'month') {
    const m = parsed.multiplier;
    if (m <= 1) return 1;
    if (m <= 3) return 3;
    if (m <= 6) return 6;
    return 12;
  }
  if (parsed.period === 'year') return 12;
  return 1;
}

/**
 * Resolves plan ID matching the offer (e.g. trimestral → plan with durationMonths 3).
 * Same product name, correct duration. Falls back to base plan id if no match.
 */
async function resolvePlanIdByOffer(
  planIdOrName: string | undefined,
  offerRaw: string | undefined,
  quantityStr: string | undefined
): Promise<string | null> {
  const baseId = await resolvePlanId(planIdOrName);
  if (!baseId) return null;

  const basePlan = await prisma.plan.findFirst({
    where: { id: baseId, deletedAt: null },
    select: { name: true },
  });
  if (!basePlan) return baseId;

  if (offerRaw == null || String(offerRaw).trim() === '') return baseId;

  let offerData: string | Record<string, unknown> = String(offerRaw).trim();
  if (offerData.startsWith('{')) {
    try {
      const parsed = JSON.parse(offerData) as unknown;
      if (typeof parsed === 'object' && parsed !== null) offerData = parsed as Record<string, unknown>;
    } catch {
      // keep as string
    }
  }
  const parsed = parseRecurrence(offerData);
  const durationMonths = recurrenceToDurationMonths(parsed);

  const matchingPlan = await prisma.plan.findFirst({
    where: {
      name: basePlan.name,
      durationMonths,
      deletedAt: null,
    },
    select: { id: true },
  });

  return matchingPlan?.id ?? baseId;
}

/**
 * Creates or updates Subscription for the account so Plano/Oferta appears in the user list.
 * Uses offer (recurrence) to pick the correct plan variant (e.g. trimestral, not mensal).
 */
async function upsertSubscriptionForAccount(
  accountId: string,
  planIdOrName: string | undefined,
  offerRaw: string | undefined,
  quantityStr: string | undefined,
  trialEndsAt: Date | null
): Promise<void> {
  const planId = await resolvePlanIdByOffer(planIdOrName, offerRaw, quantityStr);
  if (!planId) return;

  const existing = await prisma.subscription.findFirst({
    where: { accountId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { planId, endDate: trialEndsAt ?? undefined },
    });
  } else {
    await prisma.subscription.create({
      data: {
        accountId,
        planId,
        status: 'active',
        endDate: trialEndsAt ?? undefined,
      },
    });
  }
}

/**
 * Builds due date from parsed recurrence and quantity.
 * Formula: today + (days per period × multiplier × quantity).
 * If offer is empty, returns null (use mapped dueDate or leave undefined).
 */
function buildDueDateFromRecurrence(
  offerRaw: string | undefined,
  quantityStr: string | undefined
): Date | null {
  if (offerRaw == null || String(offerRaw).trim() === '') return null;
  let offerData: string | Record<string, unknown> = String(offerRaw).trim();
  if (offerData.startsWith('{')) {
    try {
      const parsed = JSON.parse(offerData) as unknown;
      if (typeof parsed === 'object' && parsed !== null) offerData = parsed as Record<string, unknown>;
    } catch {
      // keep string
    }
  }
  const parsed = parseRecurrence(offerData);
  const quantity = quantityStr != null ? Number.parseInt(String(quantityStr).trim(), 10) : 1;
  const q = Number.isNaN(quantity) || quantity < 1 ? 1 : quantity;
  const totalDays = recurrenceToDays(parsed, q);
  if (totalDays <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + totalDays);
  return date;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(/[.[\]]+/).filter((k) => k !== '');
  let value: unknown = obj;
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) {
      const index = Number.parseInt(key, 10);
      if (Number.isNaN(index) || index < 0 || index >= value.length) return undefined;
      value = value[index];
    } else if (typeof value === 'object' && key in (value as object)) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return value;
}

function mapPayload(
  payload: Record<string, unknown>,
  fieldMappings: { webhookField: string; systemField: string; prefix: string | null; suffix: string | null }[]
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const m of fieldMappings) {
    const isFixed = !m.webhookField.includes('.') && !m.webhookField.includes('[');
    let value: unknown;
    if (isFixed) {
      const root = payload[m.webhookField];
      value = root !== undefined && root !== null ? root : m.webhookField;
    } else {
      value = getNestedValue(payload, m.webhookField);
    }
    if (value !== undefined && value !== null) {
      let str = String(value);
      if (m.prefix) str = m.prefix + str;
      if (m.suffix) str = str + m.suffix;
      mapped[m.systemField] = str;
    }
  }
  return mapped;
}

/** Sanitize headers for log (avoid storing sensitive values). */
function sanitizeHeadersForLog(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const skip = new Set(['authorization', 'cookie']);
  for (const [k, v] of Object.entries(headers)) {
    if (skip.has(k.toLowerCase())) continue;
    out[k] = typeof v === 'string' ? v : String(v ?? '');
  }
  return out;
}

/**
 * Creates a webhook log entry for history. Call on every receive (test + active).
 * processedInTestMode: true when request was handled in test mode (no user create/update), false when processed in production.
 */
async function createWebhookLog(params: {
  webhookId: string;
  req: Request;
  payload: object;
  statusCode: number;
  response: object | null;
  error: string | null;
  processedInTestMode: boolean;
}): Promise<void> {
  await prisma.webhookLog.create({
    data: {
      webhookId: params.webhookId,
      method: params.req.method,
      url: params.req.url || params.req.originalUrl || '',
      headers: sanitizeHeadersForLog((params.req.headers as Record<string, unknown>) ?? {}),
      body: params.payload as Prisma.InputJsonValue,
      statusCode: params.statusCode,
      response: params.response === null ? Prisma.JsonNull : (params.response as Prisma.InputJsonValue),
      error: params.error,
      processedInTestMode: params.processedInTestMode,
    },
  });
}

/**
 * Public endpoint: receive webhook by id (base idêntica à outra plataforma).
 * POST /api/webhooks/receive/:id
 * - If webhook is in testMode: store payload, create log, return success.
 * - If active: map fields and create/update User + Account (platform behavior).
 */
router.post('/receive/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const payload: Record<string, unknown> =
    (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  try {
    const webhook = await prisma.webhook.findFirst({
      where: { id, deletedAt: null },
      include: { fieldMappings: true },
    });

    if (!webhook) {
      res.status(404).json({
        success: false,
        error: { message: 'Webhook não encontrado' },
      });
      return;
    }

    const isReprocess =
      req.headers['x-internal-reprocess'] === (process.env.WEBHOOK_REPROCESS_SECRET || 'reprocess-internal');

    // Test mode: only store payload and log (unless internal reprocess)
    if (webhook.testMode && !isReprocess) {
      await prisma.webhook.update({
        where: { id },
        data: { lastTestPayload: payload as Prisma.InputJsonValue },
      });
      const logsCount = await prisma.webhookLog.count({ where: { webhookId: id } });
      const toDelete = logsCount >= 2;
      if (toDelete) {
        const oldest = await prisma.webhookLog.findMany({
          where: { webhookId: id },
          orderBy: { receivedAt: 'asc' },
          take: 1,
        });
        if (oldest[0]) await prisma.webhookLog.delete({ where: { id: oldest[0].id } });
      }
      await createWebhookLog({
        webhookId: id,
        req,
        payload: payload as object,
        statusCode: 200,
        response: { message: 'Webhook recebido em modo teste' },
        error: null,
        processedInTestMode: true,
      });
      res.status(200).json({
        success: true,
        message: 'Webhook recebido em modo teste',
        data: { success: true, message: 'Webhook recebido em modo teste' },
      });
      return;
    }

    // Active: process with field mappings and create/update User + Account (or reprocess bypass)
    if (!webhook.isActive && !isReprocess) {
      await createWebhookLog({
        webhookId: id,
        req,
        payload: payload as object,
        statusCode: 400,
        response: null,
        error: 'Webhook não está ativo',
        processedInTestMode: false,
      });
      res.status(400).json({
        success: false,
        error: { message: 'Webhook não está ativo' },
      });
      return;
    }

    const mappings = webhook.fieldMappings ?? [];
    if (mappings.length === 0) {
      await createWebhookLog({
        webhookId: id,
        req,
        payload,
        statusCode: 400,
        response: null,
        error: 'Webhook ativo sem campos mapeados',
        processedInTestMode: false,
      });
      res.status(400).json({
        success: false,
        error: { message: 'Webhook ativo sem campos mapeados' },
      });
      return;
    }

    const mapped = mapPayload(payload, mappings);
    const getMapped = (key: string): string | undefined => mapped[key]?.trim() || undefined;

    const userEmailRaw = getMapped('email');
    if (!userEmailRaw) {
      await createWebhookLog({
        webhookId: id,
        req,
        payload: payload as object,
        statusCode: 400,
        response: null,
        error: 'Campo Email não mapeado ou vazio',
        processedInTestMode: false,
      });
      res.status(400).json({
        success: false,
        error: { message: 'Campo Email não mapeado ou vazio' },
      });
      return;
    }

    const userEmail = normalizeEmail(userEmailRaw);
    const userName = getMapped('name') ?? userEmail.split('@')[0];
    const userPhone = getMapped('phone') ?? null;
    const userCpfCnpj = getMapped('cpfCnpj') ?? null;
    const planIdOrName = getMapped('plan');
    const accountName = await resolvePlanName(planIdOrName) ?? planIdOrName ?? `${userName}'s Account`;
    const offerRaw = mapped['offer'];
    const quantity = getMapped('quantity');
    const accountStatus = getMapped('status') ?? 'active';
    // Data de vencimento: calculada apenas de oferta × quantidade (parseRecurrence)
    const trialEndsAt = buildDueDateFromRecurrence(offerRaw, quantity);

    let user = await prisma.user.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' }, deletedAt: null },
      include: { accounts: { where: { deletedAt: null }, take: 1 } },
    });

    if (!user) {
      const existingSoftDeleted = await prisma.user.findFirst({
        where: { email: { equals: userEmail, mode: 'insensitive' } },
        include: { accounts: { where: { deletedAt: null }, take: 1 } },
      });

      if (existingSoftDeleted) {
        user = await prisma.user.update({
          where: { id: existingSoftDeleted.id },
          data: {
            deletedAt: null,
            name: userName,
            phone: userPhone,
            cpfCnpj: userCpfCnpj,
          },
          include: { accounts: { where: { deletedAt: null }, take: 1 } },
        });
        const account = user.accounts[0];
        let accountId: string;
        if (!account) {
          const newAccount = await prisma.account.create({
            data: {
              name: accountName,
              userId: user.id,
              status: accountStatus,
              trialEndsAt: trialEndsAt ?? undefined,
            },
          });
          accountId = newAccount.id;
        } else {
          await prisma.account.update({
            where: { id: account.id },
            data: {
              name: accountName,
              status: accountStatus,
              trialEndsAt: trialEndsAt ?? undefined,
            },
          });
          accountId = account.id;
        }
        await upsertSubscriptionForAccount(accountId, planIdOrName, offerRaw, quantity, trialEndsAt);
        await createAuditLog({
          ...getAuditContextFromRequest(req),
          userId: user.id,
          action: 'webhook_register',
          entity: 'User',
          entityId: user.id,
          payload: {
            description: `Usuário '${user.name}' (${user.email}) restaurado via webhook`,
            webhookId: webhook.id,
            email: userEmail,
            restored: true,
            entityName: user.name,
          },
        });
        const restoredResponse = {
          success: true,
          data: {
            success: true,
            message: 'Webhook processado com sucesso',
            data: { action: 'restored', userId: user.id, email: user.email },
          },
        };
        await createWebhookLog({
          webhookId: id,
          req,
          payload: payload as object,
          statusCode: 200,
          response: restoredResponse,
          error: null,
          processedInTestMode: false,
        });
        res.status(200).json(restoredResponse);
        return;
      }

      const userPassword = 'ChangeMe123!';
      const hashedPassword = await bcrypt.hash(userPassword, 10);
      user = await prisma.user.create({
        data: {
          email: userEmail,
          password: hashedPassword,
          name: userName,
          phone: userPhone,
          cpfCnpj: userCpfCnpj,
          role: 'user',
        },
        include: { accounts: { where: { deletedAt: null }, take: 1 } },
      });
      const newAccount = await prisma.account.create({
        data: {
          name: accountName,
          userId: user.id,
          status: accountStatus,
          trialEndsAt: trialEndsAt ?? undefined,
        },
      });
      await upsertSubscriptionForAccount(newAccount.id, planIdOrName, offerRaw, quantity, trialEndsAt);
      await createAuditLog({
        ...getAuditContextFromRequest(req),
        userId: user.id,
        action: 'webhook_register',
        entity: 'User',
        entityId: user.id,
        payload: {
          description: `Usuário '${user.name}' (${user.email}) criado via webhook`,
          webhookId: webhook.id,
          email: userEmail,
          entityName: user.name,
        },
      });
      const createdResponse = {
        success: true,
        data: {
          success: true,
          message: 'Webhook processado com sucesso',
          data: { action: 'created', userId: user.id, email: user.email },
          resumo: buildLogResumo({
            userName: user.name,
            userEmail: user.email,
            cpfCnpj: user.cpfCnpj,
            acao: 'Usuário criado',
            planName: accountName,
            offerRaw,
            dataVencimento: trialEndsAt,
            statusAssinatura: accountStatus,
          }),
        },
      };
      await createWebhookLog({
        webhookId: id,
        req,
        payload: payload as object,
        statusCode: 201,
        response: createdResponse,
        error: null,
        processedInTestMode: false,
      });
      executeWelcomeTrigger(user.id).catch((err) => {
        console.error('[webhooks/receive] welcome trigger failed', err);
      });
      res.status(201).json(createdResponse);
      return;
    }

    const account = user.accounts[0];
    if (!account) {
      const newAccount = await prisma.account.create({
        data: {
          name: accountName,
          userId: user.id,
          status: accountStatus,
          trialEndsAt: trialEndsAt ?? undefined,
        },
      });
      await upsertSubscriptionForAccount(newAccount.id, planIdOrName, offerRaw, quantity, trialEndsAt);
      const accountCreatedResponse = {
        success: true,
        data: {
          success: true,
          message: 'Webhook processado com sucesso',
          data: { action: 'account_created', userId: user.id, accountId: newAccount.id },
          resumo: buildLogResumo({
            userName: user.name,
            userEmail: user.email,
            cpfCnpj: user.cpfCnpj,
            acao: 'Conta criada para usuário existente',
            planName: accountName,
            offerRaw,
            dataVencimento: trialEndsAt,
            statusAssinatura: accountStatus,
          }),
        },
      };
      await createWebhookLog({
        webhookId: id,
        req,
        payload: payload as object,
        statusCode: 200,
        response: accountCreatedResponse,
        error: null,
        processedInTestMode: false,
      });
      res.json(accountCreatedResponse);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: userName,
        phone: userPhone,
        cpfCnpj: userCpfCnpj,
      },
    });
    await prisma.account.update({
      where: { id: account.id },
      data: {
        name: accountName,
        status: accountStatus,
        trialEndsAt: trialEndsAt ?? undefined,
      },
    });
    await upsertSubscriptionForAccount(account.id, planIdOrName, offerRaw, quantity, trialEndsAt);

    const updatedResponse = {
      success: true,
      data: {
        success: true,
        message: 'Webhook processado com sucesso',
        data: { action: 'updated', userId: user.id, accountId: account.id },
        resumo: buildLogResumo({
          userName,
          userEmail,
          cpfCnpj: userCpfCnpj,
          acao: 'Usuário atualizado (dados, plano, data de vencimento e/ou status da assinatura)',
          planName: accountName,
          offerRaw,
          dataVencimento: trialEndsAt,
          statusAssinatura: accountStatus,
        }),
      },
    };
    await createWebhookLog({
      webhookId: id,
      req,
      payload: payload as object,
      statusCode: 200,
      response: updatedResponse,
      error: null,
      processedInTestMode: false,
    });
    res.json(updatedResponse);
  } catch (e) {
    console.error('[webhooks/receive]', e);
    const errMessage = e instanceof Error ? e.message : 'Erro ao processar webhook';
    try {
      if (id) {
        await createWebhookLog({
          webhookId: id,
          req,
          payload: payload as object,
          statusCode: 500,
          response: null,
          error: errMessage,
          processedInTestMode: false,
        });
      }
    } catch (logErr) {
      console.error('[webhooks/receive] failed to create error log', logErr);
    }
    res.status(500).json({
      success: false,
      error: { message: 'Erro ao processar webhook' },
    });
  }
});

export default router;
