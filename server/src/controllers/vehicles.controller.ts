import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { minioService, getPublicImageUrl } from '../services/minio.service.js';
import { parseVehicleBody, vehicleUpdateSchema, normalizeVehicleUpdateBody } from '../utils/validators.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export const getVehicles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { search, status, origin, page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      accountId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (origin) {
      where.origin = origin;
    }

    if (search) {
      where.OR = [
        { brand: { contains: search as string, mode: 'insensitive' } },
        { model: { contains: search as string, mode: 'insensitive' } },
        { plate: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take,
        include: {
          images: {
            where: { deletedAt: null },
            orderBy: { order: 'asc' },
            // Retornar todas as imagens para permitir visualização completa no lightbox
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.count({ where }),
    ]);

    // Calcular dias em estoque e lucro; URLs de imagem sempre pela API (HTTPS, sem expor MinIO)
    const vehiclesWithCalculations = await Promise.all(vehicles.map(async (vehicle) => {
      const daysInStock = Math.floor(
        (Date.now() - vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Calcular total de despesas
      const totalExpenses = await prisma.expense.aggregate({
        _sum: {
          value: true,
        },
        where: {
          vehicleId: vehicle.id,
          deletedAt: null,
        },
      });
      const expensesTotal = totalExpenses._sum.value ?? 0;
      
      const purchasePrice = vehicle.purchasePrice ?? 0;
      const salePrice = vehicle.salePrice;
      let profit: number | undefined;
      let profitPercent: number | undefined;
      
      // Cálculo correto: Custo total = Preço de compra + Despesas
      // Lucro líquido = Preço de venda - Custo total
      if (salePrice !== null && salePrice !== undefined) {
        const totalCost = purchasePrice + expensesTotal;
        profit = salePrice - totalCost;
        profitPercent = totalCost > 0 ? parseFloat(((profit / totalCost) * 100).toFixed(2)) : 0;
      }
      
      const images = vehicle.images.map((img) => ({ ...img, url: getPublicImageUrl(img.key) }));

      return {
        ...vehicle,
        images,
        daysInStock,
        profit,
        profitPercent,
        totalExpenses: expensesTotal,
        image: vehicle.images[0] ? getPublicImageUrl(vehicle.images[0].key) : null,
      };
    }));

    res.json({
      success: true,
      data: vehiclesWithCalculations,
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

export const getVehicleById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: { message: 'Veículo não encontrado' },
      });
      return;
    }

    const daysInStock = Math.floor(
      (Date.now() - vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Calcular total de despesas
    const totalExpenses = await prisma.expense.aggregate({
      _sum: {
        value: true,
      },
      where: {
        vehicleId: vehicle.id,
        deletedAt: null,
      },
    });
    const expensesTotal = totalExpenses._sum.value ?? 0;
    
    const purchasePrice = vehicle.purchasePrice ?? 0;
    const salePrice = vehicle.salePrice;
    let profit: number | undefined;
    let profitPercent: number | undefined;
    
    // Cálculo correto: Custo total = Preço de compra + Despesas
    // Lucro líquido = Preço de venda - Custo total
    if (salePrice !== null && salePrice !== undefined) {
      const totalCost = purchasePrice + expensesTotal;
      profit = salePrice - totalCost;
      profitPercent = totalCost > 0 ? parseFloat(((profit / totalCost) * 100).toFixed(2)) : 0;
    }

    const images = vehicle.images.map((img) => ({ ...img, url: getPublicImageUrl(img.key) }));

    res.json({
      success: true,
      data: {
        ...vehicle,
        images,
        daysInStock,
        profit,
        profitPercent,
        totalExpenses: expensesTotal,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createVehicle = [
  upload.array('images', 10),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const files = req.files as Express.Multer.File[] | undefined;
    console.log('[POST /vehicles] Request received', {
      accountId: req.accountId,
      bodyKeys: Object.keys(req.body || {}),
      filesCount: files?.length ?? 0,
    });

    try {
      const { accountId } = req;
      if (!accountId) {
        console.error('[POST /vehicles] Missing accountId');
        res.status(401).json({ success: false, error: { message: 'Não autenticado' } });
        return;
      }

      const vehicleData = parseVehicleBody(req.body);
      console.log('[POST /vehicles] Body validated', { brand: vehicleData.brand, model: vehicleData.model });

      const vehicle = await prisma.vehicle.create({
        data: {
          ...vehicleData,
          accountId,
        },
      });
      console.log('[POST /vehicles] Vehicle created', { id: vehicle.id });

      if (files && files.length > 0) {
        console.log('[POST /vehicles] Uploading images to MinIO', { count: files.length });
        const imagePromises = files.map((file, index) =>
          minioService.uploadImage(file, vehicle.id, index)
        );
        const uploadedImages = await Promise.all(imagePromises);
        console.log('[POST /vehicles] MinIO upload done', { count: uploadedImages.length });

        await prisma.vehicleImage.createMany({
          data: uploadedImages.map((img, index) => ({
            vehicleId: vehicle.id,
            url: img.url,
            key: img.key,
            order: index,
          })),
        });
      }

      const createdVehicle = await prisma.vehicle.findUnique({
        where: { id: vehicle.id },
        include: {
          images: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        },
      });

      const data = createdVehicle
        ? {
            ...createdVehicle,
            images: createdVehicle.images.map((img) => ({ ...img, url: getPublicImageUrl(img.key) })),
          }
        : createdVehicle;

      res.status(201).json({
        success: true,
        data,
      });
      console.log('[POST /vehicles] Response sent 201', { id: vehicle.id });
    } catch (error) {
      console.error('[POST /vehicles] Error', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      next(error);
    }
  },
];

export const updateVehicle = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;
    const files = req.files as Express.Multer.File[] | undefined;

    // Processar features se vier como array do FormData
    let processedBody = { ...req.body };
    if (req.body.features) {
      if (typeof req.body.features === 'string') {
        // Se vier como string (FormData), tentar parsear
        try {
          processedBody.features = JSON.parse(req.body.features);
        } catch {
          // Se não for JSON, tratar como array simples
          processedBody.features = Array.isArray(req.body.features) ? req.body.features : [req.body.features];
        }
      } else if (!Array.isArray(req.body.features)) {
        // Se não for array, converter
        processedBody.features = [req.body.features];
      }
    }

    const raw = normalizeVehicleUpdateBody(processedBody);
    const vehicleData = vehicleUpdateSchema.parse({
      ...raw,
      year: raw.year ? parseInt(String(raw.year), 10) : undefined,
      purchasePrice: raw.purchasePrice != null ? parseFloat(String(raw.purchasePrice)) : undefined,
      salePrice: raw.salePrice != null ? parseFloat(String(raw.salePrice)) : undefined,
      fipePrice: raw.fipePrice != null ? parseFloat(String(raw.fipePrice)) : undefined,
    });

    // Verificar se o veículo existe
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!existingVehicle) {
      res.status(404).json({
        success: false,
        error: { message: 'Veículo não encontrado' },
      });
      return;
    }

    // Atualizar dados do veículo
    await prisma.vehicle.updateMany({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      data: {
        ...vehicleData,
        updatedAt: new Date(),
      },
    });

    // 1. Processar imagens para deletar (primeiro)
    let imagesToDelete: string[] = [];
    if (req.body.imagesToDelete) {
      if (Array.isArray(req.body.imagesToDelete)) {
        imagesToDelete = req.body.imagesToDelete;
      } else if (typeof req.body.imagesToDelete === 'string') {
        imagesToDelete = [req.body.imagesToDelete];
      }
    } else if (req.body['imagesToDelete[]']) {
      // FormData pode enviar arrays como imagesToDelete[]
      if (Array.isArray(req.body['imagesToDelete[]'])) {
        imagesToDelete = req.body['imagesToDelete[]'];
      } else {
        imagesToDelete = [req.body['imagesToDelete[]']];
      }
    }

    if (imagesToDelete.length > 0) {
      // Buscar imagens para deletar
      const imagesToRemove = await prisma.vehicleImage.findMany({
        where: {
          id: { in: imagesToDelete },
          vehicleId: id,
        },
      });

      // Deletar do MinIO
      await Promise.allSettled(
        imagesToRemove.map((img) => minioService.deleteImage(img.key))
      );

      // Deletar do banco
      await prisma.vehicleImage.deleteMany({
        where: {
          id: { in: imagesToDelete },
          vehicleId: id,
        },
      });
    }

    // 2. Upload de novas imagens
    let newImageIds: string[] = [];
    if (files && files.length > 0) {
      const imagePromises = files.map((file, index) =>
        minioService.uploadImage(file, id, existingVehicle.images.length + index)
      );
      const uploadedImages = await Promise.all(imagePromises);

      await prisma.vehicleImage.createMany({
        data: uploadedImages.map((img, index) => ({
          vehicleId: id,
          url: img.url,
          key: img.key,
          order: existingVehicle.images.length + index,
          sizeBytes: img.sizeBytes ?? undefined,
        })),
      });

      // Buscar IDs das imagens recém-criadas
      const newImages = await prisma.vehicleImage.findMany({
        where: {
          vehicleId: id,
          key: { in: uploadedImages.map(img => img.key) },
        },
      });
      newImageIds = newImages.map(img => img.id);
    }

    // 3. Processar ordem de todas as imagens (existentes + novas)
    let imageOrder: Array<{ id: string; order: number }> = [];
    if (req.body.imageOrder) {
      try {
        imageOrder = typeof req.body.imageOrder === 'string' 
          ? JSON.parse(req.body.imageOrder)
          : req.body.imageOrder;
      } catch (e) {
        console.error('[updateVehicle] Error parsing imageOrder:', e);
      }
    }

    // Se há reordenação ou novas imagens, aplicar ordem
    if (imageOrder.length > 0 || newImageIds.length > 0) {
      // Atualizar ordem das imagens existentes
      if (imageOrder.length > 0) {
        await Promise.all(
          imageOrder.map((item: { id: string; order: number }) =>
            prisma.vehicleImage.updateMany({
              where: {
                id: item.id,
                vehicleId: id,
              },
              data: {
                order: item.order,
              },
            })
          )
        );
      }

      // Atualizar ordem das novas imagens (se houver)
      // As novas imagens devem ser colocadas após as existentes reordenadas
      if (newImageIds.length > 0) {
        // Contar quantas imagens existentes temos após a reordenação
        const maxExistingOrder = imageOrder.length > 0 
          ? Math.max(...imageOrder.map((item: { id: string; order: number }) => item.order))
          : -1;
        
        await Promise.all(
          newImageIds.map((imageId, index) =>
            prisma.vehicleImage.updateMany({
              where: {
                id: imageId,
                vehicleId: id,
              },
              data: {
                order: maxExistingOrder + 1 + index,
              },
            })
          )
        );
      }
    }


    // Buscar veículo atualizado com imagens
    const updatedVehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });

    const data = updatedVehicle
      ? {
          ...updatedVehicle,
          images: updatedVehicle.images.map((img) => ({ ...img, url: getPublicImageUrl(img.key) })),
        }
      : updatedVehicle;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVehicle = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      include: { 
        images: { where: { deletedAt: null } },
        expenses: { where: { deletedAt: null } },
        sales: { where: { deletedAt: null } },
        checklists: { where: { deletedAt: null } },
      },
    });

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: { message: 'Veículo não encontrado' },
      });
      return;
    }

    // 1. Remove all images from MinIO immediately (storage cleanup)
    if (vehicle.images.length > 0) {
      const results = await Promise.allSettled(
        vehicle.images.map((img) => minioService.deleteImage(img.key))
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        console.warn(
          '[deleteVehicle] MinIO: some objects could not be removed',
          failed.map((r) => (r as PromiseRejectedResult).reason)
        );
      }
    }

    // 2-6. Delete all related data and vehicle in a transaction (hard delete)
    await prisma.$transaction(async (tx) => {
      // Delete all related expenses
      await tx.expense.deleteMany({
        where: {
          vehicleId: id,
          accountId,
        },
      });

      // Delete all related sales
      await tx.sale.deleteMany({
        where: {
          vehicleId: id,
          accountId,
        },
      });

      // Delete all related checklists (ChecklistItem has onDelete: Cascade, so items will be deleted automatically)
      await tx.checklist.deleteMany({
        where: {
          vehicleId: id,
          accountId,
        },
      });

      // Delete all vehicle images from database (VehicleImage has onDelete: Cascade, but we delete explicitly for clarity)
      await tx.vehicleImage.deleteMany({
        where: {
          vehicleId: id,
        },
      });

      // Delete the vehicle itself
      await tx.vehicle.delete({
        where: {
          id,
      },
      });
    });

    res.json({
      success: true,
      message: 'Veículo e todas as informações relacionadas foram excluídas com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

export const addVehicleImage = [
  upload.single('image'),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = req;
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          error: { message: 'Nenhuma imagem fornecida' },
        });
        return;
      }

      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id,
          accountId,
          deletedAt: null,
        },
      });

      if (!vehicle) {
        res.status(404).json({
          success: false,
          error: { message: 'Veículo não encontrado' },
        });
        return;
      }

      // Contar imagens existentes (não deletadas) para definir ordem
      const imageCount = await prisma.vehicleImage.count({
        where: { vehicleId: id, deletedAt: null },
      });

      const { url, key, sizeBytes } = await minioService.uploadImage(file, id, imageCount);

      const image = await prisma.vehicleImage.create({
        data: {
          vehicleId: id,
          url,
          key,
          order: imageCount,
          sizeBytes: sizeBytes ?? undefined,
        },
      });

      res.status(201).json({
        success: true,
        data: { ...image, url: getPublicImageUrl(image.key) },
      });
    } catch (error) {
      next(error);
    }
  },
];

