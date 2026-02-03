import { getCachedData, setCachedData } from './fipe-cache.service.js';

const FIPE_API_BASE = 'https://parallelum.com.br/fipe/api/v1';

type VehicleType = 'carros' | 'motos';

interface FipeBrand {
  codigo: string;
  nome: string;
}

interface FipeModel {
  codigo: string;
  nome: string;
}

interface FipeYear {
  codigo: string;
  nome: string;
}

interface FipePrice {
  TipoVeiculo: number;
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
  SiglaCombustivel: string;
}

async function fetchFromApi<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FIPE API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function getBrands(vehicleType: VehicleType): Promise<FipeBrand[]> {
  const cacheKey = `fipe-brands-${vehicleType}`;
  
  // Tentar buscar do cache
  const cached = await getCachedData<FipeBrand[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Buscar da API
  const url = `${FIPE_API_BASE}/${vehicleType}/marcas`;
  const brands = await fetchFromApi<FipeBrand[]>(url);
  
  // Salvar no cache
  await setCachedData(cacheKey, brands);
  
  return brands;
}

export async function getModels(
  vehicleType: VehicleType,
  brandId: string
): Promise<FipeModel[]> {
  const cacheKey = `fipe-models-${vehicleType}-${brandId}`;
  
  // Tentar buscar do cache
  const cached = await getCachedData<FipeModel[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Buscar da API
  const url = `${FIPE_API_BASE}/${vehicleType}/marcas/${brandId}/modelos`;
  const response = await fetchFromApi<{ modelos: FipeModel[]; anos: unknown[] }>(url);
  
  // Salvar no cache
  await setCachedData(cacheKey, response.modelos);
  
  return response.modelos;
}

export async function getYears(
  vehicleType: VehicleType,
  brandId: string,
  modelId: string
): Promise<FipeYear[]> {
  const cacheKey = `fipe-years-${vehicleType}-${brandId}-${modelId}`;
  
  // Tentar buscar do cache
  const cached = await getCachedData<FipeYear[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Buscar da API
  const url = `${FIPE_API_BASE}/${vehicleType}/marcas/${brandId}/modelos/${modelId}/anos`;
  const years = await fetchFromApi<FipeYear[]>(url);
  
  // Salvar no cache
  await setCachedData(cacheKey, years);
  
  return years;
}

export async function getFipePrice(
  vehicleType: VehicleType,
  brandId: string,
  modelId: string,
  yearId: string
): Promise<FipePrice> {
  // FIPE de preços: cachear por 1 dia (não 10 dias como marcas/modelos)
  const cacheKey = `fipe-price-${vehicleType}-${brandId}-${modelId}-${yearId}`;
  
  // Verificar cache manualmente com duração de 1 dia
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const cacheDir = path.join(__dirname, '../../cache');
    const cacheFile = path.join(cacheDir, `${cacheKey}.json`);
    
    try {
      const fileContent = await fs.readFile(cacheFile, 'utf-8');
      const cache: { lastUpdated: string; data: FipePrice } = JSON.parse(fileContent);
      const lastUpdated = new Date(cache.lastUpdated).getTime();
      const now = Date.now();
      const age = now - lastUpdated;
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      if (age < oneDayMs) {
        return cache.data;
      }
    } catch {
      // Cache não existe ou expirado, continuar para buscar da API
    }
  } catch {
    // Erro ao verificar cache, continuar para buscar da API
  }
  
  // Buscar da API
  const url = `${FIPE_API_BASE}/${vehicleType}/marcas/${brandId}/modelos/${modelId}/anos/${yearId}`;
  const price = await fetchFromApi<FipePrice>(url);
  
  // Salvar no cache
  await setCachedData(cacheKey, price);
  
  return price;
}
