import { z } from 'zod';
import { parseDateStringAsBrazilDay } from './timezone.js';

const FUEL_OPTIONS = ['Flex', 'Gasolina', 'Etanol', 'Diesel', 'Elétrico', 'Híbrido'] as const;
const FUEL_NORMALIZE: Record<string, (typeof FUEL_OPTIONS)[number]> = {
  flex: 'Flex',
  gasolina: 'Gasolina',
  etanol: 'Etanol',
  diesel: 'Diesel',
  eletrico: 'Elétrico',
  elétrico: 'Elétrico',
  hibrido: 'Híbrido',
  híbrido: 'Híbrido',
};

function normalizeFuel(val: unknown): (typeof FUEL_OPTIONS)[number] {
  const s = typeof val === 'string' ? val.trim().toLowerCase() : '';
  return FUEL_NORMALIZE[s] ?? (val as (typeof FUEL_OPTIONS)[number]);
}

const TRANSMISSION_OPTIONS = ['Manual', 'Automático', 'CVT'] as const;
const STEERING_OPTIONS = ['Normal', 'hidráulica', 'elétrica'] as const;
const ORIGIN_OPTIONS = ['own', 'consignment', 'repass'] as const;
const COMMISSION_TYPE_OPTIONS = ['percentual', 'fixed'] as const;

const vehicleSchemaBase = z.object({
  vehicleType: z.enum(['car', 'motorcycle']).default('car'),
  brand: z.string().min(1, 'Marca é obrigatória'),
  model: z.string().min(1, 'Modelo é obrigatório'),
  version: z.string().optional(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 2, 'Ano deve ser no máximo ano modelo + 1'),
  km: z.number().int().min(0).optional(),
  plate: z.string().optional(),
  fuel: z.enum(FUEL_OPTIONS),
  color: z.string().min(1, 'Cor é obrigatória'),
  transmission: z.enum(TRANSMISSION_OPTIONS).optional(),
  steering: z.enum(STEERING_OPTIONS).optional(),
  origin: z.enum(ORIGIN_OPTIONS).default('own'),
  features: z.array(z.string()).default([]),
  purchasePrice: z.number().positive('Preço de compra deve ser positivo').optional(),
  salePrice: z.number().positive('Preço de venda deve ser positivo').optional(),
  fipePrice: z.number().positive('Preço FIPE deve ser positivo').optional(),
  description: z.string().optional(),
  status: z.enum(['available', 'reserved', 'sold']).optional(),
  // Dados de consignado
  consignmentOwnerName: z.string().optional(),
  consignmentOwnerPhone: z.string().optional(),
  consignmentCommissionType: z.enum(COMMISSION_TYPE_OPTIONS).optional(),
  consignmentCommissionValue: z.number().min(0).optional(),
  consignmentMinRepassValue: z.number().min(0).optional(),
  consignmentStartDate: z.date().optional(),
  purchaseDate: z.date().optional(), // Data de cadastro do veículo (permite retroativa)
});

/** Schema para validação de update (campos opcionais). */
export const vehicleUpdateSchema = vehicleSchemaBase.partial();

export const vehicleSchema = vehicleSchemaBase.refine((data) => {
  // Se for próprio, purchasePrice e salePrice são obrigatórios
  if (data.origin === 'own') {
    return data.purchasePrice !== undefined && data.salePrice !== undefined;
  }
  // Se for consignado, validações específicas
  if (data.origin === 'consignment') {
    if (!data.consignmentOwnerName) return false;
    if (!data.consignmentCommissionType) return false;
    if (data.consignmentCommissionValue === undefined) return false;
    if (data.consignmentMinRepassValue === undefined) return false;
  }
  return true;
}, {
  message: 'Campos obrigatórios não preenchidos conforme a origem do veículo',
});