export const getVehiclesMetrics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;

    const whereBase: any = {
      accountId,
      deletedAt: null,
    };

    const [totalVehicles, totalSold, totalInStock, vehiclesForCalculations] = await Promise.all([
      prisma.vehicle.count({
        where: whereBase,
      }),
      prisma.vehicle.count({
        where: {
          ...whereBase,
          status: 'sold',
        },
      }),
      prisma.vehicle.count({
        where: {
          ...whereBase,
          status: { in: ['available', 'reserved'] },
        },
      }),
      prisma.vehicle.findMany({
        where: whereBase,
        select: {
          id: true,
          purchasePrice: true,
          salePrice: true,
          createdAt: true,
          status: true,
        },
      }),
    ]);

    // Calcular total investido (purchasePrice + despesas de todos os veículos)
    let totalInvested = 0;
    let totalExpectedProfit = 0;
    let totalDaysInStock = 0;
    let vehiclesWithDays = 0;

    for (const vehicle of vehiclesForCalculations) {
      const expenses = await prisma.expense.aggregate({
        _sum: {
          value: true,
        },
        where: {
          vehicleId: vehicle.id,
          deletedAt: null,
        },
      });
      const expensesTotal = expenses._sum.value ?? 0;
      const purchasePrice = vehicle.purchasePrice ?? 0;
      const totalCost = purchasePrice + expensesTotal;
      totalInvested += totalCost;

      // Lucro previsto (apenas para veículos em estoque com preço de venda)
      if (vehicle.status !== 'sold' && vehicle.salePrice) {
        totalExpectedProfit += vehicle.salePrice - totalCost;
      }

      // Tempo médio em estoque
      const daysInStock = Math.floor(
        (Date.now() - vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalDaysInStock += daysInStock;
      vehiclesWithDays++;
    }

    const avgDaysInStock = vehiclesWithDays > 0 ? Math.round(totalDaysInStock / vehiclesWithDays) : 0;

    res.json({
      success: true,
      data: {
        totalVehicles,
        totalSold,
        totalInStock,
        totalInvested,
        avgDaysInStock,
        totalExpectedProfit,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVehicleImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id, imageId } = req.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
    });

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: { message: 'Veículo não encontrado' },
      });
      return;
    }

    const image = await prisma.vehicleImage.findUnique({
      where: { id: imageId },
    });

    if (!image || image.vehicleId !== id) {
      res.status(404).json({
        success: false,
        error: { message: 'Imagem não encontrada' },
      });
      return;
    }

    // Deletar do MinIO
    await minioService.deleteImage(image.key);

    // Deletar do banco
    await prisma.vehicleImage.delete({
      where: { id: imageId },
    });

    res.json({
      success: true,
      message: 'Imagem excluída com sucesso',
    });
  } catch (error) {
    next(error);
  }
};
