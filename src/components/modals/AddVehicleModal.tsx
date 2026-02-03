import { useState, useRef, useEffect } from 'react';
import { Car, Upload, X, Loader2, Calendar as CalendarIcon, Plus, Star, GripVertical, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useCreateVehicle } from '@/hooks/useVehicles';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useFipeBrands, useFipeModels, useFipeYears, useFipePrice } from '@/hooks/useFipe';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ColorSelect, VEHICLE_COLORS } from '@/components/ui/ColorSelect';

interface AddVehicleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CAR_FEATURES = [
  'Ar-condicionado',
  'Airbags',
  'Freios ABS',
  'Controle de estabilidade',
  'Vidros e travas elétricas',
  'Direção assistida',
  'Central multimídia com Bluetooth',
  'Apple CarPlay/Android Auto',
  'Câmera de ré',
  'Sensores de estacionamento',
  'Rodas de liga leve',
  'Faróis de LED',
  'Insulfilm',
];

const MOTORCYCLE_FEATURES = [
  'Freios ABS',
  'Painel digital',
  'Partida elétrica',
  'Controle de tração',
  'Modos de pilotagem',
  'Iluminação em LED',
  'Baú / case traseiro',
  'Suporte para baú',
  'Escapamento esportivo',
  'Protetor de motor',
  'Sliders',
  'Parabrisa / bolha',
  'Tomada USB',
];

const initialFormData = {
  vehicleType: '' as 'car' | 'motorcycle' | '',
  brand: '',
  brandId: '', // ID da marca na FIPE
  model: '', // Modelo/Versão (pode ser da API ou personalizado)
  modelId: '', // ID do modelo na FIPE (vazio se personalizado)
  isCustomModel: false, // Se o modelo é personalizado
  year: '',
  yearId: '', // ID do ano na FIPE (vazio se personalizado)
  isCustomYear: false, // Se o ano é personalizado
  km: '',
  plate: '',
  fuel: '',
  color: '',
  transmission: '',
  steering: '',
  origin: 'own' as 'own' | 'consignment' | 'repass',
  features: [] as string[],
  purchasePrice: '',
  salePrice: '',
  fipePrice: '', // Preço FIPE
  description: '',
  // Consignado
  consignmentOwnerName: '',
  consignmentOwnerPhone: '',
  consignmentCommissionType: '' as 'percentual' | 'fixed' | '',
  consignmentCommissionValue: '',
  consignmentMinRepassValue: '',
  consignmentStartDate: undefined as Date | undefined,
};

interface ImageItem {
  file: File;
  preview: string;
  isCover: boolean;
}

