import { useState } from 'react';

export interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export function useCep() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCep = async (cep: string): Promise<CepData | null> => {
    // Remove caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, '');
    
    // Valida se tem 8 dígitos
    if (cleanCep.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Usa ViaCEP API (gratuita e sem necessidade de autenticação)
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: CepData = await response.json();

      if (data.erro) {
        setError('CEP não encontrado');
        return null;
      }

      return data;
    } catch (err) {
      setError('Erro ao buscar CEP. Tente novamente.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { fetchCep, loading, error };
}
