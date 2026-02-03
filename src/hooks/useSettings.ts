import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface DefaultChecklistItem {
  name: string;
  enabled: boolean;
  order: number;
}

export interface Settings {
  defaultChecklist: DefaultChecklistItem[];
  expenseCategories: string[];
  expenseRequiresVehicle: boolean;
  recurringClientThreshold: number;
  alerts: {
    checklistComplete: boolean;
    daysInStock: number;
    lowProfit: number;
  };
}

export interface StoreInfo {
  name: string;
  legalName?: string;
  tradeName?: string;
  cpfCnpj?: string;
  stateRegistration?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  logo?: string;
  logoDark?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface ReportConfig {
  responsible: string;
  currency: string;
  dateFormat: 'DD/MM' | 'MM/DD';
  thousandSeparator: string;
  showCents: boolean;
  includeLegalNotice: boolean;
  legalNoticeText: string;
}

export interface SettingsResponse {
  store: StoreInfo;
  report: ReportConfig;
  settings: Settings;
}

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<SettingsResponse> => {
      const response = await apiClient.get<{ data: SettingsResponse }>('/settings');
      return response.data;
    },
  });
};

export const useUpdateStoreInfo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: StoreInfo) => {
      const response = await apiClient.put<{ data: { store: StoreInfo } }>('/settings/store', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      const response = await apiClient.put<{ data: { settings: Settings } }>('/settings', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};

export const useUploadStoreLogo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      const response = await apiClient.upload<{ data: { store: { logo: string } } }>(
        '/settings/store/logo',
        formData,
        'POST'
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};

export const useUploadStoreLogoDark = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logoDark', file);
      const response = await apiClient.upload<{ data: { store: { logoDark: string } } }>(
        '/settings/store/logo-dark',
        formData,
        'POST'
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};
