import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { minioService, getPublicImageUrl } from '../services/minio.service.js';
import { z } from 'zod';

const settingsSchema = z.object({
  defaultChecklist: z.array(z.object({
    name: z.string(),
    enabled: z.boolean(),
    order: z.number(),
  })).optional(),
  expenseCategories: z.array(z.string()).optional(),
  expenseRequiresVehicle: z.boolean().optional(),
  recurringClientThreshold: z.number().optional(),
  alerts: z.object({
    checklistComplete: z.boolean().optional(),
    daysInStock: z.number().optional(), // 0 = desabilitado
    lowProfit: z.number().optional(), // 0 = desabilitado, valor em %
  }).optional(),
});

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal(''));

const storeInfoSchema = z.object({
  // Nome fantasia (exibido)
  name: z.string().min(1),
  // Dados fiscais
  legalName: z.string().optional(),
  tradeName: z.string().optional(),
  cpfCnpj: z.string().optional(),
  stateRegistration: z.string().optional(),
  // Endereço
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  // Contato (aceita vazio ou formato válido; não quebra com texto parcial)
  email: z.string().max(255).optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  // Presença digital (aceita qualquer texto; URL completa não obrigatória)
  website: z.string().max(2000).optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  // Identidade visual
  logo: z.string().optional(),
  logoDark: z.string().optional(),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  // Configuração de relatórios
  reportResponsible: z.string().optional(),
  reportCurrency: z.string().optional(),
  reportDateFormat: z.enum(['DD/MM', 'MM/DD']).optional(),
  reportThousandSeparator: z.string().optional(),
  reportShowCents: z.boolean().optional(),
  reportIncludeLegalNotice: z.boolean().optional(),
  reportLegalNoticeText: z.string().optional(),
});

