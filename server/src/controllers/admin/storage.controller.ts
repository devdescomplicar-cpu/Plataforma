import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { minioService } from '../../services/minio.service.js';
import { prisma } from '../../services/prisma.service.js';

const BUCKET_NAME = process.env.MINIO_BUCKET || 'vehicle-images';
const THRESHOLD_70 = 0.7;
const THRESHOLD_85 = 0.85;
const IMAGE_OVER_2MB = 2 * 1024 * 1024;
const IMAGE_OPTIMIZED_MAX = 300 * 1024; // 300KB target

function getStorageTotalMb(): number | null {
  const v = process.env.STORAGE_TOTAL_MB;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Persist today's snapshot for growth series (idempotent per day). */
async function persistDailySnapshot(totalBytes: number, fileCount: number): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.storageSnapshot.upsert({
    where: { snapshotDate: today },
    create: {
      snapshotDate: today,
      totalBytes: BigInt(totalBytes),
      fileCount,
    },
    update: { totalBytes: BigInt(totalBytes), fileCount },
  });
}

/** Get storage stats (admin) – expanded metrics. Espaco total/livre/% use STORAGE_TOTAL_MB when set. */
export async function getStorageStats(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await minioService.getBucketStats();
    const totalBytes = stats.totalSizeBytes;
    const fileCount = stats.objectCount;
    const totalMb = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

    const totalLimitMb = getStorageTotalMb();
    const totalSpaceMb = totalLimitMb;
    const freeSpaceMb =
      totalLimitMb != null ? Math.max(0, Math.round((totalLimitMb - totalMb) * 100) / 100) : null;
    const usagePercent =
      totalLimitMb != null && totalLimitMb > 0
        ? Math.min(100, Math.round((totalMb / totalLimitMb) * 1000) / 10)
        : null;

    const avgFileSizeBytes =
      fileCount > 0 ? Math.round(totalBytes / fileCount) : null;
    const largestFileBytes = stats.largestObjectBytes > 0 ? stats.largestObjectBytes : null;

    const [dbImages, snapshot30DaysAgo] = await Promise.all([
      prisma.vehicleImage.count({ where: { deletedAt: null } }),
      (async () => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 30);
        d.setUTCHours(0, 0, 0, 0);
        return prisma.storageSnapshot.findUnique({ where: { snapshotDate: d } });
      })(),
    ]);

    const growth30Days =
      snapshot30DaysAgo != null
        ? totalBytes - Number(snapshot30DaysAgo.totalBytes)
        : null;

    await persistDailySnapshot(totalBytes, fileCount);

    const data = {
      available: stats.available,
      bucketName: BUCKET_NAME,
      totalSizeBytes: totalBytes,
      totalSizeMb: totalMb,
      totalSpaceMb,
      freeSpaceMb,
      usagePercent,
      fileCount,
      totalImages: dbImages,
      avgFileSizeBytes,
      largestFileBytes,
      growth30DaysBytes: growth30Days,
      growth30DaysMb: growth30Days != null ? Math.round((growth30Days / (1024 * 1024)) * 100) / 100 : null,
      generatedAt: new Date().toISOString(),
    };
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** Growth time series: day / week / month. */
export async function getStorageGrowth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const granularity = (req.query.granularity as string) || 'day'; // day | week | month
    const limit = Math.min(Number(req.query.limit) || 90, 365);
    const snapshots = await prisma.storageSnapshot.findMany({
      orderBy: { snapshotDate: 'asc' },
      take: limit + 100,
    });
    let grouped: { period: string; totalBytes: number; fileCount: number }[] = [];
    const byKey = new Map<string, { totalBytes: number; fileCount: number }>();
    for (const s of snapshots) {
      const d = new Date(s.snapshotDate);
      let key: string;
      if (granularity === 'month') {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      } else if (granularity === 'week') {
        const start = new Date(d);
        start.setUTCDate(d.getUTCDate() - d.getUTCDay());
        start.setUTCHours(0, 0, 0, 0);
        key = start.toISOString().slice(0, 10);
      } else {
        key = s.snapshotDate.toISOString().slice(0, 10);
      }
      const cur = byKey.get(key) ?? { totalBytes: 0, fileCount: 0 };
      cur.totalBytes += Number(s.totalBytes);
      cur.fileCount += s.fileCount;
      byKey.set(key, cur);
    }
    grouped = Array.from(byKey.entries())
      .map(([period, v]) => ({ period, totalBytes: v.totalBytes, fileCount: v.fileCount }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-limit);
    res.json({ success: true, data: grouped });
  } catch (e) {
    next(e);
  }
}

