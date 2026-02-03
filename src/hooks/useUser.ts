import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface UserMe {
  user: { id: string; email: string; name: string; role: string; phone?: string | null; cpfCnpj?: string | null };
  account: { id: string; name: string };
}

export const ROLE_ADMIN = 'admin';

export function isAdmin(role: string | undefined): boolean {
  return role === ROLE_ADMIN;
}

export function useUser() {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: async (): Promise<UserMe> => {
      const response = await apiClient.get<{ data: UserMe }>('/auth/me');
      if (response.data == null) throw new Error('Não autenticado');
      return response.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
