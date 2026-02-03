/**
 * Notification trigger service: welcome (on user/account creation) and
 * expiration-based triggers (subscription_expiring, subscription_expired) run daily at midnight.
 * Single source for executing NotificationTemplates by trigger type.
 */

import jwt from 'jsonwebtoken';
import { prisma } from './prisma.service.js';
import { sendEmail } from './email.service.js';
import { sendPushNotification, type PushSubscriptionPayload } from './push.service.js';
import { buildTemplateContext, replaceTemplateVariables } from '../utils/template-variables.js';
import { getFrontendUrl } from '../utils/frontend-url.js';

const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET ?? 'secret';

/** Build reset-password link with valid token (same path as forgot-password flow). */
function buildResetPasswordLink(userId: string): string {
  const payload = { userId, purpose: 'password_reset' as const };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  return `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

/** Get effective expiration date for an account (trialEndsAt or latest subscription endDate). */
function getAccountExpirationDate(account: {
  trialEndsAt: Date | null;
  subscriptions?: { endDate: Date | null }[];
}): Date | null {
  if (account.trialEndsAt) return account.trialEndsAt;
  const sub = account.subscriptions?.filter((s) => s.endDate != null).sort(
    (a, b) => (b.endDate?.getTime() ?? 0) - (a.endDate?.getTime() ?? 0)
  )[0];
  return sub?.endDate ?? null;
}

/** Start of day (local server time) for a given date. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Whether a date falls on the given day (by date part). */
function isOnDay(date: Date | null, dayStart: Date): boolean {
  if (!date) return false;
  const t = date.getTime();
  const start = dayStart.getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return t >= start && t < end;
}

/**
 * Execute welcome trigger for a newly created user (email + PWA templates).
 * Called after user + account creation (webhook or admin). Logs errors but does not throw.
 */
export async function executeWelcomeTrigger(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      accounts: {
        where: { deletedAt: null },
        take: 1,
        select: {
          id: true,
          status: true,
          trialEndsAt: true,
          name: true,
          subscriptions: {
            where: { deletedAt: null },
            orderBy: { startDate: 'desc' },
            take: 1,
            select: { endDate: true, plan: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!user?.email) {
    console.warn('[notification-trigger] executeWelcomeTrigger: user not found or no email', { userId });
    return;
  }

  const account = user.accounts[0];
  const subscription = account?.subscriptions[0];
  const expirationDate = getAccountExpirationDate({
    trialEndsAt: account?.trialEndsAt ?? null,
    subscriptions: account?.subscriptions,
  });

  const templates = await prisma.notificationTemplate.findMany({
    where: {
      trigger: 'welcome',
      active: true,
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (templates.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[notification-trigger] No active welcome templates found');
    }
    return;
  }

  const resetPasswordLink = buildResetPasswordLink(user.id);
  const ctx = buildTemplateContext({
    userName: user.name,
    expirationDate,
    planName: subscription?.plan?.name,
    accountStatus: account?.status,
    resetPasswordLink,
  });

  for (const template of templates) {
    try {
      if (template.channel === 'email') {
        const subject = replaceTemplateVariables(template.subject ?? '', ctx);
        const body = replaceTemplateVariables(template.body, ctx);
        const isHtml = body.includes('<') && body.includes('>');
        const textFallback = isHtml
          ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          : body;
        const result = await sendEmail(user.email, subject, textFallback, isHtml ? body : undefined);
        await prisma.emailLog.create({
          data: {
            to: user.email,
            subject,
            status: result.sent ? 'success' : 'error',
            errorMessage: result.error ?? null,
            origin: 'trigger',
            templateId: template.id,
          },
        });
        await prisma.notificationTemplateUsageLog.create({
          data: {
            templateId: template.id,
            trigger: 'welcome',
            channel: 'email',
            recipientInfo: `${user.name} <${user.email}>`,
            success: result.sent,
            errorMessage: result.error ?? null,
          },
        });
        if (!result.sent) {
          console.warn('[notification-trigger] welcome email failed', { userId, error: result.error });
        }
      } else if (template.channel === 'pwa' && account) {
        const pushSubs = await prisma.pushSubscription.findMany({
          where: { accountId: account.id },
          select: { endpoint: true, p256dh: true, auth: true },
        });
        const title = replaceTemplateVariables(template.title ?? '', ctx);
        const body = replaceTemplateVariables(template.body, ctx);
        for (const sub of pushSubs) {
          const payload: PushSubscriptionPayload = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };
          try {
            await sendPushNotification(payload, { title, body });
            await prisma.notificationTemplateUsageLog.create({
              data: {
                templateId: template.id,
                trigger: 'welcome',
                channel: 'pwa',
                recipientInfo: `account:${account.id}`,
                success: true,
                errorMessage: null,
              },
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await prisma.notificationTemplateUsageLog.create({
              data: {
                templateId: template.id,
                trigger: 'welcome',
                channel: 'pwa',
                recipientInfo: `account:${account.id}`,
                success: false,
                errorMessage: msg,
              },
            });
            console.warn('[notification-trigger] welcome PWA failed', { userId, error: msg });
          }
        }
      }
    } catch (err) {
      console.error('[notification-trigger] executeWelcomeTrigger template error', {
        templateId: template.id,
        channel: template.channel,
        userId,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

/**
 * Run expiration-based triggers daily (subscription_expiring, subscription_expired).
 * Respects template daysOffset: expiring = D days before expiry; expired = D days after expiry.
 * Should be called once per day at midnight (cron "0 0 * * *").
 */
export async function runExpirationTriggersDaily(): Promise<void> {
  const now = new Date();
  const todayStart = startOfDay(now);

  const expiringTemplates = await prisma.notificationTemplate.findMany({
    where: {
      trigger: 'subscription_expiring',
      active: true,
      deletedAt: null,
      daysOffset: { not: null },
    },
  });
  const expiredTemplates = await prisma.notificationTemplate.findMany({
    where: {
      trigger: 'subscription_expired',
      active: true,
      deletedAt: null,
      daysOffset: { not: null },
    },
  });

  const accountsWithExpiration = await prisma.account.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      userId: true,
      trialEndsAt: true,
      user: { select: { id: true, email: true, name: true } },
      subscriptions: {
        where: { deletedAt: null },
        orderBy: { endDate: 'desc' },
        take: 1,
        select: { endDate: true, plan: { select: { name: true } } },
      },
    },
  });

  for (const template of expiringTemplates) {
    const D = template.daysOffset ?? 0;
    const targetDay = new Date(todayStart);
    targetDay.setDate(targetDay.getDate() + D);

    for (const row of accountsWithExpiration) {
      const exp = getAccountExpirationDate({
        trialEndsAt: row.trialEndsAt,
        subscriptions: row.subscriptions,
      });
      if (!exp || !isOnDay(exp, targetDay)) continue;

      const alreadySent = await prisma.notificationTemplateUsageLog.findFirst({
        where: {
          templateId: template.id,
          trigger: 'subscription_expiring',
          recipientInfo: `account:${row.id}`,
          createdAt: { gte: todayStart },
        },
      });
      if (alreadySent) continue;

      await sendTemplateToAccount(template, row, exp);
    }
  }

  for (const template of expiredTemplates) {
    const D = template.daysOffset ?? 0;
    const targetDay = new Date(todayStart);
    targetDay.setDate(targetDay.getDate() - D);

    for (const row of accountsWithExpiration) {
      const exp = getAccountExpirationDate({
        trialEndsAt: row.trialEndsAt,
        subscriptions: row.subscriptions,
      });
      if (!exp || !isOnDay(exp, targetDay)) continue;

      const alreadySent = await prisma.notificationTemplateUsageLog.findFirst({
        where: {
          templateId: template.id,
          trigger: 'subscription_expired',
          recipientInfo: `account:${row.id}`,
          createdAt: { gte: todayStart },
        },
      });
      if (alreadySent) continue;

      await sendTemplateToAccount(template, row, exp);
    }
  }
}

type AccountRow = {
  id: string;
  userId: string;
  trialEndsAt: Date | null;
  user: { id: string; email: string; name: string };
  subscriptions: { endDate: Date | null; plan: { name: string } | null }[];
};

async function sendTemplateToAccount(
  template: {
    id: string;
    trigger: string;
    channel: string;
    subject: string | null;
    title: string | null;
    body: string;
  },
  account: AccountRow,
  expirationDate: Date
): Promise<void> {
  const resetPasswordLink = buildResetPasswordLink(account.user.id);
  const ctx = buildTemplateContext({
    userName: account.user.name,
    expirationDate,
    planName: account.subscriptions[0]?.plan?.name,
    accountStatus: undefined,
    resetPasswordLink,
  });

  const recipientInfo = `account:${account.id}`;

  if (template.channel === 'email') {
    const subject = replaceTemplateVariables(template.subject ?? '', ctx);
    const body = replaceTemplateVariables(template.body, ctx);
    const isHtml = body.includes('<') && body.includes('>');
    const textFallback = isHtml
      ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : body;
    const result = await sendEmail(account.user.email, subject, textFallback, isHtml ? body : undefined);
    await prisma.emailLog.create({
      data: {
        to: account.user.email,
        subject,
        status: result.sent ? 'success' : 'error',
        errorMessage: result.error ?? null,
        origin: 'trigger',
        templateId: template.id,
      },
    });
    await prisma.notificationTemplateUsageLog.create({
      data: {
        templateId: template.id,
        trigger: template.trigger as 'subscription_expiring' | 'subscription_expired',
        channel: 'email',
        recipientInfo,
        success: result.sent,
        errorMessage: result.error ?? null,
      },
    });
    return;
  }

  if (template.channel === 'pwa') {
    const pushSubs = await prisma.pushSubscription.findMany({
      where: { accountId: account.id },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    const title = replaceTemplateVariables(template.title ?? '', ctx);
    const body = replaceTemplateVariables(template.body, ctx);
    for (const sub of pushSubs) {
      try {
        await sendPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { title, body }
        );
        await prisma.notificationTemplateUsageLog.create({
          data: {
            templateId: template.id,
            trigger: template.trigger as 'subscription_expiring' | 'subscription_expired',
            channel: 'pwa',
            recipientInfo,
            success: true,
            errorMessage: null,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await prisma.notificationTemplateUsageLog.create({
          data: {
            templateId: template.id,
            trigger: template.trigger as 'subscription_expiring' | 'subscription_expired',
            channel: 'pwa',
            recipientInfo,
            success: false,
            errorMessage: msg,
          },
        });
      }
    }
  }
}