export function parseVehicleBody(body: unknown): z.infer<typeof vehicleSchema> {
  const raw = typeof body === 'object' && body !== null ? body : {};
  const obj = { ...raw } as Record<string, unknown>;
  if (typeof obj.fuel === 'string') {
    obj.fuel = normalizeFuel(obj.fuel);
  }
  
  // Processar features que podem vir como array ou como features[0], features[1], etc do FormData
  let features: string[] = [];
  if (Array.isArray(obj.features)) {
    features = obj.features as string[];
  } else if (obj.features !== undefined && obj.features !== null) {
    features = [String(obj.features)];
  } else {
    // Tentar extrair features[0], features[1], etc
    const featureKeys = Object.keys(obj).filter(key => key.startsWith('features['));
    if (featureKeys.length > 0) {
      features = featureKeys
        .map(key => {
          const match = key.match(/^features\[(\d+)\]$/);
          if (match) {
            const index = parseInt(match[1], 10);
            return { index, value: String(obj[key]) };
          }
          return null;
        })
        .filter((item): item is { index: number; value: string } => item !== null)
        .sort((a, b) => a.index - b.index)
        .map(item => item.value);
    }
  }
  
  const parsed: Record<string, unknown> = {
    ...obj,
    year: parseInt(String(obj.year), 10),
    features,
  };
  
  if (obj.km !== undefined && obj.km !== null && obj.km !== '') {
    parsed.km = parseInt(String(obj.km), 10);
  }
  
  if (obj.purchasePrice !== undefined && obj.purchasePrice !== null && obj.purchasePrice !== '') {
    parsed.purchasePrice = parseFloat(String(obj.purchasePrice));
  }
  
  if (obj.salePrice !== undefined && obj.salePrice !== null && obj.salePrice !== '') {
    parsed.salePrice = parseFloat(String(obj.salePrice));
  }
  
  if (obj.fipePrice !== undefined && obj.fipePrice !== null && obj.fipePrice !== '') {
    parsed.fipePrice = parseFloat(String(obj.fipePrice));
  }
  
  if (obj.consignmentCommissionValue !== undefined && obj.consignmentCommissionValue !== null && obj.consignmentCommissionValue !== '') {
    parsed.consignmentCommissionValue = parseFloat(String(obj.consignmentCommissionValue));
  }
  
  if (obj.consignmentMinRepassValue !== undefined && obj.consignmentMinRepassValue !== null && obj.consignmentMinRepassValue !== '') {
    parsed.consignmentMinRepassValue = parseFloat(String(obj.consignmentMinRepassValue));
  }
  
  if (obj.consignmentStartDate !== undefined && obj.consignmentStartDate !== null && obj.consignmentStartDate !== '') {
    parsed.consignmentStartDate = new Date(obj.consignmentStartDate as string);
  }
  
  if (obj.purchaseDate !== undefined && obj.purchaseDate !== null && obj.purchaseDate !== '') {
    // Parse como data no fuso Brasil (meio-dia para evitar problemas de timezone)
    const dateStr = String(obj.purchaseDate);
    parsed.purchaseDate = dateStr.length <= 10 
      ? parseDateStringAsBrazilDay(dateStr)
      : new Date(dateStr);
  }
  
  return vehicleSchema.parse(parsed);
}

/** Normaliza body para update (fuel quando enviado). */
export function normalizeVehicleUpdateBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  if (typeof out.fuel === 'string') {
    out.fuel = normalizeFuel(out.fuel);
  }
  if (out.km !== undefined && out.km !== null && out.km !== '') {
    out.km = parseInt(String(out.km), 10);
  }
  if (out.purchasePrice !== undefined && out.purchasePrice !== null && out.purchasePrice !== '') {
    out.purchasePrice = parseFloat(String(out.purchasePrice));
  }
  if (out.salePrice !== undefined && out.salePrice !== null && out.salePrice !== '') {
    out.salePrice = parseFloat(String(out.salePrice));
  }
  if (out.fipePrice !== undefined && out.fipePrice !== null && out.fipePrice !== '') {
    out.fipePrice = parseFloat(String(out.fipePrice));
  }
  if (out.consignmentCommissionValue !== undefined && out.consignmentCommissionValue !== null && out.consignmentCommissionValue !== '') {
    out.consignmentCommissionValue = parseFloat(String(out.consignmentCommissionValue));
  }
  if (out.consignmentMinRepassValue !== undefined && out.consignmentMinRepassValue !== null && out.consignmentMinRepassValue !== '') {
    out.consignmentMinRepassValue = parseFloat(String(out.consignmentMinRepassValue));
  }
  if (out.consignmentStartDate !== undefined && out.consignmentStartDate !== null && out.consignmentStartDate !== '') {
    out.consignmentStartDate = new Date(out.consignmentStartDate as string);
  }
  if (out.purchaseDate !== undefined && out.purchaseDate !== null && out.purchaseDate !== '') {
    // Parse como data no fuso Brasil (meio-dia para evitar problemas de timezone)
    const dateStr = String(out.purchaseDate);
    out.purchaseDate = dateStr.length <= 10 
      ? parseDateStringAsBrazilDay(dateStr)
      : new Date(dateStr);
  }
  if (Array.isArray(out.features)) {
    out.features = out.features;
  }
  return out;
}

