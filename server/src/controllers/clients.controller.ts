import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { clientSchema } from '../utils/validators.js';

export const getClients = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { search, page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      accountId,
      deletedAt: null,
    };

    if (search) {
      const searchStr = (search as string).trim();
      const normalizedSearch = searchStr.replace(/\D/g, ''); // Remove tudo que não é dígito
      
      // Buscar por nome e email normalmente
      const orConditions: any[] = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { email: { contains: searchStr, mode: 'insensitive' } },
      ];
      
      // Se a busca contém apenas números ou tem números, buscar também em phone e cpfCnpj normalizados
      if (normalizedSearch.length >= 2) {
        // Buscar telefones normalizados (removendo formatação)
        const phoneMatches = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "clients"
          WHERE "accountId" = ${accountId}
            AND "deletedAt" IS NULL
            AND phone IS NOT NULL
            AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '(', ''), ')', ''), ' ', ''), '-', ''), '.', '') LIKE ${`%${normalizedSearch}%`}
        `;
        
        // Buscar CPF/CNPJ normalizados (removendo formatação)
        const cpfCnpjMatches = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "clients"
          WHERE "accountId" = ${accountId}
            AND "deletedAt" IS NULL
            AND "cpfCnpj" IS NOT NULL
            AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("cpfCnpj", '.', ''), '/', ''), '-', ''), '(', ''), ')', '') LIKE ${`%${normalizedSearch}%`}
        `;
        
        const matchingIds = [
          ...phoneMatches.map(m => m.id),
          ...cpfCnpjMatches.map(m => m.id)
        ];
        
        if (matchingIds.length > 0) {
          orConditions.push({ id: { in: matchingIds } });
        }
      } else {
        // Se não tem números suficientes, buscar normalmente com formatação
        orConditions.push(
          { phone: { contains: searchStr, mode: 'insensitive' } },
          { cpfCnpj: { contains: searchStr, mode: 'insensitive' } }
        );
      }
      
      where.OR = orConditions;
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take,
        include: {
          _count: {
            select: { sales: true },
          },
          referredBy: {
            select: { id: true, name: true },
          },
          sales: {
            select: {
              salePrice: true,
              saleDate: true,
            },
            orderBy: { saleDate: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    const clientsWithPurchases = clients.map((client) => {
      const totalSpent = client.sales.reduce((sum, sale) => sum + sale.salePrice, 0);
      const lastPurchase = client.sales[0]?.saleDate || null;
      
      return {
        ...client,
        purchases: client._count.sales,
        totalSpent,
        lastPurchase,
        sales: undefined, // Remove sales do response para não poluir
      };
    });

    res.json({
      success: true,
      data: clientsWithPurchases,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getClientById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const client = await prisma.client.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      select: {
        id: true,
        accountId: true,
        name: true,
        email: true,
        phone: true,
        cpfCnpj: true,
        city: true,
        state: true,
        observations: true,
        referredByClientId: true,
        referredBy: {
          select: { id: true, name: true },
        },
        createdAt: true,
        updatedAt: true,
        sales: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            salePrice: true,
            saleDate: true,
            paymentMethod: true,
            vehicle: {
              select: {
                id: true,
                brand: true,
                model: true,
                year: true,
                plate: true,
              },
            },
          },
          orderBy: { saleDate: 'desc' },
        },
      },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: { message: 'Cliente não encontrado' },
      });
      return;
    }

    // Calcular purchases, totalSpent e lastPurchase
    const purchases = client.sales.length;
    const totalSpent = client.sales.reduce((sum, sale) => sum + sale.salePrice, 0);
    const lastPurchase = client.sales[0]?.saleDate || null;

    res.json({
      success: true,
      data: {
        ...client,
        purchases,
        totalSpent,
        lastPurchase,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createClient = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    if (!accountId) {
      res.status(401).json({ success: false, error: { message: 'Não autenticado' } });
      return;
    }
    const clientData = clientSchema.parse(req.body);

    const client = await prisma.client.create({
      data: {
        ...clientData,
        accountId,
      },
    });

    res.status(201).json({
      success: true,
      data: client,
    });
  } catch (error) {
    next(error);
  }
};

export const updateClient = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const clientData = clientSchema.partial().parse(req.body);

    const client = await prisma.client.updateMany({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      data: {
        ...clientData,
        updatedAt: new Date(),
      },
    });

    if (client.count === 0) {
      res.status(404).json({
        success: false,
        error: { message: 'Cliente não encontrado' },
      });
      return;
    }

    const updatedClient = await prisma.client.findUnique({
      where: { id },
    });

    res.json({
      success: true,
      data: updatedClient,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteClient = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const client = await prisma.client.updateMany({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    if (client.count === 0) {
      res.status(404).json({
        success: false,
        error: { message: 'Cliente não encontrado' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Cliente excluído com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

export const getClientsStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;

    // Total de clientes
    const totalClients = await prisma.client.count({
      where: {
        accountId,
        deletedAt: null,
      },
    });

    const clientsWithSales = await prisma.client.findMany({
      where: {
        accountId,
        deletedAt: null,
        sales: {
          some: {
            deletedAt: null,
          },
        },
      },
      include: {
        sales: {
          where: {
            deletedAt: null,
          },
          select: {
            salePrice: true,
            saleDate: true,
          },
        },
        _count: {
          select: { sales: true },
        },
      },
    });

    // Calcular métricas e encontrar top cliente
    let totalRevenue = 0;
    let maxSpent = 0;
    let topClient: { id: string; name: string; totalSpent: number } | null = null;
    let recurringCount = 0;
    let newClientsCount = 0;

    clientsWithSales.forEach((client) => {
      const clientTotal = client.sales.reduce((sum, sale) => sum + sale.salePrice, 0);
      totalRevenue += clientTotal;
      
      if (client._count.sales === 1) {
        newClientsCount++;
      } else if (client._count.sales >= 2) {
        recurringCount++;
      }
      
      if (clientTotal > maxSpent) {
        maxSpent = clientTotal;
        topClient = {
          id: client.id,
          name: client.name,
          totalSpent: clientTotal,
        };
      }
    });

    res.json({
      success: true,
      data: {
        totalClients,
        recurringClients: recurringCount,
        newClients: newClientsCount,
        topClient,
      },
    });
  } catch (error) {
    next(error);
  }
};
