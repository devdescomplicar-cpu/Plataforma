import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Vehicle } from '@/components/dashboard/VehicleCard';

export interface VehicleResponse {
  id: string;
  brand: string;
  model: string;
  version?: string;
  year: number;
  km?: number;
  plate?: string;
  purchasePrice?: number;
  salePrice?: number;
  fipePrice?: number;
  profit?: number;
  profitPercent?: number;
  daysInStock: number;
  fuel: string;
  color: string;
  status: 'available' | 'reserved' | 'sold';
  description?: string;
  image?: string;
  totalExpenses?: number;
  images?: Array<{
    id: string;
    url: string;
    key: string;
    order: number;
  }>;
}

export interface VehiclesResponse {
  data: VehicleResponse[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateVehicleData {
  vehicleType?: 'car' | 'motorcycle';
  brand: string;
  model: string;
  version?: string;
  year: number;
  km?: number;
  plate?: string;
  fuel: string;
  color: string;
  transmission?: string;
  steering?: string;
  origin?: 'own' | 'consignment' | 'repass';
  features?: string[];
  purchasePrice?: number;
  salePrice?: number;
  fipePrice?: number;
  description?: string;
  status?: 'available' | 'reserved' | 'sold';
  // Consignado
  consignmentOwnerName?: string;
  consignmentOwnerPhone?: string;
  consignmentCommissionType?: 'percentual' | 'fixed';
  consignmentCommissionValue?: number;
  consignmentMinRepassValue?: number;
  consignmentStartDate?: Date;
  images?: File[];
}

export const useVehicles = (params?: {
  search?: string;
  status?: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) => {
  const safeParams =
    params && Object.keys(params).length > 0
      ? (Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        ) as Record<string, string | number>)
      : undefined;

  return useQuery({
    queryKey: ['vehicles', safeParams],
    queryFn: async (): Promise<VehiclesResponse> => {
      const response = await apiClient.get<{ data: VehicleResponse[]; pagination?: VehiclesResponse['pagination'] }>(
        '/vehicles',
        safeParams
      );
      return {
        data: Array.isArray(response.data) ? response.data : [],
        pagination: response.pagination,
      };
    },
  });
};

export const useVehicle = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['vehicle', id],
    queryFn: async (): Promise<VehicleResponse> => {
      const response = await apiClient.get<{ data: VehicleResponse }>(`/vehicles/${id}`);
      if (response.data == null) throw new Error('Veículo não encontrado');
      return response.data;
    },
    enabled: !!id && (options?.enabled !== false),
  });
};

export const useCreateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateVehicleData & { images?: File[] }) => {
      const formData = new FormData();

      Object.entries(data).forEach(([key, value]) => {
        if (key === 'images') return;
        
        if (value === undefined || value === null) return;
        
        if (key === 'features' && Array.isArray(value)) {
          value.forEach((feature, index) => {
            formData.append(`features[${index}]`, feature);
          });
        } else if (value instanceof Date) {
          formData.append(key, value.toISOString());
        } else {
          formData.append(key, value.toString());
        }
      });

      if (data.images && data.images.length > 0) {
        console.log('[useCreateVehicle] Adding images to FormData:', {
          count: data.images.length,
          names: data.images.map(img => img.name),
        });
        data.images.forEach((image) => {
          formData.append('images', image);
        });
      } else {
        console.log('[useCreateVehicle] No images to upload');
      }

      // Debug: verificar FormData
      console.log('[useCreateVehicle] FormData keys:', Array.from(formData.keys()));
      const imageEntries = Array.from(formData.entries()).filter(([key]) => key === 'images');
      console.log('[useCreateVehicle] Image entries in FormData:', imageEntries.length);

      const response = await apiClient.upload<{ data: VehicleResponse }>('/vehicles', formData);
      return response.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => {},
    onSettled: () => {},
  });
};

export const useUpdateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, images, imageOrder, imagesToDelete, ...data }: Partial<CreateVehicleData> & { 
      id: string;
      images?: File[];
      imageOrder?: Array<{ id: string; order: number }>;
      imagesToDelete?: string[];
    }) => {
      // Se há imagens, reordenação ou remoção, usar FormData, senão JSON normal
      const hasImageOperations = (images && images.length > 0) || 
                                 (imageOrder && imageOrder.length > 0) || 
                                 (imagesToDelete && imagesToDelete.length > 0);
      
      if (hasImageOperations) {
        const formData = new FormData();
        
        Object.entries(data).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          
          // Não incluir imageOrder e imagesToDelete aqui, serão adicionados depois
          if (key === 'imageOrder' || key === 'imagesToDelete') return;
          
          if (key === 'features' && Array.isArray(value)) {
            value.forEach((feature, index) => {
              formData.append(`features[${index}]`, feature);
            });
          } else if (value instanceof Date) {
            formData.append(key, value.toISOString());
          } else {
            formData.append(key, value.toString());
          }
        });

        // Adicionar novas imagens
        if (images && images.length > 0) {
          images.forEach((image) => {
            formData.append('images', image);
          });
        }

        // Adicionar ordem das imagens existentes
        if (imageOrder && imageOrder.length > 0) {
          formData.append('imageOrder', JSON.stringify(imageOrder));
        }

        // Adicionar IDs de imagens para deletar
        if (imagesToDelete && imagesToDelete.length > 0) {
          imagesToDelete.forEach((imageId) => {
            formData.append('imagesToDelete[]', imageId);
          });
        }

        const response = await apiClient.upload<{ data: VehicleResponse }>(`/vehicles/${id}`, formData, 'PUT');
        return response.data!;
      } else {
        // Sem operações de imagem, usar JSON normal
      const response = await apiClient.put<{ data: VehicleResponse }>(`/vehicles/${id}`, data);
      return response.data!;
      }
    },
    onSuccess: async (data, variables) => {
      // Invalidar todas as queries de veículos (incluindo as com parâmetros diferentes)
      await queryClient.invalidateQueries({ queryKey: ['vehicles'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['vehicle', variables.id] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // Forçar refetch imediato de todas as queries de veículos
      await queryClient.refetchQueries({ queryKey: ['vehicles'], exact: false });
      // Atualizar o cache diretamente com os dados retornados se houver
      if (data && data.images) {
        queryClient.setQueryData(['vehicle', variables.id], data);
        // Atualizar também na lista de veículos
        queryClient.setQueriesData({ queryKey: ['vehicles'] }, (old: any) => {
          if (!old || !old.data) return old;
          return {
            ...old,
            data: old.data.map((v: any) => 
              v.id === variables.id ? { ...v, images: data.images } : v
            ),
          };
        });
      }
    },
  });
};

export const useDeleteVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ message: string }>(`/vehicles/${id}`);
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