export function AddVehicleModal({ open, onOpenChange }: AddVehicleModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [customFeature, setCustomFeature] = useState('');
  const createVehicleMutation = useCreateVehicle();
  
  // FIPE API hooks
  const vehicleTypeForFipe = formData.vehicleType === 'car' ? 'carros' : formData.vehicleType === 'motorcycle' ? 'motos' : null;
  const { data: brands = [], isLoading: isLoadingBrands } = useFipeBrands(vehicleTypeForFipe);
  const { data: models = [], isLoading: isLoadingModels } = useFipeModels(
    vehicleTypeForFipe as 'carros' | 'motos',
    formData.brandId || null
  );
  const { data: years = [], isLoading: isLoadingYears } = useFipeYears(
    vehicleTypeForFipe as 'carros' | 'motos',
    formData.brandId || null,
    formData.modelId || null
  );
  const { data: fipePrice, isLoading: isLoadingFipe } = useFipePrice(
    vehicleTypeForFipe as 'carros' | 'motos',
    formData.brandId || null,
    formData.modelId || null,
    formData.yearId || null
  );
  
  // Quando a FIPE for carregada, atualizar o preço FIPE e sugerir preço de venda
  useEffect(() => {
    if (fipePrice && formData.yearId && !formData.isCustomYear) {
      // Converter valor da FIPE (ex: "R$ 50.000,00") para número
      const fipeValue = parseFloat(
        fipePrice.Valor.replace(/[^\d,]/g, '').replace(',', '.')
      );
      if (!isNaN(fipeValue) && fipeValue > 0) {
        const formattedValue = new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(fipeValue);
        setFormData((prev) => ({ 
          ...prev, 
          fipePrice: formattedValue,
          // Atualizar preço de venda sugerido apenas se for veículo próprio
          ...(formData.origin === 'own' ? { salePrice: formattedValue } : {})
        }));
      }
    } else if (formData.isCustomYear || !formData.yearId) {
      // Limpar FIPE quando for personalizado ou não tiver ano selecionado
      setFormData((prev) => ({ ...prev, fipePrice: '' }));
    }
  }, [fipePrice, formData.yearId, formData.origin, formData.isCustomYear]);

  // Resetar formulário quando o modal fecha
  useEffect(() => {
    if (!open) {
      // Limpar imagens e revogar URLs
      setImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.preview));
        return [];
      });
      setFormData(initialFormData);
      setCustomFeature('');
      setDraggedIndex(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    
    const currentCount = images.length;
    const remainingSlots = 8 - currentCount;
    if (remainingSlots <= 0) {
      toast({
        title: 'Limite de imagens atingido',
        description: 'Você pode adicionar no máximo 8 imagens.',
        variant: 'destructive',
      });
      return;
    }
    
    const filesToAdd = files.slice(0, remainingSlots);
    const newImages: ImageItem[] = filesToAdd.map((file, idx) => ({
      file,
      preview: URL.createObjectURL(file),
      isCover: currentCount === 0 && idx === 0, // Primeira imagem adicionada é capa
    }));
    
    setImages((prev) => {
      const updated = [...prev, ...newImages];
      // Garantir que a primeira imagem sempre seja capa
      if (updated.length > 0) {
        updated.forEach((img, idx) => {
          img.isCover = idx === 0;
        });
      }
      return updated;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      const newImages = prev.filter((_, i) => i !== index);
      // Sempre tornar a primeira imagem capa após remoção
      if (newImages.length > 0) {
        newImages.forEach((img, idx) => {
          img.isCover = idx === 0;
        });
      }
      return newImages;
    });
  };

  const setCoverImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      const selectedImage = newImages[index];
      // Remover a imagem da posição atual
      newImages.splice(index, 1);
      // Colocar no início
      newImages.unshift(selectedImage);
      // Marcar a primeira como capa
      newImages.forEach((img, idx) => {
        img.isCover = idx === 0;
      });
      return newImages;
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
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

    setImages((prev) => {
      const newImages = [...prev];
      const draggedItem = newImages[draggedIndex];
      newImages.splice(draggedIndex, 1);
      newImages.splice(dropIndex, 0, draggedItem);
      
      // Sempre tornar a primeira imagem capa após reordenação
      newImages.forEach((img, idx) => {
        img.isCover = idx === 0;
      });
      
      return newImages;
    });
    
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleFeatureToggle = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const handleAddCustomFeature = () => {
    if (customFeature.trim() && !formData.features.includes(customFeature.trim())) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, customFeature.trim()],
      }));
      setCustomFeature('');
    }
  };

  const handleRemoveCustomFeature = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f !== feature),
    }));
  };

  const formatCurrency = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    const number = parseFloat(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  };

  const parseCurrency = (value: string): number => {
    const numericValue = value.replace(/\D/g, '');
    return parseFloat(numericValue) / 100;
  };

  const resetForm = () => {
    setFormData(initialFormData);
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setCustomFeature('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getFeaturesList = () => {
    return formData.vehicleType === 'motorcycle' ? MOTORCYCLE_FEATURES : CAR_FEATURES;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const year = Number(formData.year);
    const km = formData.km ? Number(formData.km) : undefined;
    
    // Validações básicas
    if (!formData.brand || !formData.model || !year || !formData.fuel || !formData.color) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha marca, modelo, ano, combustível e cor.', variant: 'destructive' });
      return;
    }

    // Validações por origem
    if (formData.origin === 'own') {
      if (!formData.purchasePrice || !formData.salePrice) {
        toast({ title: 'Campos obrigatórios', description: 'Para veículo próprio, preço de compra e venda são obrigatórios.', variant: 'destructive' });
        return;
      }
    }

    if (formData.origin === 'consignment') {
      if (!formData.consignmentOwnerName || !formData.consignmentCommissionType || !formData.consignmentCommissionValue || !formData.consignmentMinRepassValue) {
        toast({ title: 'Campos obrigatórios', description: 'Preencha todos os dados do consignante.', variant: 'destructive' });
        return;
      }
    }

    const purchasePrice = formData.purchasePrice ? parseCurrency(formData.purchasePrice) : undefined;
    const salePrice = formData.salePrice ? parseCurrency(formData.salePrice) : undefined;
    const fipePriceValue = formData.fipePrice ? parseCurrency(formData.fipePrice) : undefined;
    const commissionValue = formData.consignmentCommissionValue ? parseCurrency(formData.consignmentCommissionValue) : undefined;
    const minRepassValue = formData.consignmentMinRepassValue ? parseCurrency(formData.consignmentMinRepassValue) : undefined;

    // As imagens já estão ordenadas (primeira é sempre capa)
    const imageFilesToSend = images.map((img) => img.file);
    
    console.log('[AddVehicleModal] Submitting vehicle with images:', {
      imageCount: imageFilesToSend.length,
      firstImageName: imageFilesToSend[0]?.name,
      allImageNames: imageFilesToSend.map(img => img.name),
    });

    createVehicleMutation.mutate(
      {
        vehicleType: formData.vehicleType,
        brand: formData.brand,
        model: formData.model, // Já inclui versão se for da API ou personalizado
        version: undefined, // Removido - modelo já inclui versão
        year,
        km,
        plate: formData.plate || undefined,
        fuel: formData.fuel,
        color: formData.color,
        transmission: formData.transmission || undefined,
        steering: formData.steering || undefined,
        origin: formData.origin,
        features: formData.features,
        purchasePrice,
        salePrice,
        fipePrice: fipePriceValue,
        description: formData.description || undefined,
        consignmentOwnerName: formData.consignmentOwnerName || undefined,
        consignmentOwnerPhone: formData.consignmentOwnerPhone || undefined,
        consignmentCommissionType: formData.consignmentCommissionType || undefined,
        consignmentCommissionValue: commissionValue,
        consignmentMinRepassValue: minRepassValue,
        consignmentStartDate: formData.consignmentStartDate,
        images: imageFilesToSend.length > 0 ? imageFilesToSend : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: 'Veículo cadastrado', description: 'O veículo foi adicionado ao estoque.' });
          resetForm();
          onOpenChange(false);
        },
        onError: (err) => {
          toast({ title: 'Erro ao cadastrar', description: err instanceof Error ? err.message : 'Tente novamente.', variant: 'destructive' });
        },
      }
    );
  };

  // Tela inicial de seleção de tipo
  if (!formData.vehicleType) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center">Cadastrar Veículo</DialogTitle>
            <DialogDescription className="text-center">
              Selecione o tipo de veículo que deseja cadastrar
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, vehicleType: 'car' }))}
              className="group relative p-8 rounded-xl border-2 border-border hover:border-primary transition-all bg-card hover:bg-primary/5 cursor-pointer"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                  <Car className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg text-foreground">Carro</h3>
                  <p className="text-sm text-muted-foreground mt-1">Automóvel, SUV, Pickup</p>
                </div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, vehicleType: 'motorcycle' }))}
              className="group relative p-8 rounded-xl border-2 border-border hover:border-primary transition-all bg-card hover:bg-primary/5 cursor-pointer"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors relative">
                  {/* Ícone de moto do shadcn */}
                  <svg
                    className="w-10 h-10 text-primary"
                    viewBox="0 0 16 17"
                    fill="currentColor"
                  >
                    <path d="M7.031 8.958h2.927c0-1.122-.657-1.166-1.464-1.166c-.808 0-1.463.044-1.463 1.166"/>
                    <path d="M10.617 1.042C10.179.448 9.397 0 8.496 0c-.902 0-1.684.448-2.119 1.042H4.022v.916h.021v.003h2.04C5.154 2.525 4 2.886 4 4.433s.744 1.498 1.016 1.9v5.28c0 1.515 1.047 2.053 2.047 2.246v.635c0 .428.483 1.506 1.445 1.506c.955 0 1.469-1.078 1.469-1.506v-.642c.988-.199 2.008-.744 2.008-2.239V6.209c.25-.407.995-.271.995-1.896s-1.215-1.816-2.099-2.354h2.099v-.916zM8.496.958c.864 0 1.563.695 1.563 1.553c0 .856-.699 1.552-1.563 1.552a1.556 1.556 0 0 1-1.562-1.552c0-.858.698-1.553 1.562-1.553m2.534 10.699c0 .576-.229.977-1.03 1.175v-2.816H7.039v2.816c-.833-.208-1.07-.633-1.07-1.219V7.304c.693.434 1.584.689 2.555.675c.959-.015 1.831-.29 2.507-.733z"/>
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg text-foreground">Moto</h3>
                  <p className="text-sm text-muted-foreground mt-1">Motocicleta, Scooter</p>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto scrollbar-thin bg-card rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {formData.vehicleType === 'motorcycle' ? (
              <svg
                className="w-10 h-10 text-primary"
                viewBox="0 0 16 17"
                fill="currentColor"
              >
                <path d="M7.031 8.958h2.927c0-1.122-.657-1.166-1.464-1.166c-.808 0-1.463.044-1.463 1.166"/>
                <path d="M10.617 1.042C10.179.448 9.397 0 8.496 0c-.902 0-1.684.448-2.119 1.042H4.022v.916h.021v.003h2.04C5.154 2.525 4 2.886 4 4.433s.744 1.498 1.016 1.9v5.28c0 1.515 1.047 2.053 2.047 2.246v.635c0 .428.483 1.506 1.445 1.506c.955 0 1.469-1.078 1.469-1.506v-.642c.988-.199 2.008-.744 2.008-2.239V6.209c.25-.407.995-.271.995-1.896s-1.215-1.816-2.099-2.354h2.099v-.916zM8.496.958c.864 0 1.563.695 1.563 1.553c0 .856-.699 1.552-1.563 1.552a1.556 1.556 0 0 1-1.562-1.552c0-.858.698-1.553 1.562-1.553m2.534 10.699c0 .576-.229.977-1.03 1.175v-2.816H7.039v2.816c-.833-.208-1.07-.633-1.07-1.219V7.304c.693.434 1.584.689 2.555.675c.959-.015 1.831-.29 2.507-.733z"/>
              </svg>
            ) : (
              <Car className="w-10 h-10 text-primary" />
            )}
            <div>
              <DialogTitle className="text-xl">
                Cadastrar {formData.vehicleType === 'motorcycle' ? 'Moto' : 'Carro'}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do veículo para adicionar ao estoque
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Fotos do Veículo</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/30"
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Arraste imagens ou <span className="text-primary font-medium">clique para selecionar</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG até 10MB</p>
            </div>
            
            {/* Image Previews with Drag and Drop */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                {images.map((imageItem, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "relative group cursor-move transition-opacity",
                      draggedIndex === index && "opacity-50"
                    )}
                  >
                    <img
                      src={imageItem.preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    {imageItem.isCover && (
                      <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-1">
                        <Star className="w-3 h-3 fill-current" />
                      </div>
                    )}
                    <div className="absolute top-1 right-1 flex gap-1">
                      {!imageItem.isCover && (
                        <button
                          type="button"
                          onClick={() => setCoverImage(index)}
                          className="bg-primary/90 hover:bg-primary text-primary-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Definir como capa"
                        >
                          <Star className="w-3 h-3" />
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                        className="bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover imagem"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <GripVertical className="w-3 h-3" />
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Basic Info - FIPE Integration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Marca *</Label>
              <SearchableSelect
                options={brands.map(b => ({ value: b.codigo, label: b.nome }))}
                value={formData.brandId}
                onValueChange={(value) => {
                  const selectedBrand = brands.find(b => b.codigo === value);
                  setFormData({ 
                    ...formData, 
                    brandId: value,
                    brand: selectedBrand?.nome || '',
                    modelId: '',
                    model: '',
                    isCustomModel: false,
                    yearId: '',
                    year: '',
                    isCustomYear: false,
                  });
                }}
                placeholder={isLoadingBrands ? "Carregando marcas..." : "Selecione a marca"}
                disabled={!formData.vehicleType || isLoadingBrands}
                isLoading={isLoadingBrands}
                emptyMessage="Nenhuma marca encontrada"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo/Versão *</Label>
              {formData.isCustomModel ? (
                <div className="flex gap-2">
              <Input 
                id="model" 
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Digite o modelo/versão"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setFormData({ 
                        ...formData, 
                        model: '',
                        modelId: '',
                        isCustomModel: false,
                        yearId: '',
                        year: '',
                        isCustomYear: false,
                      });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <SearchableSelect
                  options={models.map(m => ({ value: m.codigo, label: m.nome }))}
                  value={formData.modelId}
                  onValueChange={(value) => {
                    const selectedModel = models.find(m => m.codigo === value);
                    setFormData({ 
                      ...formData, 
                      modelId: value,
                      model: selectedModel?.nome || '',
                      isCustomModel: false,
                      yearId: '',
                      year: '',
                      isCustomYear: false,
                    });
                  }}
                  onCustomAdd={(customValue) => {
                    setFormData({ 
                      ...formData, 
                      modelId: '',
                      model: customValue,
                      isCustomModel: true,
                      yearId: '',
                      year: '',
                      isCustomYear: false,
                    });
                  }}
                  placeholder={isLoadingModels ? "Carregando modelos..." : "Selecione ou digite o modelo"}
                  disabled={!formData.brandId || isLoadingModels}
                  isLoading={isLoadingModels}
                  allowCustom={true}
                  emptyMessage="Nenhum modelo encontrado"
                />
              )}
            </div>
          </div>

          {/* Ano e FIPE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Ano *</Label>
              {formData.isCustomModel ? (
              <Input 
                id="year" 
                type="number" 
                  placeholder="Ex: 2024"
                value={formData.year}
                  onChange={(e) => {
                    const year = e.target.value;
                    setFormData({ 
                      ...formData, 
                      year: year,
                      yearId: '',
                      isCustomYear: true,
                      fipePrice: '', // Limpar FIPE quando for personalizado
                    });
                  }}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              ) : (
                <SearchableSelect
                  options={years.map(y => ({ value: y.codigo, label: y.nome }))}
                  value={formData.isCustomYear ? 'custom' : formData.yearId}
                  onValueChange={(value) => {
                    if (value === 'custom') return;
                    const selectedYear = years.find(y => y.codigo === value);
                    // Extrair ano do formato "2024" (já processado no backend)
                    const year = selectedYear?.nome || '';
                    setFormData({ 
                      ...formData, 
                      yearId: value,
                      year: year,
                      isCustomYear: false,
                    });
                  }}
                  onCustomAdd={(customValue) => {
                    // Extrair ano se possível
                    const yearMatch = customValue.match(/^(\d{4})/);
                    const year = yearMatch ? yearMatch[1] : customValue;
                    setFormData({ 
                      ...formData, 
                      yearId: '',
                      year: year,
                      isCustomYear: true,
                      fipePrice: '', // Limpar FIPE quando for personalizado
                    });
                  }}
                  placeholder={isLoadingYears ? "Carregando anos..." : "Selecione ou digite o ano"}
                  disabled={!formData.modelId || isLoadingYears}
                  isLoading={isLoadingYears}
                  allowCustom={true}
                  emptyMessage="Nenhum ano encontrado"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fipePrice">FIPE</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm z-10">R$</span>
                <Input 
                  id="fipePrice" 
                  type="text"
                  placeholder="0,00"
                  className="pl-9 disabled:opacity-50"
                  value={formData.fipePrice || ''}
                  onChange={(e) => {
                    // Usar a mesma lógica do preço de compra/venda
                    const formatted = formatCurrency(e.target.value);
                    setFormData({ ...formData, fipePrice: formatted });
                  }}
                  disabled={!formData.isCustomModel && !formData.isCustomYear && !!formData.yearId && !!fipePrice}
                />
              </div>
              {fipePrice && !formData.isCustomYear && !formData.isCustomModel && (
                <p className="text-xs text-muted-foreground mt-1">
                  Referência: {fipePrice.MesReferencia}
                </p>
              )}
            </div>
          </div>

          {/* KM e Placa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="km">KM</Label>
              <Input 
                id="km" 
                type="number" 
                placeholder="0"
                value={formData.km}
                onChange={(e) => setFormData({ ...formData, km: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plate">Placa</Label>
              <Input 
                id="plate" 
                placeholder="ABC-1234"
                value={formData.plate}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                className="uppercase"
              />
            </div>
          </div>

          {/* Fuel, Color, Transmission, Steering */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fuel">Combustível *</Label>
              <Select 
                value={formData.fuel} 
                onValueChange={(value) => setFormData({ ...formData, fuel: value })}
              >
                <SelectTrigger id="fuel">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="Flex">Flex</SelectItem>
                  <SelectItem value="Gasolina">Gasolina</SelectItem>
                  <SelectItem value="Etanol">Etanol</SelectItem>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                  <SelectItem value="Elétrico">Elétrico</SelectItem>
                  <SelectItem value="Híbrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor *</Label>
              <ColorSelect
                value={formData.color}
                onValueChange={(value) => setFormData({ ...formData, color: value })}
                placeholder="Selecione ou digite uma cor"
                allowCustom={true}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transmission">Transmissão (Câmbio)</Label>
              <Select 
                value={formData.transmission} 
                onValueChange={(value) => setFormData({ ...formData, transmission: value })}
              >
                <SelectTrigger id="transmission">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Automático">Automático</SelectItem>
                  <SelectItem value="CVT">CVT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="steering">Direção</Label>
              <Select 
                value={formData.steering} 
                onValueChange={(value) => setFormData({ ...formData, steering: value })}
              >
                <SelectTrigger id="steering">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="hidráulica">Hidráulica</SelectItem>
                  <SelectItem value="elétrica">Elétrica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Origin */}
          <div className="space-y-2">
            <Label htmlFor="origin">Origem do Veículo *</Label>
            <Select 
              value={formData.origin} 
              onValueChange={(value: 'own' | 'consignment' | 'repass') => setFormData({ ...formData, origin: value })}
            >
              <SelectTrigger id="origin">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                <SelectItem value="own">Próprio</SelectItem>
                <SelectItem value="consignment">Consignado</SelectItem>
                <SelectItem value="repass">Repasse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prices for Own */}
          {formData.origin === 'own' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Preço de Compra *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input 
                  id="purchasePrice" 
                  placeholder="0,00"
                  className="pl-9"
                  value={formData.purchasePrice}
                    onChange={(e) => {
                      const formatted = formatCurrency(e.target.value);
                      setFormData({ ...formData, purchasePrice: formatted });
                    }}
                />
              </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="salePrice">Preço de Venda Pretendido *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input 
                  id="salePrice" 
                  placeholder="0,00"
                  className="pl-9"
                  value={formData.salePrice}
                    onChange={(e) => {
                      const formatted = formatCurrency(e.target.value);
                      setFormData({ ...formData, salePrice: formatted });
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Consignment Data */}
          {formData.origin === 'consignment' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
              <h3 className="font-semibold text-sm">Dados do Consignante</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="consignmentOwnerName">Nome do Proprietário *</Label>
                  <Input 
                    id="consignmentOwnerName" 
                    placeholder="Nome completo"
                    value={formData.consignmentOwnerName}
                    onChange={(e) => setFormData({ ...formData, consignmentOwnerName: e.target.value })}
                />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="consignmentOwnerPhone">Telefone do Proprietário</Label>
                  <Input 
                    id="consignmentOwnerPhone" 
                    placeholder="(00) 00000-0000"
                    value={formData.consignmentOwnerPhone}
                    onChange={(e) => setFormData({ ...formData, consignmentOwnerPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="consignmentCommissionType">Tipo de Comissão *</Label>
                <Select 
                  value={formData.consignmentCommissionType} 
                  onValueChange={(value: 'percentual' | 'fixed') => setFormData({ ...formData, consignmentCommissionType: value })}
                >
                  <SelectTrigger id="consignmentCommissionType">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border">
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="consignmentCommissionValue">
                  {formData.consignmentCommissionType === 'percentual' ? 'Valor da Porcentagem (%) *' : 'Valor Fixo (R$) *'}
                </Label>
                <div className="relative">
                  {formData.consignmentCommissionType === 'fixed' && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  )}
                  {formData.consignmentCommissionType === 'percentual' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  )}
                  <Input 
                    id="consignmentCommissionValue" 
                    type={formData.consignmentCommissionType === 'percentual' ? 'number' : 'text'}
                    placeholder={formData.consignmentCommissionType === 'percentual' ? '0' : '0,00'}
                    className={cn(
                      formData.consignmentCommissionType === 'fixed' && 'pl-9',
                      formData.consignmentCommissionType === 'percentual' && 'pr-9'
                    )}
                    value={formData.consignmentCommissionValue}
                    onChange={(e) => {
                      if (formData.consignmentCommissionType === 'fixed') {
                        const formatted = formatCurrency(e.target.value);
                        setFormData({ ...formData, consignmentCommissionValue: formatted });
                      } else {
                        setFormData({ ...formData, consignmentCommissionValue: e.target.value });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="consignmentMinRepassValue">Valor Mínimo de Repasse (R$) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input 
                    id="consignmentMinRepassValue" 
                    placeholder="0,00"
                    className="pl-9"
                    value={formData.consignmentMinRepassValue}
                    onChange={(e) => {
                      const formatted = formatCurrency(e.target.value);
                      setFormData({ ...formData, consignmentMinRepassValue: formatted });
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Valor mínimo garantido ao proprietário na venda</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="consignmentStartDate">Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="consignmentStartDate"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.consignmentStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.consignmentStartDate ? (
                        format(formData.consignmentStartDate, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.consignmentStartDate}
                      onSelect={(date) => setFormData({ ...formData, consignmentStartDate: date })}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="space-y-3">
            <Label>Opcionais e Acessórios</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg border border-border">
              {getFeaturesList().map((feature) => (
                <div key={feature} className="flex items-center space-x-2">
                  <Checkbox
                    id={feature}
                    checked={formData.features.includes(feature)}
                    onCheckedChange={() => handleFeatureToggle(feature)}
                  />
                  <Label
                    htmlFor={feature}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {feature}
                  </Label>
                </div>
              ))}
            </div>

            {/* Custom Features */}
            <div className="space-y-2">
              <Label>Adicionar Opcional/Acessório Personalizado</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o nome do opcional/acessório"
                  value={customFeature}
                  onChange={(e) => setCustomFeature(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomFeature();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddCustomFeature}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </Button>
              </div>
            </div>

            {/* Selected Custom Features */}
            {formData.features.filter((f) => !getFeaturesList().includes(f)).length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Opcionais/Acessórios Personalizados Adicionados:</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.features
                    .filter((f) => !getFeaturesList().includes(f))
                    .map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        <span>{feature}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomFeature(feature)}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Observações</Label>
            <Textarea 
              id="description" 
              placeholder="Observações sobre o veículo..."
              className="min-h-[100px] resize-none"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="gap-2"
              disabled={createVehicleMutation.isPending}
            >
              {createVehicleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Cadastrar Veículo
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
