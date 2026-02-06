import { apiClient } from '@/lib/api';

const BASE = '/public';

export interface CustomBenefit {
  text: string;
  positive: boolean;
}

export interface PublicPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  features: string[];
  maxVehicles: number | null;
  maxClients: number | null;
  maxStorageMb: number | null;
  durationType: string;
  durationMonths: number;
  checkoutUrl: string | null;
  customBenefits: CustomBenefit[] | null;
}

export type PlanDurationType = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export const publicApi = {
  plans: {
    list: () => apiClient.get<PublicPlan[]>(`${BASE}/plans`),
  },
};