export const getSettings = async (
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

    const account = await prisma.account.findFirst({
      where: { id: accountId, deletedAt: null },
      select: {
        id: true,
        name: true,
        storeLegalName: true,
        storeTradeName: true,
        storeCpfCnpj: true,
        storeStateRegistration: true,
        storeStreet: true,
        storeNumber: true,
        storeComplement: true,
        storeNeighborhood: true,
        storeZipCode: true,
        storeCity: true,
        storeState: true,
        storeEmail: true,
        storePhone: true,
        storeWhatsApp: true,
        storeWebsite: true,
        storeInstagram: true,
        storeFacebook: true,
        storeLogo: true,
        storeLogoDark: true,
        storePrimaryColor: true,
        storeSecondaryColor: true,
        reportResponsible: true,
        reportCurrency: true,
        reportDateFormat: true,
        reportThousandSeparator: true,
        reportShowCents: true,
        reportIncludeLegalNotice: true,
        reportLegalNoticeText: true,
        settings: true,
      },
    });

    if (!account) {
      res.status(404).json({ success: false, error: { message: 'Conta não encontrada' } });
      return;
    }

    const defaultSettings = {
      defaultChecklist: [
        { name: 'Documentação', enabled: true, order: 0 },
        { name: 'Revisão', enabled: true, order: 1 },
        { name: 'Lavagem', enabled: true, order: 2 },
        { name: 'Polimento', enabled: true, order: 3 },
        { name: 'Fotos', enabled: true, order: 4 },
        { name: 'Anúncio', enabled: true, order: 5 },
      ],
      expenseCategories: ['Funilaria', 'Pneus', 'Documento', 'Troca de óleo', 'Pastilhas de freio', 'Lavagem', 'Polimento'],
      expenseRequiresVehicle: false,
      recurringClientThreshold: 2,
      alerts: {
        checklistComplete: false,
        daysInStock: 0,
        lowProfit: 0,
      },
    };

    const settings = account.settings as typeof defaultSettings | null || defaultSettings;

    res.json({
      success: true,
      data: {
        store: {
          name: account.name || '',
          legalName: account.storeLegalName || '',
          tradeName: account.storeTradeName || '',
          cpfCnpj: account.storeCpfCnpj || '',
          stateRegistration: account.storeStateRegistration || '',
          street: account.storeStreet || '',
          number: account.storeNumber || '',
          complement: account.storeComplement || '',
          neighborhood: account.storeNeighborhood || '',
          zipCode: account.storeZipCode || '',
          city: account.storeCity || '',
          state: account.storeState || '',
          email: account.storeEmail || '',
          phone: account.storePhone || '',
          whatsapp: account.storeWhatsApp || '',
          website: account.storeWebsite || '',
          instagram: account.storeInstagram || '',
          facebook: account.storeFacebook || '',
          logo: account.storeLogo || '',
          logoDark: account.storeLogoDark || '',
          primaryColor: account.storePrimaryColor || '',
          secondaryColor: account.storeSecondaryColor || '',
        },
        report: {
          responsible: account.reportResponsible || '',
          currency: account.reportCurrency || 'BRL',
          dateFormat: account.reportDateFormat || 'DD/MM',
          thousandSeparator: account.reportThousandSeparator ?? ',',
          showCents: account.reportShowCents ?? true,
          includeLegalNotice: account.reportIncludeLegalNotice ?? true,
          legalNoticeText: account.reportLegalNoticeText ?? '',
        },
        settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStoreInfo = async (
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

    const body = storeInfoSchema.parse(req.body);

    const currentAccount = await prisma.account.findFirst({
      where: { id: accountId },
      select: { name: true },
    });

    const toNull = (v: string | undefined) => (v === '' || v === undefined ? null : v);
    const updateData: Record<string, unknown> = {
      name: body.name?.trim() || currentAccount?.name || 'Minha Loja',
      storeLegalName: body.legalName !== undefined ? toNull(body.legalName) : undefined,
      storeTradeName: body.tradeName !== undefined ? toNull(body.tradeName) : undefined,
      storeCpfCnpj: body.cpfCnpj !== undefined ? (body.cpfCnpj ? body.cpfCnpj.replace(/\D/g, '').slice(0, 14) : null) : undefined,
      storeStateRegistration: body.stateRegistration !== undefined ? toNull(body.stateRegistration) : undefined,
      storeStreet: body.street !== undefined ? toNull(body.street) : undefined,
      storeNumber: body.number !== undefined ? toNull(body.number) : undefined,
      storeComplement: body.complement !== undefined ? toNull(body.complement) : undefined,
      storeNeighborhood: body.neighborhood !== undefined ? toNull(body.neighborhood) : undefined,
      storeZipCode: body.zipCode !== undefined ? (body.zipCode ? body.zipCode.replace(/\D/g, '').slice(0, 8) : null) : undefined,
      storeCity: body.city !== undefined ? toNull(body.city) : undefined,
      storeState: body.state !== undefined ? toNull(body.state) : undefined,
      storeEmail: body.email !== undefined ? toNull(body.email) : undefined,
      storePhone: body.phone !== undefined ? toNull(body.phone) : undefined,
      storeWhatsApp: body.whatsapp !== undefined ? toNull(body.whatsapp) : undefined,
      storeWebsite: body.website !== undefined ? toNull(body.website) : undefined,
      storeInstagram: body.instagram !== undefined ? toNull(body.instagram) : undefined,
      storeFacebook: body.facebook !== undefined ? toNull(body.facebook) : undefined,
      storeLogo: body.logo !== undefined ? toNull(body.logo) : undefined,
      storeLogoDark: body.logoDark !== undefined ? toNull(body.logoDark) : undefined,
      storePrimaryColor: body.primaryColor !== undefined ? toNull(body.primaryColor) : undefined,
      storeSecondaryColor: body.secondaryColor !== undefined ? toNull(body.secondaryColor) : undefined,
      reportResponsible: body.reportResponsible !== undefined ? toNull(body.reportResponsible) : undefined,
      reportCurrency: body.reportCurrency !== undefined ? body.reportCurrency : undefined,
      reportDateFormat: body.reportDateFormat !== undefined ? body.reportDateFormat : undefined,
      reportThousandSeparator: body.reportThousandSeparator !== undefined ? body.reportThousandSeparator : undefined,
      reportShowCents: body.reportShowCents !== undefined ? body.reportShowCents : undefined,
      reportIncludeLegalNotice: body.reportIncludeLegalNotice !== undefined ? body.reportIncludeLegalNotice : undefined,
      reportLegalNoticeText: body.reportLegalNoticeText !== undefined ? toNull(body.reportLegalNoticeText) : undefined,
    };
    const clean = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    ) as Parameters<typeof prisma.account.update>[0]['data'];

    const account = await prisma.account.update({
      where: { id: accountId },
      data: clean,
      select: {
        id: true,
        name: true,
        storeLegalName: true,
        storeTradeName: true,
        storeCpfCnpj: true,
        storeStateRegistration: true,
        storeStreet: true,
        storeNumber: true,
        storeComplement: true,
        storeNeighborhood: true,
        storeZipCode: true,
        storeCity: true,
        storeState: true,
        storeEmail: true,
        storePhone: true,
        storeWhatsApp: true,
        storeWebsite: true,
        storeInstagram: true,
        storeFacebook: true,
        storeLogo: true,
        storeLogoDark: true,
        storePrimaryColor: true,
        storeSecondaryColor: true,
        reportResponsible: true,
        reportCurrency: true,
        reportDateFormat: true,
        reportThousandSeparator: true,
        reportShowCents: true,
        reportIncludeLegalNotice: true,
        reportLegalNoticeText: true,
      },
    });

    const empty = (s: string | null) => s ?? '';
    res.json({
      success: true,
      data: {
        store: {
          name: account.name || '',
          legalName: empty(account.storeLegalName),
          tradeName: empty(account.storeTradeName),
          cpfCnpj: empty(account.storeCpfCnpj),
          stateRegistration: empty(account.storeStateRegistration),
          street: empty(account.storeStreet),
          number: empty(account.storeNumber),
          complement: empty(account.storeComplement),
          neighborhood: empty(account.storeNeighborhood),
          zipCode: empty(account.storeZipCode),
          city: empty(account.storeCity),
          state: empty(account.storeState),
          email: empty(account.storeEmail),
          phone: empty(account.storePhone),
          whatsapp: empty(account.storeWhatsApp),
          website: empty(account.storeWebsite),
          instagram: empty(account.storeInstagram),
          facebook: empty(account.storeFacebook),
          logo: empty(account.storeLogo),
          logoDark: empty(account.storeLogoDark),
          primaryColor: empty(account.storePrimaryColor),
          secondaryColor: empty(account.storeSecondaryColor),
        },
        report: {
          responsible: empty(account.reportResponsible),
          currency: account.reportCurrency || 'BRL',
          dateFormat: account.reportDateFormat || 'DD/MM',
          thousandSeparator: account.reportThousandSeparator ?? ',',
          showCents: account.reportShowCents ?? true,
          includeLegalNotice: account.reportIncludeLegalNotice ?? true,
          legalNoticeText: empty(account.reportLegalNoticeText),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadStoreLogo = async (
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
    const file = req.file;
    if (!file || !file.buffer) {
      res.status(400).json({ success: false, error: { message: 'Nenhum arquivo enviado' } });
      return;
    }
    const { key } = await minioService.uploadStoreLogo(accountId, file);
    const logoUrl = getPublicImageUrl(key);
    await prisma.account.update({
      where: { id: accountId },
      data: { storeLogo: logoUrl },
      select: { storeLogo: true },
    });
    res.json({
      success: true,
      data: { store: { logo: logoUrl } },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadStoreLogoDark = async (
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
    const file = req.file;
    if (!file || !file.buffer) {
      res.status(400).json({ success: false, error: { message: 'Nenhum arquivo enviado' } });
      return;
    }
    const { key } = await minioService.uploadStoreLogoDark(accountId, file);
    const logoUrl = getPublicImageUrl(key);
    await prisma.account.update({
      where: { id: accountId },
      data: { storeLogoDark: logoUrl },
      select: { storeLogoDark: true },
    });
    res.json({
      success: true,
      data: { store: { logoDark: logoUrl } },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (
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

    const body = settingsSchema.parse(req.body);

    const account = await prisma.account.findFirst({
      where: { id: accountId, deletedAt: null },
      select: { settings: true },
    });

    const currentSettings = (account?.settings as any) || {};
    const updatedSettings = {
      ...currentSettings,
      ...body,
    };

    await prisma.account.update({
      where: { id: accountId },
      data: { settings: updatedSettings },
    });

    res.json({
      success: true,
      data: { settings: updatedSettings },
    });
  } catch (error) {
    next(error);
  }
};
