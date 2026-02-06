import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Crown } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { publicApi, type PublicPlan, type PlanDurationType } from '@/lib/public-api';
import { cn } from '@/lib/utils';
import { PageLoader } from '@/components/PageLoader';

const DURATION_OPTIONS: Array<{
  key: PlanDurationType;
  label: string;
  durationLabel: string;
  durationMonths: number;
}> = [
  { key: 'monthly', label: 'Mensal', durationLabel: '1 mês', durationMonths: 1 },
  { key: 'quarterly', label: 'Trimestral', durationLabel: '3 meses', durationMonths: 3 },
  { key: 'semiannual', label: 'Semestral', durationLabel: '6 meses', durationMonths: 6 },
  { key: 'annual', label: 'Anual', durationLabel: '1 ano', durationMonths: 12 },
];

function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
}

function getMonthlyPrice(price: number, durationType: string, durationMonths: number): number {
  if (durationType === 'monthly') {
    return price;
  }
  // Dividir pelo número de meses para obter o valor mensal
  return price / durationMonths;
}

function durationLabel(type: string, months: number): string {
  const opt = DURATION_OPTIONS.find((o) => o.key === type);
  return opt ? opt.durationLabel : `${months} ${months === 1 ? 'mês' : 'meses'}`;
}

function groupPlansByName(plans: PublicPlan[]): { name: string; plans: PublicPlan[] }[] {
  const byName = new Map<string, PublicPlan[]>();
  for (const p of plans) {
    const list = byName.get(p.name) ?? [];
    list.push(p);
    byName.set(p.name, list);
  }
  return Array.from(byName.entries()).map(([name, plans]) => ({
    name,
    plans: plans.sort((a, b) => a.durationMonths - b.durationMonths),
  }));
}

