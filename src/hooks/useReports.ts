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

export interface ReportsData {
  summary: ReportSummary;
  vendasMensais: ReportMonth[];
  topVeiculosLucrativos: ReportTopVehicle[];
  marcasLucrativas: ReportBrand[];
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
    queryFn: async (): Promise<ReportsData> => {
      const response = await apiClient.get<{ data: ReportsData }>(
        '/dashboard/reports',
        safeParams
      );
      return response.data ?? {
        summary: {
          faturamentoTotal: 0,
          lucroLiquido: 0,
          margemLucro: 0,
          veiculosVendidos: 0,
          clientesRecorrentes: 0,
        },
        vendasMensais: [],
        topVeiculosLucrativos: [],
        marcasLucrativas: [],
      };
    },
  });
}
