import { useState, useEffect, useRef } from 'react';
import { Settings, Store, ClipboardList, Receipt, Users, Bell, Plus, Trash2, GripVertical, Loader2, X, ImagePlus, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettings, useUpdateStoreInfo, useUpdateSettings, useUploadStoreLogo, useUploadStoreLogoDark, DefaultChecklistItem } from '@/hooks/useSettings';
import { toPublicImageUrl } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { QueryErrorState } from '@/components/QueryErrorState';
import { cn } from '@/lib/utils';

type SectionType = 'store' | 'checklist' | 'expenses' | 'clients' | 'alerts';

const Configuracoes = () => {
  const { data, isLoading, isError, error } = useSettings();
  const updateStoreInfoMutation = useUpdateStoreInfo();
  const updateSettingsMutation = useUpdateSettings();
  const uploadStoreLogoMutation = useUploadStoreLogo();
  const uploadStoreLogoDarkMutation = useUploadStoreLogoDark();

  const [activeSection, setActiveSection] = useState<SectionType>('store');

  // Store / Identidade empresarial
  const [storeName, setStoreName] = useState('');
  const [storeLegalName, setStoreLegalName] = useState('');
  const [storeTradeName, setStoreTradeName] = useState('');
  const [storeCpfCnpj, setStoreCpfCnpj] = useState('');
  const [storeStateRegistration, setStoreStateRegistration] = useState('');
  const [storeStreet, setStoreStreet] = useState('');
  const [storeNumber, setStoreNumber] = useState('');
  const [storeComplement, setStoreComplement] = useState('');
  const [storeNeighborhood, setStoreNeighborhood] = useState('');
  const [storeZipCode, setStoreZipCode] = useState('');
  const [storeCity, setStoreCity] = useState('');
  const [storeState, setStoreState] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeWhatsApp, setStoreWhatsApp] = useState('');
  const [storeWebsite, setStoreWebsite] = useState('');
  const [storeInstagram, setStoreInstagram] = useState('');
  const [storeFacebook, setStoreFacebook] = useState('');
  const [storeLogo, setStoreLogo] = useState('');
  const [storeLogoDark, setStoreLogoDark] = useState('');
  const [reportResponsible, setReportResponsible] = useState('');
  const [reportIncludeLegalNotice, setReportIncludeLegalNotice] = useState(true);
  const [reportLegalNoticeText, setReportLegalNoticeText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputDarkRef = useRef<HTMLInputElement>(null);

  // Checklist
  const [checklistItems, setChecklistItems] = useState<DefaultChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Expenses
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [expenseRequiresVehicle, setExpenseRequiresVehicle] = useState(false);
  const [draggedExpenseIndex, setDraggedExpenseIndex] = useState<number | null>(null);

  // Clients
  const [recurringClientThreshold, setRecurringClientThreshold] = useState(2);

  // Alerts
  const [alerts, setAlerts] = useState({
    checklistComplete: false,
    daysInStock: 0,
    lowProfit: 0,
  });

  // Load data
  useEffect(() => {
    if (data) {
      const s = data.store;
      setStoreName(s.name || '');
      setStoreLegalName(s.legalName || '');
      setStoreTradeName(s.tradeName || '');
      setStoreCpfCnpj(s.cpfCnpj || '');
      setStoreStateRegistration(s.stateRegistration || '');
      setStoreStreet(s.street || '');
      setStoreNumber(s.number || '');
      setStoreComplement(s.complement || '');
      setStoreNeighborhood(s.neighborhood || '');
      setStoreZipCode(s.zipCode || '');
      setStoreCity(s.city || '');
      setStoreState(s.state || '');
      setStoreEmail(s.email || '');
      setStorePhone(s.phone || '');
      setStoreWhatsApp(s.whatsapp || '');
      setStoreWebsite(s.website || '');
      setStoreInstagram(s.instagram || '');
      setStoreFacebook(s.facebook || '');
      setStoreLogo(s.logo || '');
      setStoreLogoDark(s.logoDark || '');
      const r = data.report;
      if (r) {
        setReportResponsible(r.responsible || '');
        setReportIncludeLegalNotice(r.includeLegalNotice ?? true);
        setReportLegalNoticeText(r.legalNoticeText || '');
      }
      setChecklistItems(data.settings.defaultChecklist);
      setExpenseCategories(data.settings.expenseCategories);
      setExpenseRequiresVehicle(data.settings.expenseRequiresVehicle);
      setRecurringClientThreshold(data.settings.recurringClientThreshold);
      setAlerts(data.settings.alerts);
    }
  }, [data]);

  const buildStorePayload = () => ({
    name: storeName,
    legalName: storeLegalName || undefined,
    tradeName: storeTradeName || undefined,
    cpfCnpj: storeCpfCnpj || undefined,
    stateRegistration: storeStateRegistration || undefined,
    street: storeStreet || undefined,
    number: storeNumber || undefined,
    complement: storeComplement || undefined,
    neighborhood: storeNeighborhood || undefined,
    zipCode: storeZipCode || undefined,
    city: storeCity || undefined,
    state: storeState || undefined,
    email: storeEmail || undefined,
    phone: storePhone || undefined,
    whatsapp: storeWhatsApp || undefined,
    website: storeWebsite || undefined,
    instagram: storeInstagram || undefined,
    facebook: storeFacebook || undefined,
    logo: storeLogo || undefined,
    logoDark: storeLogoDark || undefined,
    reportResponsible: reportResponsible || undefined,
    reportIncludeLegalNotice: reportIncludeLegalNotice,
    reportLegalNoticeText: reportLegalNoticeText || undefined,
  });

  const handleSaveStoreInfo = async () => {
    try {
      await updateStoreInfoMutation.mutateAsync(buildStorePayload());
      toast({
        title: 'Identidade salva',
        description: 'As informações da loja e relatórios foram atualizadas.',
      });
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Erro ao salvar';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem (PNG, JPG, etc.).', variant: 'destructive' });
      return;
    }
    try {
      const result = await uploadStoreLogoMutation.mutateAsync(file);
      if (result?.store?.logo) setStoreLogo(result.store.logo);
      toast({ title: 'Logo atualizada', description: 'A logo da loja foi atualizada e aparecerá em relatórios e impressões.' });
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Erro ao enviar logo';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
    e.target.value = '';
  };

  const handleRemoveLogo = async () => {
    try {
      await updateStoreInfoMutation.mutateAsync({ ...buildStorePayload(), logo: '' });
      setStoreLogo('');
      toast({ title: 'Logo removida', description: 'A logo da loja foi removida.' });
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Erro ao remover logo';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const handleLogoDarkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem (PNG, JPG).', variant: 'destructive' });
      return;
    }
    try {
      const result = await uploadStoreLogoDarkMutation.mutateAsync(file);
      if (result?.store?.logoDark) setStoreLogoDark(result.store.logoDark);
      toast({ title: 'Logo escura atualizada', description: 'Usada em PDFs e modo escuro.' });
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Erro ao enviar logo';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
    e.target.value = '';
  };

  const handleRemoveLogoDark = async () => {
    try {
      await updateStoreInfoMutation.mutateAsync({ ...buildStorePayload(), logoDark: '' });
      setStoreLogoDark('');
      toast({ title: 'Logo escura removida', description: 'A logo para modo escuro foi removida.' });
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Erro ao remover';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        defaultChecklist: checklistItems,
        expenseCategories,
        expenseRequiresVehicle,
        recurringClientThreshold,
        alerts,
      });
      toast({
        title: 'Configurações salvas',
        description: 'As configurações foram atualizadas com sucesso.',
      });
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Erro ao salvar configurações';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const newItem: DefaultChecklistItem = {
      name: newChecklistItem.trim(),
      enabled: true,
      order: checklistItems.length,
    };
    setChecklistItems([...checklistItems, newItem]);
    setNewChecklistItem('');
  };

  const handleRemoveChecklistItem = (index: number) => {
    const newItems = checklistItems.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      order: i,
    }));
    setChecklistItems(newItems);
  };

  const handleToggleChecklistItem = (index: number) => {
    const newItems = [...checklistItems];
    newItems[index].enabled = !newItems[index].enabled;
    setChecklistItems(newItems);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newItems = [...checklistItems];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    const reordered = newItems.map((item, i) => ({ ...item, order: i }));
    setChecklistItems(reordered);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleAddExpenseCategory = () => {
    if (!newExpenseCategory.trim()) return;
    if (expenseCategories.includes(newExpenseCategory.trim())) {
      toast({
        title: 'Categoria já existe',
        description: 'Esta categoria já está cadastrada.',
        variant: 'destructive',
      });
      return;
    }
    setExpenseCategories([...expenseCategories, newExpenseCategory.trim()]);
    setNewExpenseCategory('');
  };

  const handleRemoveExpenseCategory = (index: number) => {
    setExpenseCategories(expenseCategories.filter((_, i) => i !== index));
  };

  const handleExpenseDragStart = (e: React.DragEvent, index: number) => {
    setDraggedExpenseIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleExpenseDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleExpenseDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedExpenseIndex === null || draggedExpenseIndex === dropIndex) {
      setDraggedExpenseIndex(null);
      return;
    }

    const newCategories = [...expenseCategories];
    const draggedCategory = newCategories[draggedExpenseIndex];
    newCategories.splice(draggedExpenseIndex, 1);
    newCategories.splice(dropIndex, 0, draggedCategory);
    setExpenseCategories(newCategories);
    setDraggedExpenseIndex(null);
  };

  const handleExpenseDragEnd = () => {
    setDraggedExpenseIndex(null);
  };

  const formatPhoneInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 11);
    if (!numericValue) return '';
    
    if (numericValue.length <= 2) {
      return `(${numericValue}`;
    } else if (numericValue.length <= 7) {
      return `(${numericValue.slice(0, 2)}) ${numericValue.slice(2)}`;
    } else {
      return `(${numericValue.slice(0, 2)}) ${numericValue.slice(2, 7)}-${numericValue.slice(7)}`;
    }
  };

  const sections = [
    { id: 'store' as SectionType, label: 'Identidade da Loja', icon: Store },
    { id: 'expenses' as SectionType, label: 'Despesas', icon: Receipt },
    { id: 'checklist' as SectionType, label: 'Checklist Padrão', icon: ClipboardList },
    { id: 'clients' as SectionType, label: 'Clientes', icon: Users },
    { id: 'alerts' as SectionType, label: 'Alertas', icon: Bell },
  ];

  if (isError) {
    return (
      <div className="space-y-6">
        <QueryErrorState message={error?.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'store':
        return (
          <div className="card-elevated p-6 space-y-8">
            <div className="flex items-center gap-3">
              <Store className="w-6 h-6 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground text-lg">Identidade empresarial</h3>
                <p className="text-sm text-muted-foreground">Dados fiscais, endereço, contato e identidade visual para relatórios e impressões</p>
              </div>
            </div>

            {/* Nome fantasia */}
            <div className="space-y-2">
              <Label htmlFor="store-name">Nome fantasia *</Label>
              <Input
                id="store-name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Veic Motors"
              />
            </div>

            {/* Dados fiscais */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground border-b pb-2">Dados fiscais</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="store-legalName">Razão social</Label>
                  <Input id="store-legalName" value={storeLegalName} onChange={(e) => setStoreLegalName(e.target.value)} placeholder="Ex: Veic Motors Ltda" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-tradeName">Nome fantasia (comercial)</Label>
                  <Input id="store-tradeName" value={storeTradeName} onChange={(e) => setStoreTradeName(e.target.value)} placeholder="Ex: Veic Motors" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-cpfCnpj">CNPJ / CPF</Label>
                  <Input
                    id="store-cpfCnpj"
                    value={storeCpfCnpj}
                    onChange={(e) => setStoreCpfCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))}
                    placeholder="Apenas números"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-stateRegistration">Inscrição estadual (opcional)</Label>
                  <Input id="store-stateRegistration" value={storeStateRegistration} onChange={(e) => setStoreStateRegistration(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground border-b pb-2">Endereço completo</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="store-street">Rua</Label>
                  <Input id="store-street" value={storeStreet} onChange={(e) => setStoreStreet(e.target.value)} placeholder="Ex: Av. Paulista" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-number">Número</Label>
                  <Input id="store-number" value={storeNumber} onChange={(e) => setStoreNumber(e.target.value)} placeholder="Ex: 1000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-complement">Complemento</Label>
                  <Input id="store-complement" value={storeComplement} onChange={(e) => setStoreComplement(e.target.value)} placeholder="Sala, andar" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-neighborhood">Bairro</Label>
                  <Input id="store-neighborhood" value={storeNeighborhood} onChange={(e) => setStoreNeighborhood(e.target.value)} placeholder="Ex: Bela Vista" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-zipCode">CEP</Label>
                  <Input
                    id="store-zipCode"
                    value={storeZipCode}
                    onChange={(e) => setStoreZipCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-city">Cidade</Label>
                  <Input id="store-city" value={storeCity} onChange={(e) => setStoreCity(e.target.value)} placeholder="Ex: São Paulo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-state">Estado</Label>
                  <Input id="store-state" value={storeState} onChange={(e) => setStoreState(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
                </div>
              </div>
            </div>

            {/* Contato oficial */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground border-b pb-2">Contato oficial</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="store-email">E-mail da loja</Label>
                  <Input id="store-email" type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} placeholder="contato@loja.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-phone">Telefone fixo (opcional)</Label>
                  <Input
                    id="store-phone"
                    value={storePhone}
                    onChange={(e) => setStorePhone(formatPhoneInput(e.target.value))}
                    placeholder="(11) 3333-4444"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-whatsapp">WhatsApp</Label>
                  <Input
                    id="store-whatsapp"
                    value={storeWhatsApp}
                    onChange={(e) => setStoreWhatsApp(formatPhoneInput(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            {/* Presença digital */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground border-b pb-2">Presença digital</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="store-website">Site</Label>
                  <Input id="store-website" type="url" value={storeWebsite} onChange={(e) => setStoreWebsite(e.target.value)} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-instagram">Instagram</Label>
                  <Input id="store-instagram" value={storeInstagram} onChange={(e) => setStoreInstagram(e.target.value)} placeholder="@loja ou URL" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-facebook">Facebook</Label>
                  <Input id="store-facebook" value={storeFacebook} onChange={(e) => setStoreFacebook(e.target.value)} placeholder="URL ou nome da página" />
                </div>
              </div>
            </div>

            {/* Identidade visual: logos + cores */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground border-b pb-2">Identidade visual</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Logo (fundo claro)</Label>
                  <p className="text-xs text-muted-foreground">Relatórios e impressões. PNG/JPG, máx. 2MB.</p>
                  {storeLogo ? (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="w-16 h-16 rounded-lg border overflow-hidden bg-muted flex-shrink-0">
                        <img src={toPublicImageUrl(storeLogo) ?? storeLogo} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadStoreLogoMutation.isPending}>
                          {uploadStoreLogoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Alterar'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleRemoveLogo}>Remover</Button>
                      </div>
                    </div>
                  ) : (
                    <div role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()} className="mt-2 flex items-center justify-center gap-2 w-28 h-28 rounded-lg border-2 border-dashed border-border bg-muted/50 cursor-pointer">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Enviar logo</span>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
                </div>
                <div className="space-y-2">
                  <Label>Logo modo escuro (opcional)</Label>
                  <p className="text-xs text-muted-foreground">Para PDFs e fundos escuros.</p>
                  {storeLogoDark ? (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="w-16 h-16 rounded-lg border overflow-hidden bg-muted flex-shrink-0">
                        <img src={toPublicImageUrl(storeLogoDark) ?? storeLogoDark} alt="Logo escura" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputDarkRef.current?.click()} disabled={uploadStoreLogoDarkMutation.isPending}>
                          {uploadStoreLogoDarkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Alterar'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleRemoveLogoDark}>Remover</Button>
                      </div>
                    </div>
                  ) : (
                    <div role="button" tabIndex={0} onClick={() => fileInputDarkRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileInputDarkRef.current?.click()} className="mt-2 flex items-center justify-center gap-2 w-28 h-28 rounded-lg border-2 border-dashed border-border bg-muted/50 cursor-pointer">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Enviar logo</span>
                    </div>
                  )}
                  <input ref={fileInputDarkRef} type="file" accept="image/*" className="hidden" onChange={handleLogoDarkFileChange} />
                </div>
              </div>
            </div>

            {/* Responsável e aviso legal */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground border-b pb-2">Assinatura e aviso legal</h4>
              <div className="space-y-2">
                <Label htmlFor="report-responsible">Responsável pelo relatório</Label>
                <Input id="report-responsible" value={reportResponsible} onChange={(e) => setReportResponsible(e.target.value)} placeholder="Ex: José Silva – Gestor de Estoque" />
                <p className="text-xs text-muted-foreground">Aparece nos PDFs como &quot;Relatório emitido por: [nome]&quot;</p>
              </div>
              <div className="flex items-start gap-2 pt-2">
                <Checkbox id="report-includeLegalNotice" checked={reportIncludeLegalNotice} onCheckedChange={(v) => setReportIncludeLegalNotice(v === true)} />
                <div className="space-y-1 flex-1">
                  <Label htmlFor="report-includeLegalNotice" className="cursor-pointer">Incluir aviso legal nos relatórios</Label>
                  <Input
                    id="report-legalNoticeText"
                    value={reportLegalNoticeText}
                    onChange={(e) => setReportLegalNoticeText(e.target.value)}
                    placeholder="Este relatório é informativo e não substitui documentos fiscais."
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSaveStoreInfo} disabled={updateStoreInfoMutation.isPending || !storeName.trim()}>
                {updateStoreInfoMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar identidade empresarial'}
              </Button>
            </div>
          </div>
        );

      case 'checklist':
        return (
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <ClipboardList className="w-6 h-6 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground text-lg">Checklist Padrão dos Veículos</h3>
                <p className="text-sm text-muted-foreground">
                  Esse checklist será aplicado automaticamente a todos os novos veículos cadastrados
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                {checklistItems.map((item, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-move",
                      draggedIndex === index && "opacity-50"
                    )}
                  >
                    <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <Checkbox
                      checked={item.enabled}
                      onCheckedChange={() => handleToggleChecklistItem(index)}
                    />
                    <span className={cn("flex-1", !item.enabled && "line-through text-muted-foreground")}>
                      {item.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveChecklistItem(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  placeholder="Digite o nome da nova tarefa"
                />
                <Button onClick={handleAddChecklistItem} disabled={!newChecklistItem.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t">
                <Checkbox
                  id="apply-to-existing"
                  checked={applyToExisting}
                  onCheckedChange={(checked) => setApplyToExisting(checked as boolean)}
                />
                <Label htmlFor="apply-to-existing" className="cursor-pointer">
                  Aplicar esse checklist também aos veículos já cadastrados?
                </Label>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar checklist'
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'expenses':
        return (
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <Receipt className="w-6 h-6 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground text-lg">Configurações de Despesas</h3>
                <p className="text-sm text-muted-foreground">Configure como o sistema gerencia suas despesas</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Categorias padrão</Label>
                <div className="space-y-2">
                  {expenseCategories.map((category, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={(e) => handleExpenseDragStart(e, index)}
                      onDragOver={handleExpenseDragOver}
                      onDrop={(e) => handleExpenseDrop(e, index)}
                      onDragEnd={handleExpenseDragEnd}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-move",
                        draggedExpenseIndex === index && "opacity-50"
                      )}
                    >
                      <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm">{category}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveExpenseCategory(index)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={newExpenseCategory}
                  onChange={(e) => setNewExpenseCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddExpenseCategory();
                    }
                  }}
                  placeholder="Digite o nome da categoria"
                />
                <Button onClick={handleAddExpenseCategory} disabled={!newExpenseCategory.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label htmlFor="expense-requires-vehicle" className="cursor-pointer">
                    Despesa obrigatória precisa de veículo vinculado?
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Se ativado, todas as despesas precisarão estar vinculadas a um veículo
                  </p>
                </div>
                <Switch
                  id="expense-requires-vehicle"
                  checked={expenseRequiresVehicle}
                  onCheckedChange={setExpenseRequiresVehicle}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar configurações'
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'clients':
        return (
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground text-lg">Configurações de Clientes</h3>
                <p className="text-sm text-muted-foreground">Defina quando um cliente vira recorrente</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recurring-threshold">Cliente vira recorrente a partir de:</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="recurring-threshold"
                    type="number"
                    min="1"
                    value={recurringClientThreshold}
                    onChange={(e) => setRecurringClientThreshold(parseInt(e.target.value) || 2)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">compras</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ex: Se definir 2, clientes com 2 ou mais compras serão considerados recorrentes
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar configurações'
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'alerts':
        return (
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-6 h-6 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground text-lg">Alertas Simples</h3>
                <p className="text-sm text-muted-foreground">Configure quando você quer ser avisado</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="alert-checklist" className="cursor-pointer">
                    Checklist de veículo estiver completo
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Receba um aviso quando um checklist for concluído
                  </p>
                </div>
                <Switch
                  id="alert-checklist"
                  checked={alerts.checklistComplete}
                  onCheckedChange={(checked) => setAlerts({ ...alerts, checklistComplete: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="alert-stock" className="cursor-pointer">
                    Veículo ficar X dias em estoque
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Avisar quando um veículo ficar parado por muitos dias
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="alert-stock"
                    type="number"
                    min="0"
                    value={alerts.daysInStock || 0}
                    onChange={(e) => setAlerts({ ...alerts, daysInStock: parseInt(e.target.value) || 0 })}
                    className="w-24"
                    disabled={alerts.daysInStock === 0}
                  />
                  <span className="text-sm text-muted-foreground">dias</span>
                  <Switch
                    checked={alerts.daysInStock > 0}
                    onCheckedChange={(checked) => setAlerts({ ...alerts, daysInStock: checked ? 30 : 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="alert-profit" className="cursor-pointer">
                    Venda abaixo do lucro esperado
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Avisar quando uma venda tiver lucro abaixo de X%
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="alert-profit"
                    type="number"
                    min="0"
                    max="100"
                    value={alerts.lowProfit || 0}
                    onChange={(e) => setAlerts({ ...alerts, lowProfit: parseInt(e.target.value) || 0 })}
                    className="w-24"
                    disabled={alerts.lowProfit === 0}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <Switch
                    checked={alerts.lowProfit > 0}
                    onCheckedChange={(checked) => setAlerts({ ...alerts, lowProfit: checked ? 10 : 0 })}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar alertas'
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          Personalize a plataforma para funcionar do jeito da sua loja
        </p>
      </div>

      {/* Layout com Sidebar e Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar de Navegação */}
        <div className="lg:col-span-1">
          <div className="card-elevated p-4 space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm">{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo da Seção Selecionada */}
        <div className="lg:col-span-3">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
