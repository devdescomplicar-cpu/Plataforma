import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type CollaboratorRole = 'owner' | 'manager' | 'seller';

export interface UserMe {
  user: { id: string; email: string; name: string; role: string };
  account: { id: string; name: string };
  isAccountOwner?: boolean;
  collaboratorRole?: CollaboratorRole;
}

export const ROLE_ADMIN = 'admin';

export function isAdmin(role: string | undefined): boolean {
  return role === ROLE_ADMIN;
}

export function useUser() {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: async (): Promise<UserMe> => {
      const response = await apiClient.get<UserMe>('/auth/me');
      const payload = response.data;
      if (payload == null) throw new Error('Não autenticado');
      return payload;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
