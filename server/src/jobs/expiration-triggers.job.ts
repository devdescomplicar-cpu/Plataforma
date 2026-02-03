/**
 * Cron job: run expiration-based notification triggers daily at midnight (00:00).
 * Scans accounts by trialEndsAt / subscription endDate and sends templates
 * subscription_expiring (D days before) and subscription_expired (D days after)
 * according to NotificationTemplate daysOffset rules.
 */

import cron, { type ScheduledTask } from 'node-cron';
import { runExpirationTriggersDaily } from '../services/notification-trigger.service.js';

const CRON_SCHEDULE = '0 0 * * *'; // Every day at 00:00 (midnight, server local time)

let scheduled: ScheduledTask | null = null;

export function startExpirationTriggersJob(): void {
  if (scheduled) return;
  scheduled = cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[cron] Running expiration triggers (subscription_expiring / subscription_expired)');
    try {
      await runExpirationTriggersDaily();
      console.log('[cron] Expiration triggers finished');
    } catch (err) {
      console.error('[cron] Expiration triggers error', err instanceof Error ? err.message : err);
    }
  });
  console.log('[cron] Expiration triggers job scheduled at midnight (0 0 * * *)');
}

export function stopExpirationTriggersJob(): void {
  if (scheduled) {
    scheduled.stop();
    scheduled = null;
    console.log('[cron] Expiration triggers job stopped');
  }
}
