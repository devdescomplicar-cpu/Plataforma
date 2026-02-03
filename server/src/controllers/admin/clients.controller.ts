import { Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const EXPORT_MAX = 10_000;

const clientSelect = {
  id: true,
  accountId: true,
  name: true,
  email: true,
  phone: true,
  cpfCnpj: true,
  city: true,
  state: true,
  createdAt: true,
  updatedAt: true,
  account: {
    select: {
      id: true,
      name: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  sales: {
    where: { deletedAt: null },
    select: { salePrice: true, saleDate: true },
  },
} as const;

type ClientWithRelations = Prisma.ClientGetPayload<{
  select: typeof clientSelect;
}>;

function buildWhere(params: {
  userId?: string;
  state?: string;
  search?: string;
  ids?: string[];
}): Prisma.ClientWhereInput {
  const accountFilter =
    typeof params.userId === 'string' && params.userId.trim()
      ? { userId: params.userId.trim(), deletedAt: null }
      : { deletedAt: null };

  const where: Prisma.ClientWhereInput = {
    deletedAt: null,
    account: accountFilter,
  };

  if (Array.isArray(params.ids) && params.ids.length > 0) {
    where.id = { in: params.ids };
  }

  if (typeof params.state === 'string' && params.state.trim()) {
    where.state = params.state.trim().toUpperCase();
  }

  const searchStr = typeof params.search === 'string' ? params.search.trim() : '';
  if (searchStr) {
    where.OR = [
      { name: { contains: searchStr, mode: 'insensitive' } },
      { email: { contains: searchStr, mode: 'insensitive' } },
      { phone: { contains: searchStr, mode: 'insensitive' } },
      { cpfCnpj: { contains: searchStr, mode: 'insensitive' } },
    ];
  }

  return where;
}

function mapClientToDto(c: ClientWithRelations) {
  const vehicleCount = c.sales.length;
  const totalSpent = c.sales.reduce((sum, s) => sum + s.salePrice, 0);
  const lastSale = c.sales.length
    ? c.sales.reduce((a, b) => (a.saleDate > b.saleDate ? a : b))
    : null;
  const status = vehicleCount > 0 ? 'Cliente' : 'Prospecto';

  return {
    id: c.id,
    accountId: c.accountId,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    cpfCnpj: c.cpfCnpj ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    user: c.account.user
      ? { id: c.account.user.id, name: c.account.user.name, email: c.account.user.email }
      : null,
    accountName: c.account.name,
    vehicleCount,
    totalSpent,
    lastPurchaseDate: lastSale ? lastSale.saleDate.toISOString() : null,
    status,
  };
}

/** Get clients statistics (admin). */
export async function getClientsStats(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const where = { deletedAt: null };

    // Get all clients with their sales
    const clients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        sales: {
          where: { deletedAt: null },
          select: {
            salePrice: true,
          },
        },
      },
    });

    // Calculate statistics
    const totalClients = clients.length;

    // Find client with most purchases (sales count)
    const clientWithMostPurchases = clients.reduce(
      (max, client) => {
        const purchaseCount = client.sales.length;
        return purchaseCount > max.count
          ? { id: client.id, name: client.name, count: purchaseCount }
          : max;
      },
      { id: '', name: '', count: 0 }
    );

    // Find client with highest total spent
    const clientWithMostSpent = clients.reduce(
      (max, client) => {
        const totalSpent = client.sales.reduce((sum, sale) => sum + sale.salePrice, 0);
        return totalSpent > max.totalSpent
          ? { id: client.id, name: client.name, totalSpent }
          : max;
      },
      { id: '', name: '', totalSpent: 0 }
    );

    res.json({
      success: true,
      data: {
        totalClients,
        topClientByPurchases:
          clientWithMostPurchases.count > 0
            ? {
                id: clientWithMostPurchases.id,
                name: clientWithMostPurchases.name,
                purchaseCount: clientWithMostPurchases.count,
              }
            : null,
        topClientBySpent:
          clientWithMostSpent.totalSpent > 0
            ? {
                id: clientWithMostSpent.id,
                name: clientWithMostSpent.name,
                totalSpent: clientWithMostSpent.totalSpent,
              }
            : null,
      },
    });
  } catch (e) {
    next(e);
  }
}

/** List all clients from all users (admin). Filter by userId, state, search. */
export async function listClients(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, state, search, page = String(DEFAULT_PAGE), limit = String(DEFAULT_LIMIT) } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Math.min(Number(limit), 100);

    const where = buildWhere({
      userId: typeof userId === 'string' ? userId : undefined,
      state: typeof state === 'string' ? state : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: clientSelect,
      }),
      prisma.client.count({ where }),
    ]);

    const data = clients.map(mapClientToDto);

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Export clients (admin). Filter by ids, userId, state, search. Max EXPORT_MAX. */
export async function exportClients(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { ids, userId, state, search } = req.query;
    const idList =
      typeof ids === 'string' && ids.trim()
        ? ids.split(',').map((id) => id.trim()).filter(Boolean)
        : undefined;

    const where = buildWhere({
      ids: idList,
      userId: typeof userId === 'string' ? userId : undefined,
      state: typeof state === 'string' ? state : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    const clients = await prisma.client.findMany({
      where,
      take: EXPORT_MAX,
      orderBy: { createdAt: 'desc' },
      select: clientSelect,
    });

    const data = clients.map(mapClientToDto);

    res.json({
      success: true,
      data,
    });
  } catch (e) {
    next(e);
  }
}
