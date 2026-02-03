import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Cores fixas com valores hex
export const VEHICLE_COLORS = [
  { value: 'Branco', hex: '#FFFFFF' },
  { value: 'Preto', hex: '#000000' },
  { value: 'Prata', hex: '#C0C0C0' },
  { value: 'Cinza', hex: '#808080' },
  { value: 'Vermelho', hex: '#FF0000' },
  { value: 'Azul', hex: '#0000FF' },
  { value: 'Azul marinho', hex: '#000080' },
  { value: 'Verde', hex: '#008000' },
  { value: 'Marrom', hex: '#8B4513' },
  { value: 'Bege', hex: '#F5F5DC' },
  { value: 'Amarelo', hex: '#FFFF00' },
  { value: 'Laranja', hex: '#FFA500' },
  { value: 'Roxo', hex: '#800080' },
  { value: 'Dourado', hex: '#FFD700' },
] as const;

interface ColorSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCustom?: boolean;
}

export function ColorSelect({
  value,
  onValueChange,
  placeholder = 'Selecione ou digite a cor',
  disabled = false,
  allowCustom = true,
}: ColorSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selectedColor = React.useMemo(() => {
    return VEHICLE_COLORS.find((c) => c.value.toLowerCase() === value?.toLowerCase());
  }, [value]);

  const isCustomColor = value && !selectedColor;

  const filteredColors = React.useMemo(() => {
    if (!search) return VEHICLE_COLORS;
    const lowerSearch = search.toLowerCase();
    return VEHICLE_COLORS.filter((c) =>
      c.value.toLowerCase().includes(lowerSearch)
    );
  }, [search]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setOpen(false);
    setSearch('');
  };

  const handleCustomAdd = () => {
    if (search.trim()) {
      onValueChange(search.trim());
      setOpen(false);
      setSearch('');
    }
  };

  const getColorHex = (colorName: string): string => {
    if (!colorName) return '#808080';
    
    // Verificar se é uma cor da lista
    const color = VEHICLE_COLORS.find(
      (c) => c.value.toLowerCase() === colorName.toLowerCase()
    );
    if (color) return color.hex;
    
    // Se for um hex válido, usar diretamente
    if (/^#[0-9A-F]{6}$/i.test(colorName)) {
      return colorName;
    }
    
    // Default cinza para cores personalizadas
    return '#808080';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 font-normal hover:bg-background hover:text-foreground"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            {value && (
              <div
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: getColorHex(value) }}
              />
            )}
            <span className="truncate">
              {value || <span className="text-muted-foreground">{placeholder}</span>}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden" 
        align="start"
        sideOffset={4}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="overflow-hidden">
          <CommandInput
            placeholder="Buscar cor..."
            value={search}
            onValueChange={setSearch}
            className="border-b"
          />
          <CommandList 
            className="max-h-[250px] overflow-y-auto overflow-x-hidden scrollbar-thin"
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--border)) transparent',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehavior: 'contain',
            }}
          >
            <CommandEmpty>
              {allowCustom && search.trim() ? (
                <div className="py-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    Nenhuma cor encontrada.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleCustomAdd}
                  >
                    Adicionar &quot;{search}&quot;
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma cor encontrada.</p>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredColors.map((color) => (
                <CommandItem
                  key={color.value}
                  value={color.value}
                  onSelect={() => handleSelect(color.value)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Check
                      className={cn(
                        'h-4 w-4',
                        value?.toLowerCase() === color.value.toLowerCase() ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="flex-1">{color.value}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
