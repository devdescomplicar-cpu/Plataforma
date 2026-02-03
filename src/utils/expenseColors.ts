// Cores intuitivas para cada tipo de despesa
export const EXPENSE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Funilaria': {
    bg: 'bg-info/10',
    text: 'text-info',
    border: 'border-info/30',
  },
  'Pneus': {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
  },
  'Documento': {
    bg: 'bg-cyan-100',
    text: 'text-cyan-700',
    border: 'border-cyan-300',
  },
  'Troca de óleo': {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-300',
  },
  'Pastilhas de freio': {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
  },
  'Lavagem': {
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    border: 'border-sky-300',
  },
  'Polimento': {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
  },
  'Outro': {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
};

export const getExpenseTypeColor = (type: string) => {
  return EXPENSE_TYPE_COLORS[type] || EXPENSE_TYPE_COLORS['Outro'];
};