const PAYMENT_METHOD_OPTIONS = ['PIX', 'DINHEIRO', 'CARTÃO DE CRÉDITO', 'FINANCIAMENTO', 'TROCA'] as const;
const PAYMENT_METHOD_NORMALIZE: Record<string, (typeof PAYMENT_METHOD_OPTIONS)[number]> = {
  pix: 'PIX',
  dinheiro: 'DINHEIRO',
  'cartão de crédito': 'CARTÃO DE CRÉDITO',
  'cartao de credito': 'CARTÃO DE CRÉDITO',
  'cartão': 'CARTÃO DE CRÉDITO',
  cartao: 'CARTÃO DE CRÉDITO',
  credito: 'CARTÃO DE CRÉDITO',
  crédito: 'CARTÃO DE CRÉDITO',
  financiamento: 'FINANCIAMENTO',
  troca: 'TROCA',
  // Compatibilidade com valores antigos
  'a vista': 'DINHEIRO',
  'à vista': 'DINHEIRO',
  avista: 'DINHEIRO',
  consorcio: 'FINANCIAMENTO',
  consórcio: 'FINANCIAMENTO',
};

function normalizePaymentMethod(val: unknown): (typeof PAYMENT_METHOD_OPTIONS)[number] {
  const s = typeof val === 'string' ? val.trim().toLowerCase() : '';
  return PAYMENT_METHOD_NORMALIZE[s] ?? (val as (typeof PAYMENT_METHOD_OPTIONS)[number]);
}

const EXPENSE_STATUS_OPTIONS = ['pending', 'paid'] as const;
const EXPENSE_STATUS_NORMALIZE: Record<string, (typeof EXPENSE_STATUS_OPTIONS)[number]> = {
  pendente: 'pending',
  pago: 'paid',
};

function normalizeExpenseStatus(val: unknown): (typeof EXPENSE_STATUS_OPTIONS)[number] | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const s = typeof val === 'string' ? val.trim().toLowerCase() : '';
  return EXPENSE_STATUS_NORMALIZE[s] ?? (val as (typeof EXPENSE_STATUS_OPTIONS)[number]);
}

const CHECKLIST_STATUS_OPTIONS = ['pending', 'in_progress', 'completed'] as const;
const CHECKLIST_STATUS_NORMALIZE: Record<string, (typeof CHECKLIST_STATUS_OPTIONS)[number]> = {
  pendente: 'pending',
  'em andamento': 'in_progress',
  andamento: 'in_progress',
  concluido: 'completed',
  concluído: 'completed',
};

function normalizeChecklistStatus(val: unknown): (typeof CHECKLIST_STATUS_OPTIONS)[number] | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const s = typeof val === 'string' ? val.trim().toLowerCase() : '';
  return CHECKLIST_STATUS_NORMALIZE[s] ?? (val as (typeof CHECKLIST_STATUS_OPTIONS)[number]);
}

