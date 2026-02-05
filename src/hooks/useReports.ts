import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface ReportSummary {
  faturamentoTotal: number;
  lucroLiquido: number;
  margemLucro: number;
  veiculosVendidos: number;
  clientesRecorrentes: number;
  tempoMedioEstoque: number;
}

export interface ReportMonth {
  month: string;
  vendas: number;
  lucro: number;
  faturamento: number;
  tempoMedioEstoque: number;
}

export interface ReportTopVehicle {
  name: string;
  lucro: number;
  faturamento: number;
  margem: number;
  vendas: number;
}

export interface ReportBrand {
  name: string;
  lucro: number;
  faturamento: number;
  margem: number;
  color: string;
}

export interface ReportVehicleDays {
  name: string;
  dias: number;
  color: string;
}

export interface ReportsData {
  summary: ReportSummary;
  vendasMensais: ReportMonth[];
  topVeiculosLucrativos: ReportTopVehicle[];
  marcasLucrativas: ReportBrand[];
  veiculosMaisTempoEstoque: ReportVehicleDays[];
  veiculosVendaRapida: ReportVehicleDays[];
}

/** Mês do gráfico de comissão do vendedor. */
export interface SellerReportMonth {
  month: string;
  vendas: number;
  faturamento: number;
  comissao: number;
}

/** Resposta do relatório limitado do vendedor (sem custos/lucro). */
export interface SellerReportData {
  summary: {
    veiculosVendidos: number;
    totalVendido: number;
    totalComissaoReceber: number;
  };
  comissaoMensais: SellerReportMonth[];
  vendas: Array<{
    id: string;
    saleDate: string;
    salePrice: number;
    commissionAmount: number | null;
    vehicle: string | null;
    clientName: string | null;
  }>;
}

export interface CollaboratorReportRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  vendasCount: number;
  totalVendido: number;
  totalComissao: number;
}

export function useReports(params?: { period?: string; startDate?: string; endDate?: string }) {
  const safeParams =
    params && Object.keys(params).length > 0
      ? (Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        ) as Record<string, string>)
      : undefined;

  return useQuery({
    queryKey: ['dashboard', 'reports', safeParams],
    queryFn: async (): Promise<ReportsData | SellerReportData> => {
      const response = await apiClient.get<{ data: ReportsData | SellerReportData }>(
        '/dashboard/reports',
        safeParams
      );
      const data = response.data;
      if (data && 'vendasMensais' in data) {
        return data as ReportsData;
      }
      if (data && 'vendas' in data && Array.isArray((data as SellerReportData).vendas)) {
        return data as SellerReportData;
      }
      return {
        summary: {
          faturamentoTotal: 0,
          lucroLiquido: 0,
          margemLucro: 0,
          veiculosVendidos: 0,
          clientesRecorrentes: 0,
          tempoMedioEstoque: 0,
        },
        vendasMensais: [],
        topVeiculosLucrativos: [],
        marcasLucrativas: [],
        veiculosMaisTempoEstoque: [],
        veiculosVendaRapida: [],
      };
    },
  });
}

export function useReportsCollaborators(params?: {
  period?: string;
  startDate?: string;
  endDate?: string;
}) {
  const safeParams =
    params && Object.keys(params).length > 0
      ? (Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        ) as Record<string, string>)
      : undefined;

  return useQuery({
    queryKey: ['dashboard', 'reports', 'collaborators', safeParams],
    queryFn: async (): Promise<CollaboratorReportRow[]> => {
      const response = await apiClient.get<CollaboratorReportRow[]>('/dashboard/reports/collaborators', safeParams);
      if (!response.success || response.data == null) return [];
      return Array.isArray(response.data) ? response.data : [];
    },
  });
}

/** Relatório completo de um colaborador (dono; usado na aba Colaboradores). */
export interface CollaboratorReportData {
  collaborator: { userId: string; name: string; email: string; role: string };
  summary: { veiculosVendidos: number; totalVendido: number; totalComissao: number };
  comissaoMensais: SellerReportMonth[];
  vendas: Array<{
    id: string;
    saleDate: string;
    salePrice: number;
    commissionAmount: number | null;
    vehicle: string | null;
    clientName: string | null;
  }>;
}

export function useReportCollaboratorById(
  userId: string | null,
  params?: { period?: string; startDate?: string; endDate?: string }
) {
  const safeParams =
    params && Object.keys(params).length > 0
      ? (Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        ) as Record<string, string>)
      : undefined;

  return useQuery({
    queryKey: ['dashboard', 'reports', 'collaborators', userId, safeParams],
    queryFn: async (): Promise<CollaboratorReportData | null> => {
      if (!userId) return null;
      const response = await apiClient.get<CollaboratorReportData>(`/dashboard/reports/collaborators/${userId}`, safeParams);
      const data = response.data;
      if (!response.success || !data) return null;
      return data as CollaboratorReportData;
    },
    enabled: !!userId,
  });
}
