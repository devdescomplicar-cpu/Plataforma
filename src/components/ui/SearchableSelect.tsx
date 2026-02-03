import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
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

interface SearchableSelectOption {
  value: string;
  label: string;
  /** Text used for search/filter (e.g. name + CPF + phone). If omitted, label is used. */
  searchText?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  allowCustom?: boolean;
  onCustomAdd?: (value: string) => void;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Selecione...',
  disabled = false,
  isLoading = false,
  emptyMessage = 'Nenhum resultado encontrado.',
  allowCustom = false,
  onCustomAdd,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selectedOption = React.useMemo(() => {
    if (value === 'custom' && allowCustom) {
      // Se for custom, não mostrar nas opções, mas mostrar o valor customizado
      return null;
    }
    return options.find((opt) => opt.value === value);
  }, [options, value, allowCustom]);

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const lowerSearch = search.toLowerCase().trim();
    return options.filter((opt) => {
      const textToSearch = (opt.searchText ?? opt.label).toLowerCase();
      return textToSearch.includes(lowerSearch);
    });
  }, [options, search]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setOpen(false);
    setSearch('');
  };

  const handleCustomAdd = () => {
    if (onCustomAdd && search.trim()) {
      onCustomAdd(search.trim());
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 font-normal hover:bg-background hover:text-foreground"
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <span className="text-muted-foreground">Carregando...</span>
          ) : selectedOption ? (
            <span className="truncate text-foreground">{selectedOption.label}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
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
            placeholder="Buscar..."
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
                    {emptyMessage}
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
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