export default function Planos() {
  const [selectedDuration, setSelectedDuration] = useState<PlanDurationType>('monthly');

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['public', 'plans'],
    queryFn: async () => {
      const res = await publicApi.plans.list();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao carregar planos');
      return res.data ?? [];
    },
    staleTime: 60_000, // 1 minuto
  });

  const groupedPlans = useMemo(() => groupPlansByName(plans), [plans]);

  // Obter planos disponíveis para o período selecionado
  const availableDurations = useMemo(() => {
    const durations = new Set<PlanDurationType>();
    for (const plan of plans) {
      const duration = plan.durationType as PlanDurationType;
      if (DURATION_OPTIONS.some((opt) => opt.key === duration)) {
        durations.add(duration);
      }
    }
    return Array.from(durations).sort((a, b) => {
      const aMonths = DURATION_OPTIONS.find((o) => o.key === a)?.durationMonths ?? 0;
      const bMonths = DURATION_OPTIONS.find((o) => o.key === b)?.durationMonths ?? 0;
      return aMonths - bMonths;
    });
  }, [plans]);

  // Se o período selecionado não estiver disponível, usar o primeiro disponível
  const activeDuration = useMemo(() => {
    if (availableDurations.includes(selectedDuration)) {
      return selectedDuration;
    }
    return availableDurations[0] ?? 'monthly';
  }, [selectedDuration, availableDurations]);

  // Filtrar planos pelo período ativo
  const filteredPlans = useMemo(() => {
    return groupedPlans.map((group) => ({
      ...group,
      plans: group.plans.filter((p) => p.durationType === activeDuration),
    })).filter((group) => group.plans.length > 0);
  }, [groupedPlans, activeDuration]);

  if (isLoading) {
    return <PageLoader />;
  }

  // Determinar qual plano destacar (meio se houver 3, primeiro se houver 2, nenhum se houver 1)
  const featuredPlanIndex = useMemo(() => {
    if (filteredPlans.length === 3) return 1;
    if (filteredPlans.length === 2) return 0;
    return -1;
  }, [filteredPlans.length]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 sm:py-16 lg:py-20">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-12 sm:mb-16">
          <div className="mb-6">
            <Logo size="large" showText={false} linkable={false} variant="light" />
          </div>
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              Escolha seu plano
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Selecione o melhor plano que se adapta à sua necessidade
            </p>
          </div>
        </div>

        {/* Toggle de Períodos */}
        {availableDurations.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10 sm:mb-12">
            {DURATION_OPTIONS.map((option) => {
              const isAvailable = availableDurations.includes(option.key);
              if (!isAvailable) return null;
              const isActive = activeDuration === option.key;
              return (
                <Button
                  key={option.key}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDuration(option.key)}
                  className={cn(
                    'transition-all',
                    isActive && 'shadow-sm'
                  )}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        )}

        {/* Cards de Planos */}
        {filteredPlans.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhum plano disponível no momento.</p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-6 max-w-6xl mx-auto",
            filteredPlans.length === 1 && "grid-cols-1 max-w-md",
            filteredPlans.length === 2 && "grid-cols-1 md:grid-cols-2",
            filteredPlans.length >= 3 && "grid-cols-1 lg:grid-cols-3"
          )}>
            {filteredPlans.map((group, index) => {
              const plan = group.plans[0];
              if (!plan) return null;

              const customBenefits = plan.customBenefits ?? [];
              const hasUnlimitedVehicles = plan.maxVehicles === null;
              const hasUnlimitedClients = plan.maxClients === null;
              const hasUnlimitedStorage = plan.maxStorageMb === null;
              const isFeatured = index === featuredPlanIndex;

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative",
                    isFeatured && "lg:-mt-2 lg:mb-2"
                  )}
                >
                  {/* Badge "Mais Popular" */}
                  {isFeatured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-primary text-primary-foreground px-3 py-1 shadow-md">
                        <Crown className="w-3 h-3 mr-1.5" />
                        Mais Popular
                      </Badge>
                    </div>
                  )}

                  <Card
                    className={cn(
                      "flex flex-col h-full transition-all duration-200",
                      "border",
                      isFeatured
                        ? "border-primary/40 shadow-lg"
                        : "border-border hover:border-primary/30 hover:shadow-md"
                    )}
                  >
                    <CardHeader className="pb-4">
                      <div className="mb-4">
                        <CardTitle className="text-2xl font-bold mb-2">{plan.name}</CardTitle>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-baseline gap-1">
                          <span className={cn(
                            "text-4xl font-bold",
                            isFeatured ? "text-primary" : "text-foreground"
                          )}>
                            {formatPrice(getMonthlyPrice(plan.price, plan.durationType, plan.durationMonths))}
                          </span>
                          <span className={cn(
                            "text-lg font-normal ml-1",
                            isFeatured ? "text-primary/70" : "text-muted-foreground"
                          )}>
                            /mês
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-4 pb-6">
                      {/* Benefícios padrão */}
                      <div className="space-y-2.5">
                        {plan.maxVehicles !== null && (
                          <div className="flex items-center gap-2.5 text-sm">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="text-foreground">
                              Até <strong>{plan.maxVehicles}</strong> veículos
                            </span>
                          </div>
                        )}
                        {hasUnlimitedVehicles && (
                          <div className="flex items-center gap-2.5 text-sm">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="text-foreground">
                              <strong>Ilimitado</strong> veículos
                            </span>
                          </div>
                        )}
                        {plan.maxClients !== null && (
                          <div className="flex items-center gap-2.5 text-sm">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="text-foreground">
                              Até <strong>{plan.maxClients}</strong> clientes
                            </span>
                          </div>
                        )}
                        {hasUnlimitedClients && (
                          <div className="flex items-center gap-2.5 text-sm">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="text-foreground">
                              <strong>Ilimitado</strong> clientes
                            </span>
                          </div>
                        )}
                        {plan.maxStorageMb !== null && (
                          <div className="flex items-center gap-2.5 text-sm">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="text-foreground">
                              <strong>{plan.maxStorageMb} MB</strong> de armazenamento
                            </span>
                          </div>
                        )}
                        {hasUnlimitedStorage && (
                          <div className="flex items-center gap-2.5 text-sm">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="text-foreground">
                              <strong>Armazenamento ilimitado</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Features legadas */}
                      {plan.features.length > 0 && (
                        <div className="space-y-2.5 pt-3 border-t">
                          {plan.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 text-sm">
                              <Check className="w-4 h-4 text-primary flex-shrink-0" />
                              <span className="text-foreground">{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Benefícios customizados */}
                      {customBenefits.length > 0 && (
                        <div className="space-y-2.5 pt-3 border-t">
                          {customBenefits.map((benefit, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 text-sm">
                              {benefit.positive ? (
                                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                              ) : (
                                <div className="w-4 h-4 flex-shrink-0" />
                              )}
                              <span className={cn(
                                "text-foreground",
                                !benefit.positive && "text-muted-foreground line-through"
                              )}>
                                {benefit.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>

                    <div className="px-6 pb-6">
                      {plan.checkoutUrl ? (
                        <Button
                          className={cn(
                            "w-full h-11 font-medium",
                            isFeatured && "bg-primary hover:bg-primary/90"
                          )}
                          onClick={() => {
                            window.open(plan.checkoutUrl!, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          Assinar Agora
                        </Button>
                      ) : (
                        <Button className="w-full h-11" disabled variant="outline">
                          Indisponível
                        </Button>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