export const saleSchema = z.object({
  vehicleId: z.string().min(1, 'ID do veículo é obrigatório'),
  clientId: z.string().optional(),
  salePrice: z.number().positive('Preço de venda deve ser positivo'),
  paymentMethod: z.string().min(1, 'Forma de pagamento é obrigatória'), // Aceita múltiplas formas separadas por vírgula
  saleDate: z.date().optional(),
  registeredById: z.string().optional(),
});

export function parseSaleBody(body: unknown): z.infer<typeof saleSchema> {
  const raw = typeof body === 'object' && body !== null ? body : {};
  const obj = { ...raw } as Record<string, unknown>;
  // Aceita múltiplas formas de pagamento separadas por vírgula
  // Não normaliza mais, apenas valida que é uma string não vazia
  if (typeof obj.paymentMethod === 'string') {
    obj.paymentMethod = obj.paymentMethod.trim();
  }
  return saleSchema.parse({
    ...obj,
    salePrice: parseFloat(String(obj.salePrice)),
    saleDate: obj.saleDate ? new Date(obj.saleDate as string) : undefined,
  });
}

export function normalizeSaleUpdateBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  // Aceita múltiplas formas de pagamento separadas por vírgula
  // Apenas trim, sem normalizar para um único valor
  if (typeof out.paymentMethod === 'string') {
    out.paymentMethod = out.paymentMethod.trim();
  }
  if (out.salePrice !== undefined) out.salePrice = parseFloat(String(out.salePrice));
  if (out.saleDate !== undefined) {
    const v = out.saleDate as string;
    out.saleDate = typeof v === 'string' && v.length <= 10 ? parseDateStringAsBrazilDay(v) : new Date(v);
  }
  return out;
}

export const expenseSchema = z.object({
  vehicleId: z.string().optional(),
  type: z.string().min(1, 'Tipo é obrigatório'),
  value: z.number().positive('Valor deve ser positivo'),
  description: z.string().optional(),
  date: z.date().optional(),
  status: z.enum(EXPENSE_STATUS_OPTIONS).optional(),
});

export function parseExpenseBody(body: unknown): z.infer<typeof expenseSchema> {
  const raw = typeof body === 'object' && body !== null ? body : {};
  const obj = { ...raw } as Record<string, unknown>;
  if (obj.status !== undefined) {
    obj.status = normalizeExpenseStatus(obj.status);
  }
  return expenseSchema.parse({
    ...obj,
    value: parseFloat(String(obj.value)),
    date: obj.date ? new Date(obj.date as string) : undefined,
  });
}

export function normalizeExpenseUpdateBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  if (out.status !== undefined) out.status = normalizeExpenseStatus(out.status);
  if (out.value !== undefined) out.value = parseFloat(String(out.value));
  if (out.date !== undefined) out.date = new Date(out.date as string);
  return out;
}

export const clientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  cpfCnpj: z.string().optional(),
  zipCode: z.string().optional(), // CEP
  street: z.string().optional(), // Rua/Logradouro
  number: z.string().optional(), // Número
  complement: z.string().optional(), // Complemento
  neighborhood: z.string().optional(), // Bairro
  city: z.string().optional(),
  state: z.string().optional(), // UF (AC, AL, AP, etc.)
  observations: z.string().optional(),
  referredByClientId: z.string().cuid().optional().nullable(),
});

export const checklistSchema = z.object({
  vehicleId: z.string().min(1, 'ID do veículo é obrigatório'),
  items: z.array(z.object({
    name: z.string().min(1, 'Nome do item é obrigatório'),
    done: z.boolean().optional(),
  })),
  status: z.enum(CHECKLIST_STATUS_OPTIONS).optional(),
});

export function parseChecklistBody(body: unknown): z.infer<typeof checklistSchema> {
  const raw = typeof body === 'object' && body !== null ? body : {};
  const obj = { ...raw } as Record<string, unknown>;
  if (obj.status !== undefined) {
    obj.status = normalizeChecklistStatus(obj.status);
  }
  return checklistSchema.parse(obj);
}

export function normalizeChecklistUpdateBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  if (out.status !== undefined) out.status = normalizeChecklistStatus(out.status);
  return out;
}