/**
 * Zombie files: images from accounts inactive for 90, 180 or 360 days.
 * "Inactive" = last activity (max of account.updatedAt and vehicles.updatedAt) before threshold.
 */
export async function getZombieFiles(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const now = new Date();
    const day90 = new Date(now);
    day90.setUTCDate(day90.getUTCDate() - 90);
    const day180 = new Date(now);
    day180.setUTCDate(day180.getUTCDate() - 180);
    const day360 = new Date(now);
    day360.setUTCDate(day360.getUTCDate() - 360);

    const [accounts, vehicles, imagesWithAccount] = await Promise.all([
      prisma.account.findMany({
        where: { deletedAt: null },
        select: { id: true, updatedAt: true },
      }),
      prisma.vehicle.findMany({
        where: { deletedAt: null },
        select: { id: true, accountId: true, updatedAt: true },
      }),
      prisma.vehicleImage.findMany({
        where: { deletedAt: null, vehicle: { deletedAt: null } },
        select: { id: true, key: true, sizeBytes: true, vehicleId: true },
      }),
    ]);

    const vehicleToAccount = new Map(vehicles.map((v) => [v.id, v.accountId]));
    const accountMaxVehicleUpdated = new Map<string, Date>();
    for (const v of vehicles) {
      const cur = accountMaxVehicleUpdated.get(v.accountId);
      if (!cur || v.updatedAt > cur) accountMaxVehicleUpdated.set(v.accountId, v.updatedAt);
    }

    const lastActivityByAccount = new Map<string, Date>();
    for (const a of accounts) {
      const maxV = accountMaxVehicleUpdated.get(a.id);
      const last = !maxV ? a.updatedAt : maxV > a.updatedAt ? maxV : a.updatedAt;
      lastActivityByAccount.set(a.id, last);
    }

    const inactive90 = [...lastActivityByAccount.entries()]
      .filter(([, d]) => d < day90)
      .map(([id]) => id);
    const inactive180 = [...lastActivityByAccount.entries()]
      .filter(([, d]) => d < day180)
      .map(([id]) => id);
    const inactive360 = [...lastActivityByAccount.entries()]
      .filter(([, d]) => d < day360)
      .map(([id]) => id);

    const keyToSize = new Map<string, number>();
    try {
      const objectSizes = await minioService.listObjectSizes();
      for (const o of objectSizes) keyToSize.set(o.key, o.size);
    } catch {
      // fallback: use sizeBytes from DB
    }

    const sumBytesForImages = (list: { key: string; sizeBytes: number | null }[]) =>
      list.reduce((acc, i) => acc + (keyToSize.get(i.key) ?? i.sizeBytes ?? 0), 0);

    const byAccountSet = (set: Set<string>) =>
      imagesWithAccount.filter((img) => {
        const aid = vehicleToAccount.get(img.vehicleId);
        return aid != null && set.has(aid);
      });

    const set90 = new Set(inactive90);
    const set180 = new Set(inactive180);
    const set360 = new Set(inactive360);
    const z90 = byAccountSet(set90);
    const z180 = byAccountSet(set180);
    const z360 = byAccountSet(set360);

    const data = {
      zombie90: { count: z90.length, bytes: sumBytesForImages(z90) },
      zombie180: { count: z180.length, bytes: sumBytesForImages(z180) },
      zombie360: { count: z360.length, bytes: sumBytesForImages(z360) },
    };
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/**
 * Clean zombie files: remove from S3 and soft-delete VehicleImage.
 * Only images from accounts inactive for the given period (90, 180 or 360 days).
 * Body: { days: 90 | 180 | 360 }
 */
export async function cleanZombieFiles(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = Number((req.body as { days?: number }).days) || 90;
    if (![90, 180, 360].includes(days)) {
      res.status(400).json({
        success: false,
        error: { message: 'days must be 90, 180 or 360' },
      });
      return;
    }
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const [accounts, vehicles] = await Promise.all([
      prisma.account.findMany({
        where: { deletedAt: null },
        select: { id: true, updatedAt: true },
      }),
      prisma.vehicle.findMany({
        where: { deletedAt: null },
        select: { id: true, accountId: true, updatedAt: true },
      }),
    ]);

    const accountMaxVehicleUpdated = new Map<string, Date>();
    for (const v of vehicles) {
      const cur = accountMaxVehicleUpdated.get(v.accountId);
      if (!cur || v.updatedAt > cur) accountMaxVehicleUpdated.set(v.accountId, v.updatedAt);
    }
    const inactiveAccountIds = new Set(
      accounts
        .filter((a) => {
          const maxV = accountMaxVehicleUpdated.get(a.id);
          const last = !maxV ? a.updatedAt : maxV > a.updatedAt ? maxV : a.updatedAt;
          return last < since;
        })
        .map((a) => a.id)
    );

    const images = await prisma.vehicleImage.findMany({
      where: {
        deletedAt: null,
        vehicle: {
          deletedAt: null,
          accountId: { in: [...inactiveAccountIds] },
        },
      },
      select: { id: true, key: true, sizeBytes: true },
    });

    if (images.length === 0) {
      res.json({
        success: true,
        data: {
          deletedCount: 0,
          bytesFreed: 0,
          message: `Nenhuma imagem de contas inativas há ${days}+ dias.`,
        },
      });
      return;
    }

    const results = await Promise.allSettled(images.map((img) => minioService.deleteImage(img.key)));
    const deletedCount = results.filter((r) => r.status === 'fulfilled').length;
    const bytesFreed = images.reduce((acc, i) => acc + (i.sizeBytes ?? 0), 0);

    await prisma.$transaction([
      prisma.vehicleImage.updateMany({
        where: { id: { in: images.map((i) => i.id) } },
        data: { deletedAt: new Date() },
      }),
      prisma.storageCleanupLog.create({
        data: {
          filesRemoved: deletedCount,
          bytesFreed: BigInt(bytesFreed),
          triggerUserId: req.userId ?? undefined,
          triggerType: `zombie_${days}`,
          details: { imageIds: images.map((i) => i.id) },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        deletedCount,
        bytesFreed,
        message: `${deletedCount} arquivo(s) removido(s). ${Math.round(bytesFreed / 1024 / 1024 * 100) / 100} MB liberados.`,
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Top consumers by account (files + space). Uses real sizes from S3; only non-deleted images count. */
export async function getTopConsumers(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [objectSizes, images] = await Promise.all([
      minioService.listObjectSizes(),
      prisma.vehicleImage.findMany({
        where: { deletedAt: null },
        select: { key: true, vehicleId: true },
      }),
    ]);
    const keyToSize = new Map(objectSizes.map((o) => [o.key, o.size]));

    const vehicleIds = [...new Set(images.map((i) => i.vehicleId))];
    const vehicles = await prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: {
        id: true,
        accountId: true,
        account: {
          select: {
            name: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    const byAccount = new Map<
      string,
      { fileCount: number; bytes: number; accountName: string; userEmail: string; userName: string }
    >();
    for (const img of images) {
      const v = vehicles.find((x) => x.id === img.vehicleId);
      if (!v) continue;
      const size = keyToSize.get(img.key) ?? 0;
      const cur = byAccount.get(v.accountId) ?? {
        fileCount: 0,
        bytes: 0,
        accountName: v.account.name,
        userEmail: v.account.user?.email ?? '',
        userName: v.account.user?.name ?? '',
      };
      cur.fileCount += 1;
      cur.bytes += size;
      byAccount.set(v.accountId, cur);
    }
    const list = Array.from(byAccount.entries())
      .map(([accountId, v]) => ({ accountId, ...v }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 50);
    res.json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
}

/** Cleanup / trash history. */
export async function getCleanupHistory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const logs = await prisma.storageCleanupLog.findMany({
      orderBy: { cleanedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        cleanedAt: true,
        filesRemoved: true,
        bytesFreed: true,
        triggerType: true,
      },
    });
    const data = logs.map((l) => ({
      id: l.id,
      cleanedAt: l.cleanedAt.toISOString(),
      filesRemoved: l.filesRemoved,
      bytesFreed: Number(l.bytesFreed),
      triggerType: l.triggerType,
    }));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** File quality: % images > 2MB, % not optimized (>300KB), suggestion. Uses real sizes from S3. */
export async function getFileQuality(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const objectSizes = await minioService.listObjectSizes();
    const vehicleKeys = objectSizes.filter((o) => o.key.startsWith('vehicles/'));
    const total = vehicleKeys.length;
    const totalBytes = vehicleKeys.reduce((acc, o) => acc + o.size, 0);
    const over2Mb = vehicleKeys.filter((o) => o.size >= IMAGE_OVER_2MB).length;
    const notOptimized = vehicleKeys.filter((o) => o.size > IMAGE_OPTIMIZED_MAX).length;
    const optimizableBytes = vehicleKeys
      .filter((o) => o.size > IMAGE_OPTIMIZED_MAX)
      .reduce((acc, o) => acc + o.size, 0);
    const savingsPercent =
      totalBytes > 0 ? Math.round((optimizableBytes / totalBytes) * 100) : 0;

    const data = {
      totalImagesWithSize: total,
      percentOver2Mb: total > 0 ? Math.round((over2Mb / total) * 1000) / 10 : 0,
      percentNotOptimized: total > 0 ? Math.round((notOptimized / total) * 1000) / 10 : 0,
      savingsSuggestionPercent: savingsPercent,
      message:
        savingsPercent > 0
          ? `Você pode economizar cerca de ${savingsPercent}% comprimindo imagens acima de 300 KB.`
          : total > 0
            ? 'Nenhuma economia significativa sugerida.'
            : null,
    };
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** Storage alerts: usage > 70%, > 85%, abnormal growth, retention (checked on S3). */
export async function getStorageAlerts(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let stats: Awaited<ReturnType<typeof minioService.getBucketStats>>;
    try {
      stats = await minioService.getBucketStats();
    } catch (e) {
      console.warn('[getStorageAlerts] getBucketStats failed', e);
      res.json({ success: true, data: [] });
      return;
    }
    const totalMb = stats.totalSizeBytes / (1024 * 1024);
    const totalLimit = getStorageTotalMb();
    const usagePercent =
      totalLimit != null && totalLimit > 0 ? totalMb / totalLimit : null;

    const alerts: { type: string; severity: 'warning' | 'danger' | 'info'; message: string }[] = [];

    if (usagePercent != null) {
      if (usagePercent >= THRESHOLD_85) {
        alerts.push({
          type: 'usage_high',
          severity: 'danger',
          message: `Uso acima de 85% (${Math.round(usagePercent * 100)}%). Libere espaço ou aumente o limite.`,
        });
      } else if (usagePercent >= THRESHOLD_70) {
        alerts.push({
          type: 'usage_warning',
          severity: 'warning',
          message: `Uso acima de 70% (${Math.round(usagePercent * 100)}%). Considere limpar arquivos zumbis.`,
        });
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    const oldSnapshot = await prisma.storageSnapshot.findUnique({
      where: { snapshotDate: thirtyDaysAgo },
    });
    if (oldSnapshot != null && stats.totalSizeBytes > 0) {
      const growth = (stats.totalSizeBytes - Number(oldSnapshot.totalBytes)) / stats.totalSizeBytes;
      if (growth > 0.5) {
        alerts.push({
          type: 'abnormal_growth',
          severity: 'warning',
          message: `Crescimento anormal nos últimos 30 dias (+${Math.round(growth * 100)}%).`,
        });
      }
    }

    res.json({ success: true, data: alerts });
  } catch (e) {
    next(e);
  }
}

/**
 * Remove from S3 only images linked to soft-deleted vehicles.
 * Soft-deletes VehicleImage and logs to StorageCleanupLog.
 */
export async function cleanObsoleteStorage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const obsoleteImages = await prisma.vehicleImage.findMany({
      where: {
        deletedAt: null,
        vehicle: { deletedAt: { not: null } },
      },
      select: { id: true, key: true, sizeBytes: true },
    });

    if (obsoleteImages.length === 0) {
      res.json({
        success: true,
        data: {
          deletedCount: 0,
          failedCount: 0,
          bytesFreed: 0,
          message: 'Nenhuma imagem obsoleta encontrada.',
        },
      });
      return;
    }

    const results = await Promise.allSettled(
      obsoleteImages.map((img) => minioService.deleteImage(img.key))
    );
    const deletedCount = results.filter((r) => r.status === 'fulfilled').length;
    const failedCount = results.filter((r) => r.status === 'rejected').length;
    const bytesFreed = obsoleteImages.reduce((acc, i) => acc + (i.sizeBytes ?? 0), 0);

    if (failedCount > 0) {
      const reasons = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason);
      console.warn('[cleanObsoleteStorage] Some S3 deletes failed', { failedCount, reasons });
    }

    await prisma.$transaction([
      prisma.vehicleImage.updateMany({
        where: { id: { in: obsoleteImages.map((i) => i.id) } },
        data: { deletedAt: new Date() },
      }),
      prisma.storageCleanupLog.create({
        data: {
          filesRemoved: deletedCount,
          bytesFreed: BigInt(bytesFreed),
          triggerUserId: req.userId ?? undefined,
          triggerType: 'obsolete',
          details: { imageIds: obsoleteImages.map((i) => i.id) },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        deletedCount,
        failedCount,
        bytesFreed,
        message:
          failedCount === 0
            ? `${deletedCount} imagem(ns) obsoleta(s) removida(s). ${Math.round(bytesFreed / 1024 / 1024 * 100) / 100} MB liberados.`
            : `${deletedCount} removida(s), ${failedCount} falha(s).`,
      },
    });
  } catch (e) {
    next(e);
  }
}
