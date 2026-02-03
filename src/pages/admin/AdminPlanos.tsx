import { useState } from 'react';
import React from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Trash2,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Pencil,
  Copy,
  PowerOff,
  Power,
  Users,
  DollarSign,
  TrendingUp,
  Award,
} from 'lucide-react';
import { adminApi, type AdminPlan, type PlanDurationType, type PlanOffer } from '@/lib/admin-api';
import type { CustomBenefit } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { TruncatedText } from '@/components/ui/TruncatedText';

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

function durationLabel(type: string, months: number): string {
  const opt = DURATION_OPTIONS.find((o) => o.key === type);
  return opt ? opt.durationLabel : `${months} ${months === 1 ? 'mês' : 'meses'}`;
}

function periodLabel(type: string): string {
  const opt = DURATION_OPTIONS.find((o) => o.key === type);
  return opt?.label ?? type;
}

const MAX_PRICE_DIGITS = 11; // 999.999.999,99

/** Formata string de dígitos (centavos) para exibição BRL: 1790 → "17,90", 179000 → "1.790,00" */
function formatDigitsToBRL(digits: string): string {
  if (digits === '') return '';
  const padded = digits.padStart(3, '0');
  const reaisPart = padded.slice(0, -2);
  const centavosPart = padded.slice(-2);
  const withDots = reaisPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots},${centavosPart}`;
}

/** Converte string de dígitos (centavos) para número em reais */
function digitsToReais(digits: string): number {
  if (digits === '') return 0;
  return Number.parseInt(digits, 10) / 100;
}

/** Converte valor em reais para string de dígitos (centavos) para o input formatado */
function reaisToDigits(reais: number): string {
  const cents = Math.round(reais * 100);
  return String(cents);
}

/** Agrupa planos por nome (mesmo plano, várias ofertas) */
function groupPlansByName(plans: AdminPlan[]): { name: string; plans: AdminPlan[] }[] {
  const byName = new Map<string, AdminPlan[]>();
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

export default function AdminPlanos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [maxVehicles, setMaxVehicles] = useState<string>('');
  const [maxClients, setMaxClients] = useState<string>('');
  const [maxStorageMb, setMaxStorageMb] = useState<string>('');
  const [customBenefits, setCustomBenefits] = useState<CustomBenefit[]>([]);
  const [newBenefitText, setNewBenefitText] = useState('');
  const [editingBenefitIndex, setEditingBenefitIndex] = useState<number | null>(null);
  const [editingBenefitValue, setEditingBenefitValue] = useState('');
  const [active, setActive] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [editGroup, setEditGroup] = useState<{ name: string; plans: AdminPlan[] } | null>(null);
  const [editCurrentStep, setEditCurrentStep] = useState(1);
  const editTotalSteps = 4;
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    checkoutUrl: string;
    maxVehicles: string;
    maxClients: string;
    customBenefits: CustomBenefit[];
    active: boolean;
    prices: Record<string, string>;
    enabledPlans: Record<string, boolean>;
  } | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<{ name: string; plans: AdminPlan[] } | null>(null);
  const [deactivateGroup, setDeactivateGroup] = useState<{
    name: string;
    plans: AdminPlan[];
  } | null>(null);
  const [selectedPeriods, setSelectedPeriods] = useState<Record<PlanDurationType, boolean>>({
    monthly: false,
    quarterly: false,
    semiannual: false,
    annual: false,
  });
  const [prices, setPrices] = useState<Record<PlanDurationType, string>>({
    monthly: '',
    quarterly: '',
    semiannual: '',
    annual: '',
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const res = await adminApi.plans.list();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return (res.data ?? []) as AdminPlan[];
    },
    staleTime: 30_000,
  });

  // Buscar todos os planos do grupo (incluindo desativados) quando abrir o modal de editar
  const { data: allPlansForEdit = [] } = useQuery({
    queryKey: ['admin', 'plans', 'all', editGroup?.name],
    queryFn: async () => {
      if (!editGroup) return [];
      // Buscar todos os planos com o mesmo nome, incluindo desativados
      const res = await adminApi.plans.list({ includeInactive: 'true' });
      if (!res.success) return [];
      return (res.data ?? []).filter((p) => p.name === editGroup.name) as AdminPlan[];
    },
    enabled: !!editGroup,
    staleTime: 0, // Sempre buscar dados frescos quando abrir o modal
  });

  const { data: plansStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin', 'plans', 'stats'],
    queryFn: async () => {
      const res = await adminApi.plans.stats();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao carregar estatísticas');
      return res.data;
    },
    staleTime: 30_000,
  });

  // Atualizar editForm quando allPlansForEdit carregar para incluir períodos desativados
  React.useEffect(() => {
    if (editGroup && allPlansForEdit.length > 0 && editForm) {
      // Verificar se há planos novos que não estão no form
      const hasNewPlans = allPlansForEdit.some(
        (p) => !editForm.prices[p.id] || editForm.enabledPlans[p.id] === undefined
      );
      
      if (hasNewPlans) {
        const newPrices: Record<string, string> = { ...editForm.prices };
        const newEnabledPlans: Record<string, boolean> = { ...editForm.enabledPlans };
        
        for (const plan of allPlansForEdit) {
          if (!newPrices[plan.id]) {
            newPrices[plan.id] = reaisToDigits(plan.price);
          }
          if (newEnabledPlans[plan.id] === undefined) {
            newEnabledPlans[plan.id] = plan.active ?? false;
          }
        }
        
        setEditForm((prev) =>
          prev
            ? {
                ...prev,
                prices: newPrices,
                enabledPlans: newEnabledPlans,
              }
            : null
        );
      }
    }
  }, [allPlansForEdit, editGroup]);

  const createBatch = useMutation({
    mutationFn: (body: Parameters<typeof adminApi.plans.createBatch>[0]) =>
      adminApi.plans.createBatch(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: 'Planos criados', description: 'As ofertas foram cadastradas com sucesso.' });
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar planos',
        description: err.message ?? 'Tente novamente.',
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof adminApi.plans.update>[1] }) =>
      adminApi.plans.update(id, body),
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar plano',
        description: err.message ?? 'Tente novamente.',
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => adminApi.plans.delete(id),
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir plano',
        description: err.message ?? 'Tente novamente.',
      });
    },
  });

  function resetForm() {
    setName('');
    setDescription('');
    setCheckoutUrl('');
    setMaxVehicles('');
    setMaxClients('');
    setMaxStorageMb('');
    setCustomBenefits([]);
    setNewBenefitText('');
    setEditingBenefitIndex(null);
    setEditingBenefitValue('');
    setActive(true);
    setSelectedPeriods({ monthly: false, quarterly: false, semiannual: false, annual: false });
    setPrices({ monthly: '', quarterly: '', semiannual: '', annual: '' });
    setCurrentStep(1);
  }

  function togglePeriod(key: PlanDurationType) {
    setSelectedPeriods((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setPrice(key: PlanDurationType, value: string) {
    setPrices((prev) => ({ ...prev, [key]: value }));
  }

  function addBenefit() {
    const text = newBenefitText.trim();
    if (!text) return;
    setCustomBenefits((prev) => [...prev, { text, positive: true }]);
    setNewBenefitText('');
  }

  function removeBenefit(index: number) {
    setCustomBenefits((prev) => prev.filter((_, i) => i !== index));
    if (editingBenefitIndex === index) {
      setEditingBenefitIndex(null);
      setEditingBenefitValue('');
    } else if (editingBenefitIndex !== null && editingBenefitIndex > index) {
      setEditingBenefitIndex(editingBenefitIndex - 1);
    }
  }

  function toggleBenefitPositive(index: number) {
    setCustomBenefits((prev) =>
      prev.map((b, i) => (i === index ? { ...b, positive: !b.positive } : b))
    );
  }

  function moveBenefit(index: number, direction: 'up' | 'down') {
    const next = index + (direction === 'up' ? -1 : 1);
    if (next < 0 || next >= customBenefits.length) return;
    setCustomBenefits((prev) => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
    if (editingBenefitIndex === index) setEditingBenefitIndex(next);
    else if (editingBenefitIndex === next) setEditingBenefitIndex(index);
  }

  function startEditBenefit(index: number) {
    setEditingBenefitIndex(index);
    setEditingBenefitValue(customBenefits[index].text);
  }

  function saveEditBenefit() {
    if (editingBenefitIndex === null) return;
    const text = editingBenefitValue.trim();
    if (text) {
      setCustomBenefits((prev) =>
        prev.map((b, i) => (i === editingBenefitIndex ? { ...b, text } : b))
      );
    }
    setEditingBenefitIndex(null);
    setEditingBenefitValue('');
  }

  function handlePriceKeyDown(key: PlanDurationType, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const next = (prices[key] ?? '') + e.key;
      if (next.length <= MAX_PRICE_DIGITS) setPrice(key, next);
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      setPrice(key, (prices[key] ?? '').slice(0, -1));
    }
  }

  function handlePricePaste(key: PlanDurationType, e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, MAX_PRICE_DIGITS);
    setPrice(key, pasted);
  }

  function openEditGroup(group: { name: string; plans: AdminPlan[] }) {
    const first = group.plans[0];
    if (!first) return;
    setEditGroup(group);
    setEditCurrentStep(1);
    // Inicializar o form com os planos visíveis, mas vamos atualizar quando allPlansForEdit carregar
    setEditForm({
      name: first.name,
      description: first.description ?? '',
      checkoutUrl: first.checkoutUrl ?? '',
      maxVehicles: first.maxVehicles != null ? String(first.maxVehicles) : '',
      maxClients: first.maxClients != null ? String(first.maxClients) : '',
      customBenefits: Array.isArray(first.customBenefits) ? first.customBenefits : [],
      active: first.active,
      prices: Object.fromEntries(
        group.plans.map((p) => [p.id, reaisToDigits(p.price)])
      ),
      enabledPlans: Object.fromEntries(
        group.plans.map((p) => [p.id, p.active ?? true])
      ),
    });
  }

  function setEditPrice(planId: string, digits: string) {
    setEditForm((prev) =>
      prev ? { ...prev, prices: { ...prev.prices, [planId]: digits } } : null
    );
  }

  function handleEditPriceKeyDown(
    planId: string,
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    const digits = editForm?.prices[planId] ?? '';
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const next = digits + e.key;
      if (next.length <= MAX_PRICE_DIGITS)
        setEditPrice(planId, next);
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      setEditPrice(planId, digits.slice(0, -1));
    }
  }

  function handleEditPricePaste(planId: string, e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, MAX_PRICE_DIGITS);
    setEditPrice(planId, pasted);
  }

  async function saveEditGroup() {
    if (!editGroup || !editForm) return;
    
    // Usar allPlansForEdit se disponível, senão usar editGroup.plans
    const plansToUpdate = allPlansForEdit.length > 0 ? allPlansForEdit : editGroup.plans;
    
    // Atualizar todos os planos do grupo (habilitados e desabilitados)
    for (const plan of plansToUpdate) {
      const isEnabled = editForm.enabledPlans[plan.id] ?? (plan.active ?? true);
      const price = digitsToReais(editForm.prices[plan.id] ?? '0');
      
      // Atualizar o plano, mas se estiver desabilitado, apenas desativar (não excluir)
      await updatePlanMutation.mutateAsync({
        id: plan.id,
        body: {
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          checkoutUrl: editForm.checkoutUrl.trim() || null,
          maxVehicles: editForm.maxVehicles.trim() ? Number(editForm.maxVehicles) : null,
          maxClients: editForm.maxClients.trim() ? Number(editForm.maxClients) : null,
          customBenefits:
            editForm.customBenefits.length > 0 ? editForm.customBenefits : null,
          active: editForm.active && isEnabled, // Só ativo se o plano geral estiver ativo E o período estiver habilitado
          price,
        },
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'plans', 'stats'] });
    setEditGroup(null);
    setEditForm(null);
    setEditCurrentStep(1);
    toast({ title: 'Plano atualizado', description: 'As ofertas foram salvas.' });
  }

  async function handleDeleteConfirm() {
    if (!deleteGroup) return;
    for (const plan of deleteGroup.plans) {
      await deletePlanMutation.mutateAsync(plan.id);
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
    setDeleteGroup(null);
    toast({ title: 'Planos excluídos', description: 'As ofertas foram removidas (exclusão lógica).' });
  }

  async function handleDeactivateConfirm() {
    if (!deactivateGroup) return;
    const isActivating = !deactivateGroup.plans.some((p) => p.active);
    
    for (const plan of deactivateGroup.plans) {
      await updatePlanMutation.mutateAsync({
        id: plan.id,
        body: { active: isActivating },
      });
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'plans', 'stats'] });
    setDeactivateGroup(null);
    toast({ 
      title: isActivating ? 'Planos ativados' : 'Planos desativados', 
      description: isActivating 
        ? 'As ofertas aparecerão para assinatura.' 
        : 'As ofertas não aparecerão para assinatura.' 
    });
  }

  function handleDuplicateGroup(group: { name: string; plans: AdminPlan[] }) {
    const first = group.plans[0];
    if (!first) return;
    const offers: PlanOffer[] = group.plans.map((p) => ({
      durationType: p.durationType as PlanDurationType,
      durationMonths: p.durationMonths,
      price: p.price,
    }));
    createBatch.mutate({
      name: `${group.name} (cópia)`,
      description: first.description ?? undefined,
      maxVehicles: first.maxVehicles ?? null,
      maxClients: first.maxClients ?? null,
      maxStorageMb: first.maxStorageMb ?? null,
      checkoutUrl: first.checkoutUrl ?? null,
      customBenefits:
        Array.isArray(first.customBenefits) && first.customBenefits.length > 0
          ? first.customBenefits
          : undefined,
      active: first.active,
      offers,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const selected = DURATION_OPTIONS.filter((o) => selectedPeriods[o.key]);
    if (selected.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione ao menos um período',
        description: 'Marque Mensal, Trimestral, Semestral ou Anual.',
      });
      return;
    }
    const offers: PlanOffer[] = [];
    for (const opt of selected) {
      const digits = prices[opt.key] ?? '';
      const price = digitsToReais(digits);
      if (digits === '' || price < 0) {
        toast({
          variant: 'destructive',
          title: `Preço inválido: ${opt.label}`,
          description: 'Informe um valor numérico válido.',
        });
        return;
      }
      offers.push({
        durationType: opt.key,
        durationMonths: opt.durationMonths,
        price,
      });
    }
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe o nome do plano.',
      });
      return;
    }
    createBatch.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      maxVehicles: maxVehicles.trim() ? Number(maxVehicles) : null,
      maxClients: maxClients.trim() ? Number(maxClients) : null,
      maxStorageMb: maxStorageMb.trim() ? Number(maxStorageMb) : null,
      checkoutUrl: checkoutUrl.trim() || null,
      customBenefits: customBenefits.length > 0 ? customBenefits : undefined,
      active,
      offers,
    });
  }

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planos</h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie planos com ofertas por período (mensal, trimestral, semestral, anual).
          </p>
        </div>
         <Dialog 
           open={dialogOpen} 
           onOpenChange={(open) => {
             setDialogOpen(open);
             if (!open) {
               resetForm();
             }
           }}
         >
           <DialogTrigger asChild>
             <Button className="gap-2 shadow-sm">
               <Plus className="h-4 w-4" />
               Adicionar planos
             </Button>
           </DialogTrigger>
           <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
             <DialogHeader className="pb-4 border-b">
               <DialogTitle>Novo plano</DialogTitle>
               <DialogDescription>
                 Crie um novo plano em etapas. Complete cada passo para avançar.
               </DialogDescription>
             </DialogHeader>

             {/* Progress Steps */}
             <div className="flex items-center py-6 px-8 border-b">
               {[1, 2, 3, 4].map((step, index) => (
                 <React.Fragment key={step}>
                   <div className="flex flex-col items-center flex-1">
                     <div
                       className={cn(
                         "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors shrink-0",
                         step < currentStep
                           ? "bg-success text-white"
                           : step === currentStep
                             ? "bg-primary text-primary-foreground"
                             : "bg-muted text-muted-foreground"
                       )}
                     >
                       {step < currentStep ? <Check className="h-5 w-5" /> : step}
                     </div>
                     <span
                       className={cn(
                         "text-xs mt-2 text-center font-medium whitespace-nowrap",
                         step <= currentStep ? "text-foreground" : "text-muted-foreground"
                       )}
                     >
                       {step === 1 && "Básico"}
                       {step === 2 && "Limites"}
                       {step === 3 && "Benefícios"}
                       {step === 4 && "Ativar"}
                     </span>
                   </div>
                   {index < 3 && (
                     <div
                       className={cn(
                         "h-1 flex-1 mx-4 transition-colors",
                         step < currentStep ? "bg-success" : "bg-muted"
                       )}
                     />
                   )}
                 </React.Fragment>
               ))}
             </div>

             <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
               <div className="p-6 space-y-6">
                 {/* Step 1: Informações Básicas */}
                 {currentStep === 1 && (
                   <div className="space-y-4">
                     <div>
                       <h3 className="text-lg font-semibold mb-2">Informações Básicas</h3>
                       <p className="text-sm text-muted-foreground mb-4">
                         Defina o nome, descrição, períodos e URL de checkout do plano.
                       </p>
                     </div>
                     <div className="space-y-3">
                       <div className="space-y-2">
                         <Label htmlFor="plan-name">Nome do plano *</Label>
                         <Input
                           id="plan-name"
                           placeholder="Ex: Plano Básico"
                           value={name}
                           onChange={(e) => setName(e.target.value)}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="plan-desc">Descrição (opcional)</Label>
                         <Textarea
                           id="plan-desc"
                           placeholder="Breve descrição do plano"
                           value={description}
                           onChange={(e) => setDescription(e.target.value)}
                           rows={3}
                           className="resize-none"
                         />
                       </div>

                       {/* Período / Duração */}
                       <div className="space-y-3">
                         <Label>Períodos e Preços *</Label>
                         <p className="text-xs text-muted-foreground">
                           Marque os períodos desejados e informe o valor (R$) de cada um.
                         </p>
                         <div className="space-y-2">
                           {DURATION_OPTIONS.map((opt) => (
                             <div
                               key={opt.key}
                               className="flex flex-wrap items-center gap-3 p-3 rounded-lg border"
                             >
                               <Checkbox
                                 id={`period-${opt.key}`}
                                 checked={selectedPeriods[opt.key]}
                                 onCheckedChange={() => togglePeriod(opt.key)}
                               />
                               <Label
                                 htmlFor={`period-${opt.key}`}
                                 className="flex-1 min-w-[120px] font-normal cursor-pointer"
                               >
                                 {opt.label} — Duração {opt.durationLabel}
                               </Label>
                               <div className="flex items-center gap-2">
                                 <span className="text-muted-foreground text-sm">R$</span>
                                 <Input
                                   type="text"
                                   inputMode="numeric"
                                   placeholder="0,00"
                                   className="w-32 tabular-nums"
                                   value={prices[opt.key] ? formatDigitsToBRL(prices[opt.key]) : ''}
                                   onKeyDown={(e) => handlePriceKeyDown(opt.key, e)}
                                   onPaste={(e) => handlePricePaste(opt.key, e)}
                                   onChange={(e) => {
                                     const digits = e.target.value.replace(/\D/g, '').slice(0, MAX_PRICE_DIGITS);
                                     setPrice(opt.key, digits);
                                   }}
                                   disabled={!selectedPeriods[opt.key]}
                                 />
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>

                       <div className="space-y-2">
                         <Label htmlFor="checkout-url">URL de Checkout</Label>
                         <Input
                           id="checkout-url"
                           type="url"
                           placeholder="https://checkout.exemplo.com/plano-x"
                           value={checkoutUrl}
                           onChange={(e) => setCheckoutUrl(e.target.value)}
                         />
                         <p className="text-xs text-muted-foreground">
                           Link para onde o usuário será redirecionado ao clicar em &quot;Assinar Agora&quot;.
                         </p>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Step 2: Limites de Recursos */}
                 {currentStep === 2 && (
                   <div className="space-y-4">
                     <div>
                       <h3 className="text-lg font-semibold mb-2">Limites de Recursos</h3>
                       <p className="text-sm text-muted-foreground mb-4">
                         Defina os limites de veículos, clientes e armazenamento. Deixe em branco para ilimitado.
                       </p>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                       <div className="space-y-2">
                         <Label htmlFor="max-vehicles">Limite de veículos</Label>
                         <Input
                           id="max-vehicles"
                           type="number"
                           min={0}
                           placeholder="Ilimitado"
                           value={maxVehicles}
                           onChange={(e) => setMaxVehicles(e.target.value)}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="max-clients">Limite de clientes</Label>
                         <Input
                           id="max-clients"
                           type="number"
                           min={0}
                           placeholder="Ilimitado"
                           value={maxClients}
                           onChange={(e) => setMaxClients(e.target.value)}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="max-storage">Armazenamento (MB)</Label>
                         <Input
                           id="max-storage"
                           type="number"
                           min={0}
                           placeholder="Ilimitado"
                           value={maxStorageMb}
                           onChange={(e) => setMaxStorageMb(e.target.value)}
                         />
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Step 3: Benefícios Customizados */}
                 {currentStep === 3 && (
                   <div className="space-y-4">
                     <div>
                       <h3 className="text-lg font-semibold mb-2">Benefícios Customizados</h3>
                       <p className="text-sm text-muted-foreground mb-4">
                         Adicione benefícios extras que aparecerão no card do plano. Use as setas para
                         reordenar, clique no texto para editar e no ícone para alternar entre check
                         (verde) e X (vermelho).
                       </p>
                     </div>
                     {customBenefits.length === 0 ? (
                       <div className="text-center py-8 border rounded-lg">
                         <p className="text-sm text-muted-foreground">
                           Nenhum benefício customizado adicionado
                         </p>
                       </div>
                     ) : (
                       <ul className="space-y-2">
                         {customBenefits.map((b, i) => (
                           <li
                             key={i}
                             className="flex items-center gap-2 rounded border bg-muted/30 p-3"
                           >
                             <div className="flex flex-col gap-0.5">
                               <Button
                                 type="button"
                                 variant="ghost"
                                 size="icon"
                                 className="h-6 w-6"
                                 onClick={() => moveBenefit(i, 'up')}
                                 disabled={i === 0}
                               >
                                 <ArrowUp className="h-3.5 w-3.5" />
                               </Button>
                               <Button
                                 type="button"
                                 variant="ghost"
                                 size="icon"
                                 className="h-6 w-6"
                                 onClick={() => moveBenefit(i, 'down')}
                                 disabled={i === customBenefits.length - 1}
                               >
                                 <ArrowDown className="h-3.5 w-3.5" />
                               </Button>
                             </div>
                             {editingBenefitIndex === i ? (
                               <Input
                                 className="flex-1 h-8"
                                 value={editingBenefitValue}
                                 onChange={(e) => setEditingBenefitValue(e.target.value)}
                                 onBlur={saveEditBenefit}
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter') saveEditBenefit();
                                   if (e.key === 'Escape') {
                                     setEditingBenefitIndex(null);
                                     setEditingBenefitValue('');
                                   }
                                 }}
                                 autoFocus
                               />
                             ) : (
                               <button
                                 type="button"
                                 className="flex-1 text-left text-sm min-h-8 px-2 rounded hover:bg-muted"
                                 onClick={() => startEditBenefit(i)}
                               >
                                 {b.text || '(vazio)'}
                               </button>
                             )}
                             <Button
                               type="button"
                               variant="ghost"
                               size="icon"
                               className={cn(
                                 'h-8 w-8 shrink-0',
                                 b.positive
                                   ? 'text-green-600 hover:text-green-700'
                                   : 'text-red-600 hover:text-red-700'
                               )}
                               onClick={() => toggleBenefitPositive(i)}
                               title={b.positive ? 'Marcar como não incluído (X)' : 'Marcar como incluído (check)'}
                             >
                               {b.positive ? (
                                 <Check className="h-4 w-4" />
                               ) : (
                                 <X className="h-4 w-4" />
                               )}
                             </Button>
                             <Button
                               type="button"
                               variant="ghost"
                               size="icon"
                               className="h-8 w-8 text-muted-foreground hover:text-destructive"
                               onClick={() => removeBenefit(i)}
                               title="Remover benefício"
                             >
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </li>
                         ))}
                       </ul>
                     )}
                     <div className="flex gap-2">
                       <Input
                         placeholder="Digite um benefício..."
                         value={newBenefitText}
                         onChange={(e) => setNewBenefitText(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                       />
                       <Button type="button" variant="outline" onClick={addBenefit}>
                         Adicionar
                       </Button>
                     </div>
                   </div>
                 )}

                 {/* Step 4: Ativar Plano */}
                 {currentStep === 4 && (
                   <div className="space-y-4">
                     <div>
                       <h3 className="text-lg font-semibold mb-2">Ativar Plano</h3>
                       <p className="text-sm text-muted-foreground mb-4">
                         Se ativo, o plano aparecerá para assinatura. Você pode desativar depois editando o plano.
                       </p>
                     </div>
                     <div className="flex items-center justify-between p-4 rounded-lg border">
                       <div>
                         <Label htmlFor="plan-active" className="text-base font-medium cursor-pointer">
                           Plano ativo (disponível para assinatura)
                         </Label>
                         <p className="text-sm text-muted-foreground mt-1">
                           {active
                             ? 'O plano estará disponível para novos assinantes.'
                             : 'O plano não aparecerá para assinatura.'}
                         </p>
                       </div>
                       <Switch
                         id="plan-active"
                         checked={active}
                         onCheckedChange={setActive}
                       />
                     </div>
                   </div>
                 )}
               </div>

               {/* Navigation Footer */}
               <DialogFooter className="border-t p-4 gap-2">
                 <Button
                   type="button"
                   variant="outline"
                   onClick={() => {
                     if (currentStep > 1) {
                       setCurrentStep(currentStep - 1);
                     } else {
                       setDialogOpen(false);
                     }
                   }}
                 >
                   {currentStep === 1 ? 'Cancelar' : 'Anterior'}
                 </Button>
                 {currentStep < totalSteps ? (
                   <Button
                     type="button"
                     onClick={() => {
                       // Validações por step
                       if (currentStep === 1 && !name.trim()) {
                         toast({
                           variant: 'destructive',
                           title: 'Nome obrigatório',
                           description: 'Informe o nome do plano para continuar.',
                         });
                         return;
                       }
                       if (currentStep === 1) {
                         const selected = DURATION_OPTIONS.filter((o) => selectedPeriods[o.key]);
                         if (selected.length === 0) {
                           toast({
                             variant: 'destructive',
                             title: 'Selecione ao menos um período',
                             description: 'Marque Mensal, Trimestral, Semestral ou Anual.',
                           });
                           return;
                         }
                         for (const opt of selected) {
                           const digits = prices[opt.key] ?? '';
                           const price = digitsToReais(digits);
                           if (digits === '' || price <= 0) {
                             toast({
                               variant: 'destructive',
                               title: `Preço inválido: ${opt.label}`,
                               description: 'Informe um valor numérico válido maior que zero.',
                             });
                             return;
                           }
                         }
                       }
                       setCurrentStep(currentStep + 1);
                     }}
                   >
                     Próximo
                   </Button>
                 ) : (
                   <Button type="submit" disabled={createBatch.isPending}>
                     {createBatch.isPending ? 'Criando…' : 'Criar ofertas'}
                   </Button>
                 )}
               </DialogFooter>
             </form>
           </DialogContent>
         </Dialog>
      </div>

      {/* Statistics Cards */}
      {!isLoadingStats && plansStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Assinaturas Ativas */}
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Assinaturas Ativas</p>
                <Users className="w-8 h-8 text-info" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-info">
                  {plansStats.activeSubscriptions}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Quantidade total de clientes pagando
                </p>
              </div>
            </div>
          </div>

          {/* 2. MRR (Receita Recorrente Mensal) */}
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">MRR</p>
                <DollarSign className="w-8 h-8 text-success" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-success">
                  {formatCurrency(plansStats.mrr)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Faturamento mensal estimado
                </p>
              </div>
            </div>
          </div>

          {/* 3. Plano Mais Vendido */}
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Plano Mais Vendido</p>
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-primary">
                  {plansStats.topPlanBySales?.subscriptionsCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {plansStats.topPlanBySales?.name ? (
                    <span className="truncate block">{plansStats.topPlanBySales.name}</span>
                  ) : (
                    'Nenhum plano vendido'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Plano Mais Lucrativo */}
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Plano Mais Lucrativo</p>
                <Award className="w-8 h-8 text-warning" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-warning">
                  {plansStats.topPlanByRevenue ? formatCurrency(plansStats.topPlanByRevenue.totalRevenue) : 'R$ 0,00'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {plansStats.topPlanByRevenue?.name ? (
                    <span className="truncate block">{plansStats.topPlanByRevenue.name}</span>
                  ) : (
                    'Nenhum plano com faturamento'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Planos */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-elevated p-5 animate-pulse">
              <div className="h-6 bg-muted rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-20 bg-muted rounded mb-3"></div>
            </div>
          ))}
        </div>
      ) : (() => {
        const groups = groupPlansByName(plans);
        if (groups.length === 0) {
          return (
            <div className="card-elevated p-12 text-center">
              <p className="text-muted-foreground">
                Nenhum plano cadastrado. Clique em "Adicionar planos" para criar.
              </p>
            </div>
          );
        }
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {groups.map((group) => {
              const anyActive = group.plans.some((p) => p.active);
              const first = group.plans[0];
              
              return (
                <div
                  key={group.name}
                  className={cn(
                    "card-elevated p-4 flex flex-col gap-3 transition-all hover:shadow-md",
                    !anyActive && "opacity-60"
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-bold text-foreground truncate">
                          {group.name}
                        </h3>
                        <Badge 
                          variant={anyActive ? 'default' : 'secondary'}
                          className={cn(
                            "shrink-0 text-[10px] px-1.5 py-0.5",
                            anyActive ? 'bg-success text-white' : ''
                          )}
                        >
                          {anyActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      {first?.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {first.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ofertas - Cards neutros lado a lado */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Ofertas
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.plans.map((p) => (
                        <div
                          key={p.id}
                          className="p-2 rounded border bg-background hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {periodLabel(p.durationType)}
                            </span>
                            <span className="text-base font-bold text-foreground tabular-nums leading-tight">
                              {formatCurrency(p.price)}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {durationLabel(p.durationType, p.durationMonths)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Limites - Compacto */}
                  {(first?.maxVehicles != null || first?.maxClients != null || first?.maxStorageMb != null) && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Limites
                      </p>
                      <div className="space-y-1">
                        {first.maxVehicles != null && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Veículos:</span>
                            <span className="font-semibold text-foreground">{first.maxVehicles}</span>
                          </div>
                        )}
                        {first.maxClients != null && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Clientes:</span>
                            <span className="font-semibold text-foreground">{first.maxClients}</span>
                          </div>
                        )}
                        {first.maxStorageMb != null && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Armazenamento:</span>
                            <span className="font-semibold text-foreground">
                              {first.maxStorageMb < 1024 
                                ? `${first.maxStorageMb} MB`
                                : `${(first.maxStorageMb / 1024).toFixed(1)} GB`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Benefícios - Compacto */}
                  {first?.customBenefits && Array.isArray(first.customBenefits) && first.customBenefits.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Benefícios
                      </p>
                      <ul className="space-y-1">
                        {first.customBenefits.slice(0, 3).map((benefit, idx) => (
                          <li key={idx} className="flex items-center gap-1.5 text-[10px]">
                            {benefit.positive ? (
                              <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-success/10 flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-success" />
                              </div>
                            ) : (
                              <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-destructive/10 flex items-center justify-center">
                                <X className="h-2.5 w-2.5 text-destructive" />
                              </div>
                            )}
                            <span className={cn(
                              "text-foreground truncate",
                              !benefit.positive && "line-through text-muted-foreground"
                            )}>
                              {benefit.text}
                            </span>
                          </li>
                        ))}
                        {first.customBenefits.length > 3 && (
                          <li className="text-[9px] text-muted-foreground pl-5">
                            +{first.customBenefits.length - 3} mais
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Ações - Compacto */}
                  <div className="pt-2 border-t space-y-1 mt-auto">
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-[10px] px-2"
                        onClick={() => openEditGroup(group)}
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-[10px] px-2"
                        onClick={() => handleDuplicateGroup(group)}
                      >
                        <Copy className="h-3 w-3" />
                        Duplicar
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "gap-1 h-7 text-[10px] px-2",
                          anyActive ? "" : "text-success hover:text-success hover:bg-success/10"
                        )}
                        onClick={() => setDeactivateGroup(group)}
                      >
                        {anyActive ? (
                          <>
                            <PowerOff className="h-3 w-3" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <Power className="h-3 w-3" />
                            Ativar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-[10px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteGroup(group)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Modal Editar plano (grupo) */}
      <Dialog
        open={editGroup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditGroup(null);
            setEditForm(null);
            setEditCurrentStep(1);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle>Editar plano</DialogTitle>
            <DialogDescription>
              Altere os dados do plano em etapas. Complete cada passo para avançar.
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center py-6 px-8 border-b">
            {[1, 2, 3, 4].map((step, index) => (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors shrink-0",
                      step < editCurrentStep
                        ? "bg-success text-white"
                        : step === editCurrentStep
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step < editCurrentStep ? <Check className="h-5 w-5" /> : step}
                  </div>
                  <span
                    className={cn(
                      "text-xs mt-2 text-center font-medium whitespace-nowrap",
                      step <= editCurrentStep ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step === 1 && "Básico"}
                    {step === 2 && "Limites"}
                    {step === 3 && "Benefícios"}
                    {step === 4 && "Ativar"}
                  </span>
                </div>
                {index < 3 && (
                  <div
                    className={cn(
                      "h-1 flex-1 mx-4 transition-colors",
                      step < editCurrentStep ? "bg-success" : "bg-muted"
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {editGroup && editForm && (
            <form
              className="flex-1 overflow-y-auto"
              onSubmit={(e) => {
                e.preventDefault();
                saveEditGroup();
              }}
            >
              <div className="p-6 space-y-6">
                {/* Step 1: Informações Básicas */}
                {editCurrentStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Informações Básicas</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Defina o nome, descrição, preços e URL de checkout do plano.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Nome do plano *</Label>
                        <Input
                          id="edit-name"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : null))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-desc">Descrição (opcional)</Label>
                        <Textarea
                          id="edit-desc"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((prev) => (prev ? { ...prev, description: e.target.value } : null))
                          }
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Períodos e Preços *</Label>
                        <p className="text-xs text-muted-foreground">
                          Desmarque um período para desativá-lo temporariamente. Você pode reativá-lo depois. Pelo menos um período deve estar ativo.
                        </p>
                        <div className="rounded-lg border p-3 space-y-2">
                          {(allPlansForEdit.length > 0 ? allPlansForEdit : editGroup.plans).map((p) => {
                            const isEnabled = editForm.enabledPlans[p.id] ?? (p.active ?? true);
                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg border",
                                  !isEnabled && "opacity-50 bg-muted/20"
                                )}
                              >
                                <Checkbox
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => {
                                    const enabledCount = Object.values(editForm.enabledPlans).filter(Boolean).length;
                                    if (!checked && enabledCount <= 1) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Não é possível desabilitar',
                                        description: 'O plano deve ter pelo menos um período ativo.',
                                      });
                                      return;
                                    }
                                    setEditForm((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            enabledPlans: {
                                              ...prev.enabledPlans,
                                              [p.id]: checked as boolean,
                                            },
                                          }
                                        : null
                                    );
                                  }}
                                />
                                <Label
                                  className="flex-1 min-w-[150px] font-normal cursor-pointer"
                                >
                                  {periodLabel(p.durationType)} — {durationLabel(p.durationType, p.durationMonths)}
                                </Label>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-sm">R$</span>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0,00"
                                    className="w-32 tabular-nums"
                                    value={
                                      editForm.prices[p.id]
                                        ? formatDigitsToBRL(editForm.prices[p.id])
                                        : ''
                                    }
                                    onKeyDown={(e) => handleEditPriceKeyDown(p.id, e)}
                                    onPaste={(e) => handleEditPricePaste(p.id, e)}
                                    onChange={(e) => {
                                      const digits = e.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, MAX_PRICE_DIGITS);
                                      setEditPrice(p.id, digits);
                                    }}
                                    disabled={!isEnabled}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-checkout">URL de Checkout</Label>
                        <Input
                          id="edit-checkout"
                          type="url"
                          placeholder="https://checkout.exemplo.com/plano-x"
                          value={editForm.checkoutUrl}
                          onChange={(e) =>
                            setEditForm((prev) => (prev ? { ...prev, checkoutUrl: e.target.value } : null))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Link para onde o usuário será redirecionado ao clicar em &quot;Assinar Agora&quot;.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Limites de Recursos */}
                {editCurrentStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Limites de Recursos</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Defina os limites de veículos e clientes. Deixe em branco para ilimitado.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-max-vehicles">Limite de veículos</Label>
                        <Input
                          id="edit-max-vehicles"
                          type="number"
                          min={0}
                          placeholder="Ilimitado"
                          value={editForm.maxVehicles}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev ? { ...prev, maxVehicles: e.target.value } : null
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-max-clients">Limite de clientes</Label>
                        <Input
                          id="edit-max-clients"
                          type="number"
                          min={0}
                          placeholder="Ilimitado"
                          value={editForm.maxClients}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev ? { ...prev, maxClients: e.target.value } : null
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Benefícios Customizados */}
                {editCurrentStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Benefícios Customizados</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Adicione benefícios extras que aparecerão no card do plano. Use as setas para
                        reordenar, clique no texto para editar e no ícone para alternar entre check
                        (verde) e X (vermelho).
                      </p>
                    </div>
                    {editForm.customBenefits.length === 0 ? (
                      <div className="text-center py-8 border rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Nenhum benefício customizado adicionado
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {editForm.customBenefits.map((b, i) => {
                          const editingIndex = editingBenefitIndex;
                          return (
                            <li
                              key={i}
                              className="flex items-center gap-2 rounded border bg-muted/30 p-3"
                            >
                              <div className="flex flex-col gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    const newBenefits = [...editForm.customBenefits];
                                    if (i > 0) {
                                      [newBenefits[i], newBenefits[i - 1]] = [newBenefits[i - 1], newBenefits[i]];
                                      setEditForm((prev) => prev ? { ...prev, customBenefits: newBenefits } : null);
                                    }
                                  }}
                                  disabled={i === 0}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    const newBenefits = [...editForm.customBenefits];
                                    if (i < newBenefits.length - 1) {
                                      [newBenefits[i], newBenefits[i + 1]] = [newBenefits[i + 1], newBenefits[i]];
                                      setEditForm((prev) => prev ? { ...prev, customBenefits: newBenefits } : null);
                                    }
                                  }}
                                  disabled={i === editForm.customBenefits.length - 1}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {editingIndex === i ? (
                                <Input
                                  className="flex-1 h-8"
                                  value={editingBenefitValue}
                                  onChange={(e) => setEditingBenefitValue(e.target.value)}
                                  onBlur={() => {
                                    if (editingIndex !== null) {
                                      const text = editingBenefitValue.trim();
                                      if (text) {
                                        const newBenefits = [...editForm.customBenefits];
                                        newBenefits[editingIndex] = { ...newBenefits[editingIndex], text };
                                        setEditForm((prev) => prev ? { ...prev, customBenefits: newBenefits } : null);
                                      }
                                    }
                                    setEditingBenefitIndex(null);
                                    setEditingBenefitValue('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (editingIndex !== null) {
                                        const text = editingBenefitValue.trim();
                                        if (text) {
                                          const newBenefits = [...editForm.customBenefits];
                                          newBenefits[editingIndex] = { ...newBenefits[editingIndex], text };
                                          setEditForm((prev) => prev ? { ...prev, customBenefits: newBenefits } : null);
                                        }
                                      }
                                      setEditingBenefitIndex(null);
                                      setEditingBenefitValue('');
                                    }
                                    if (e.key === 'Escape') {
                                      setEditingBenefitIndex(null);
                                      setEditingBenefitValue('');
                                    }
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="flex-1 text-left text-sm min-h-8 px-2 rounded hover:bg-muted"
                                  onClick={() => {
                                    setEditingBenefitIndex(i);
                                    setEditingBenefitValue(b.text);
                                  }}
                                >
                                  {b.text || '(vazio)'}
                                </button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'h-8 w-8 shrink-0',
                                  b.positive
                                    ? 'text-green-600 hover:text-green-700'
                                    : 'text-red-600 hover:text-red-700'
                                )}
                                onClick={() => {
                                  const newBenefits = [...editForm.customBenefits];
                                  newBenefits[i] = { ...newBenefits[i], positive: !newBenefits[i].positive };
                                  setEditForm((prev) => prev ? { ...prev, customBenefits: newBenefits } : null);
                                }}
                                title={b.positive ? 'Marcar como não incluído (X)' : 'Marcar como incluído (check)'}
                              >
                                {b.positive ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  const newBenefits = editForm.customBenefits.filter((_, idx) => idx !== i);
                                  setEditForm((prev) => prev ? { ...prev, customBenefits: newBenefits } : null);
                                }}
                                title="Remover benefício"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite um benefício..."
                        value={newBenefitText}
                        onChange={(e) => setNewBenefitText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const text = newBenefitText.trim();
                            if (text) {
                              setEditForm((prev) => prev ? { ...prev, customBenefits: [...(prev?.customBenefits || []), { text, positive: true }] } : null);
                              setNewBenefitText('');
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const text = newBenefitText.trim();
                          if (text) {
                            setEditForm((prev) => prev ? { ...prev, customBenefits: [...(prev?.customBenefits || []), { text, positive: true }] } : null);
                            setNewBenefitText('');
                          }
                        }}
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4: Ativar Plano */}
                {editCurrentStep === 4 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Ativar Plano</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Se ativo, o plano aparecerá para assinatura. Você pode desativar depois editando o plano.
                      </p>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <Label htmlFor="edit-active" className="text-base font-medium cursor-pointer">
                          Plano ativo (disponível para assinatura)
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {editForm.active
                            ? 'O plano estará disponível para novos assinantes.'
                            : 'O plano não aparecerá para assinatura.'}
                        </p>
                      </div>
                      <Switch
                        id="edit-active"
                        checked={editForm.active}
                        onCheckedChange={(checked) =>
                          setEditForm((prev) => (prev ? { ...prev, active: checked } : null))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Footer */}
              <DialogFooter className="border-t p-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (editCurrentStep > 1) {
                      setEditCurrentStep(editCurrentStep - 1);
                    } else {
                      setEditGroup(null);
                      setEditForm(null);
                      setEditCurrentStep(1);
                    }
                  }}
                >
                  {editCurrentStep === 1 ? 'Cancelar' : 'Anterior'}
                </Button>
                {editCurrentStep < editTotalSteps ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (editCurrentStep === 1 && !editForm.name.trim()) {
                        toast({
                          variant: 'destructive',
                          title: 'Nome obrigatório',
                          description: 'Informe o nome do plano para continuar.',
                        });
                        return;
                      }
                      setEditCurrentStep(editCurrentStep + 1);
                    }}
                  >
                    Próximo
                  </Button>
                ) : (
                  <Button type="submit" disabled={updatePlanMutation.isPending}>
                    {updatePlanMutation.isPending ? 'Salvando…' : 'Salvar'}
                  </Button>
                )}
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteGroup !== null}
        onOpenChange={(open) => !open && setDeleteGroup(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir plano"
        description={
          deleteGroup ? (
            <>
              Todas as ofertas do plano &quot;{deleteGroup.name}&quot; serão excluídas
              (exclusão lógica). Esta ação pode ser revertida pelo suporte. Deseja continuar?
            </>
          ) : (
            ''
          )
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        icon={Trash2}
      />

      <ConfirmDialog
        open={deactivateGroup !== null}
        onOpenChange={(open) => !open && setDeactivateGroup(null)}
        onConfirm={handleDeactivateConfirm}
        title={deactivateGroup && !deactivateGroup.plans.some((p) => p.active) ? "Ativar plano" : "Desativar plano"}
        description={
          deactivateGroup ? (
            deactivateGroup.plans.some((p) => p.active) ? (
              <>
                O plano &quot;{deactivateGroup.name}&quot; não aparecerá mais para assinatura.
                Você pode reativar depois editando o plano. Deseja continuar?
              </>
            ) : (
              <>
                O plano &quot;{deactivateGroup.name}&quot; aparecerá para assinatura novamente.
                Deseja continuar?
              </>
            )
          ) : (
            ''
          )
        }
        confirmText={deactivateGroup && !deactivateGroup.plans.some((p) => p.active) ? "Ativar" : "Desativar"}
        cancelText="Cancelar"
      />
    </div>
  );
}
