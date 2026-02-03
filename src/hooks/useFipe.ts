import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface FipeBrand {
  codigo: string;
  nome: string;
}

export interface FipeModel {
  codigo: string;
  nome: string;
}

export interface FipeYear {
  codigo: string;
  nome: string;
}

export interface FipePrice {
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

type VehicleType = 'carros' | 'motos';

export const useFipeBrands = (vehicleType: VehicleType | null) => {
  return useQuery({
    queryKey: ['fipe', 'brands', vehicleType],
    queryFn: async (): Promise<FipeBrand[]> => {
      if (!vehicleType) return [];
      const response = await apiClient.get<{ data: FipeBrand[] }>(
        `/fipe/brands?type=${vehicleType}`
      );
      return response.data!;
    },
    enabled: !!vehicleType,
    staleTime: 10 * 24 * 60 * 60 * 1000, // 10 dias
  });
};

export const useFipeModels = (
  vehicleType: VehicleType,
  brandId: string | null
) => {
  return useQuery({
    queryKey: ['fipe', 'models', vehicleType, brandId],
    queryFn: async (): Promise<FipeModel[]> => {
      if (!brandId) return [];
      const response = await apiClient.get<{ data: FipeModel[] }>(
        `/fipe/models?type=${vehicleType}&brandId=${brandId}`
      );
      return response.data!;
    },
    enabled: !!vehicleType && !!brandId,
    staleTime: 10 * 24 * 60 * 60 * 1000, // 10 dias
  });
};

export const useFipeYears = (
  vehicleType: VehicleType,
  brandId: string | null,
  modelId: string | null
) => {
  return useQuery({
    queryKey: ['fipe', 'years', vehicleType, brandId, modelId],
    queryFn: async (): Promise<FipeYear[]> => {
      if (!brandId || !modelId) return [];
      const response = await apiClient.get<{ data: FipeYear[] }>(
        `/fipe/years?type=${vehicleType}&brandId=${brandId}&modelId=${modelId}`
      );
      return response.data!;
    },
    enabled: !!vehicleType && !!brandId && !!modelId,
    staleTime: 10 * 24 * 60 * 60 * 1000, // 10 dias
  });
};

export const useFipePrice = (
  vehicleType: VehicleType,
  brandId: string | null,
  modelId: string | null,
  yearId: string | null
) => {
  return useQuery({
    queryKey: ['fipe', 'price', vehicleType, brandId, modelId, yearId],
    queryFn: async (): Promise<FipePrice> => {
      if (!brandId || !modelId || !yearId) {
        throw new Error('Parâmetros incompletos');
      }
      const response = await apiClient.get<{ data: FipePrice }>(
        `/fipe/price?type=${vehicleType}&brandId=${brandId}&modelId=${modelId}&yearId=${yearId}`
      );
      return response.data!;
    },
    enabled: !!vehicleType && !!brandId && !!modelId && !!yearId,
    staleTime: 24 * 60 * 60 * 1000, // 1 dia para preços
  });
};
