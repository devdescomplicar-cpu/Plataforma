import { FileText, Printer, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sale } from '@/hooks/useSales';
import { useSettings } from '@/hooks/useSettings';
import { toPublicImageUrl } from '@/lib/utils';
import { formatDateBR, formatDateTimeBR } from '@/lib/date-br';
import { formatCpfCnpj } from '@/lib/cpf-cnpj';

/** Texto jurídico fixo do rodapé do comprovante (recibo). Não usa configuração da loja. */
const RECEIPT_FOOTER_LEGAL =
  'Este documento possui caráter exclusivamente informativo e operacional, sendo gerado automaticamente pelo sistema. Não possui validade fiscal ou contábil, não substitui Nota Fiscal, recibo fiscal ou qualquer documento fiscal exigido pela legislação vigente.';

interface SaleReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
}

export function SaleReceiptModal({
  open,
  onOpenChange,
  sale,
}: SaleReceiptModalProps) {
  const { data: settings } = useSettings();
  const store = settings?.store;
  const storeName = store?.name ?? '';
  const storeLegalName = store?.legalName ?? '';
  const storeCpfCnpj = store?.cpfCnpj ?? '';
  const storeLogoUrl = store?.logo ? (toPublicImageUrl(store.logo) ?? store.logo) : null;
  const includeLegalNotice = settings?.report?.includeLegalNotice ?? true;
  const legalNoticeText = settings?.report?.legalNoticeText?.trim()
    || 'Este documento possui caráter exclusivamente informativo e operacional, sendo gerado automaticamente pelo sistema. Não possui validade fiscal ou contábil, não substitui Nota Fiscal, recibo fiscal ou qualquer documento fiscal exigido pela legislação vigente.';
  const cityState = [store?.city, store?.state].filter(Boolean).join(' — ');
  const emissionDate = sale?.saleDate ? formatDateTimeBR(sale.saleDate) : formatDateTimeBR(new Date());

  if (!sale) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return 'N/A';
    return phone;
  };

  const handlePrint = () => {
    const receiptContent = document.getElementById('receipt-content');
    if (!receiptContent) return;

    // Criar uma nova janela invisível para impressão
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      // Fallback se popup for bloqueado - usar impressão direta
      window.print();
      return;
    }

    // Clonar o conteúdo removendo classes de print:hidden
    const clonedContent = receiptContent.cloneNode(true) as HTMLElement;
    const hiddenElements = clonedContent.querySelectorAll('.print\\:hidden');
    hiddenElements.forEach(el => el.remove());

    // Uma única A4: cabeçalho no topo, rodapé no pé, conteúdo compacto no meio
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Comprovante de Venda</title>
          <style>
            @page { size: A4; margin: 1.5cm; }
            * { margin: 0; padding: 0; box-sizing: border-box; color: #000000 !important; }
            html { height: 100%; }
            body {
              font-family: Inter, Roboto, 'Segoe UI', system-ui, sans-serif;
              font-size: 10px;
              line-height: 1.35;
              background: white;
              padding: 0;
              margin: 0;
              min-height: 0;
              height: 100%;
              overflow: hidden;
            }
            /* Uma única página A4 — sem quebra */
            [data-receipt] {
              display: flex !important;
              flex-direction: column !important;
              height: calc(297mm - 3cm) !important;
              max-height: calc(297mm - 3cm) !important;
              padding: 12px 16px !important;
              width: 100%;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
              page-break-before: avoid !important;
            }
            .receipt-body {
              flex: 1 1 auto !important;
              min-height: 0 !important;
              overflow: hidden !important;
            }
            .receipt-header {
              flex-shrink: 0 !important;
              padding-bottom: 6px !important;
              border-bottom: 1px solid #e5e7eb !important;
            }
            .receipt-footer {
              flex-shrink: 0 !important;
              margin-top: auto !important;
              border-top: 1px solid #d1d5db !important;
              padding-top: 6px !important;
              font-size: 8px !important;
              line-height: 1.3 !important;
              color: #6b7280 !important;
            }
            .receipt-footer p { font-size: 8px !important; color: #6b7280 !important; }
            /* Conteúdo compacto para caber em 1 A4 */
            .receipt-body .space-y-6 > * + * { margin-top: 0.5rem !important; }
            .receipt-body .space-y-4 > * + * { margin-top: 0.4rem !important; }
            .receipt-body .space-y-3 > * + * { margin-top: 0.35rem !important; }
            .receipt-body .space-y-2 > * + * { margin-top: 0.25rem !important; }
            .receipt-body .space-y-1\\.5 > * + * { margin-top: 0.2rem !important; }
            .receipt-body [class*="space-y"] > * + * { margin-top: 0.3rem !important; }
            .receipt-body .gap-6 { gap: 0.5rem !important; }
            .receipt-body .gap-4 { gap: 0.4rem !important; }
            .receipt-body .pt-3, .receipt-body .pt-4 { padding-top: 0.35rem !important; }
            .receipt-body .pb-2 { padding-bottom: 0.25rem !important; }
            .receipt-body .p-5, .receipt-body .p-4 { padding: 0.5rem !important; }
            .receipt-body .mt-5 { margin-top: 0.5rem !important; }
            .receipt-body .mt-4 { margin-top: 0.4rem !important; }
            /* Imagem do veículo pequena (não ocupa página inteira) */
            .receipt-body img { max-height: 56px !important; width: auto !important; object-fit: contain !important; }
            .receipt-header img { max-height: 48px !important; width: auto !important; }
            .border-b { border-bottom: 1px solid #e5e7eb; }
            .border-t { border-top: 1px solid #e5e7eb; }
            .border-2 { border-width: 2px; }
            .text-2xl { font-size: 1.1rem !important; }
            .text-xl { font-size: 1rem !important; }
            .text-lg { font-size: 0.95rem !important; }
            .text-base { font-size: 0.9rem !important; }
            .text-sm { font-size: 0.85rem !important; }
            .text-xs { font-size: 0.8rem !important; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-medium { font-weight: 500; }
            .uppercase { text-transform: uppercase; }
            .tracking-widest { letter-spacing: 0.15em; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .flex-wrap { flex-wrap: wrap; }
            .flex-1 { flex: 1 1 0%; min-width: 0; }
            .flex-shrink-0 { flex-shrink: 0; }
            .justify-between { justify-content: space-between; }
            .items-start { align-items: flex-start; }
            .items-center { align-items: center; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
            .gap-4 { gap: 0.4rem; }
            .min-w-0 { min-width: 0; }
            .rounded-lg { border-radius: 4px; }
            .overflow-hidden { overflow: hidden; }
            .bg-gray-50 { background-color: #f9fafb; }
          </style>
        </head>
        <body>
          ${clonedContent.outerHTML}
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Aguardar o carregamento e imprimir imediatamente
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Fechar após impressão
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 100);
  };

  const vehicleName = sale.vehicle
    ? `${sale.vehicle.brand} ${sale.vehicle.model} ${sale.vehicle.year || ''}`.trim()
    : 'N/A';

  const vehicleImage = sale.vehicle?.image || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-modal print:max-w-none print:max-h-none print:overflow-visible print:m-0 print:p-0 print:border-0 print:shadow-none print:bg-white">
        <div className="print:hidden">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              <div>
                <DialogTitle className="text-xl">Comprovante de Venda</DialogTitle>
                <DialogDescription>
                  Visualize e imprima o comprovante de venda
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Comprovante — flex para rodapé fixo no fim da A4 na impressão */}
        <div className="bg-white p-6 print:p-8 font-sans flex flex-col print:min-h-[calc(297mm-3cm)] min-h-0" id="receipt-content" data-receipt style={{ fontFamily: 'Inter, Roboto, system-ui, sans-serif' }}>
          <div className="receipt-body flex-1 space-y-6 print:space-y-4">
          {/* CABEÇALHO — Padrão corporativo */}
          <header className="receipt-header">
            <div className="flex flex-wrap items-start justify-between gap-6 print:gap-4">
              {/* Lado esquerdo: logo + identidade */}
              <div className="flex items-start gap-4 min-w-0 flex-1">
                {storeLogoUrl && (
                  <div className="w-16 h-16 print:w-14 print:h-14 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-50 flex items-center justify-center">
                    <img src={storeLogoUrl} alt="" className="w-full h-full object-contain object-center" />
                  </div>
                )}
                <div className="min-w-0 space-y-0.5">
                  {storeName && (
                    <p className="text-base print:text-lg font-semibold text-gray-900 tracking-tight">{storeName}</p>
                  )}
                  {storeLegalName && storeLegalName !== storeName && (
                    <p className="text-xs print:text-sm text-gray-600">{storeLegalName}</p>
                  )}
                  {storeCpfCnpj && (
                    <p className="text-xs print:text-sm text-gray-500">CNPJ/CPF: {formatCpfCnpj(storeCpfCnpj)}</p>
                  )}
                  {cityState && (
                    <p className="text-xs print:text-sm text-gray-500">{cityState}</p>
                  )}
                </div>
              </div>
              {/* Lado direito: contato */}
              <div className="text-right space-y-1 print:text-sm">
                {store?.phone && <p className="text-xs print:text-sm text-gray-600">Tel: {store.phone}</p>}
                {store?.whatsapp && <p className="text-xs print:text-sm text-gray-600">WhatsApp: {store.whatsapp}</p>}
                {store?.email && <p className="text-xs print:text-sm text-gray-600">{store.email}</p>}
                {store?.website && <p className="text-xs print:text-sm text-gray-600">{store.website}</p>}
              </div>
            </div>
            {/* Linha divisória + título do documento */}
            <div className="mt-5 print:mt-4 pt-4 print:pt-3 border-t border-gray-200">
              <h1 className="text-xl print:text-2xl font-bold text-gray-900 uppercase tracking-[0.2em] mt-1">
                Comprovante de Venda
              </h1>
              <p className="text-xs print:text-sm text-gray-500 mt-1">Documento gerado automaticamente pelo sistema</p>
            </div>
          </header>

          {/* Informações da Venda */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-6">
            <div className="space-y-3 print:space-y-2">
              <h2 className="text-lg print:text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 print:pb-2">
                Dados da Venda
              </h2>
              <div className="space-y-1.5 print:space-y-2 text-sm print:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Número da Venda:</span>
                  <span className="text-gray-900 font-semibold">#{sale.id.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Data da Venda:</span>
                  <span className="text-gray-900 font-semibold">
                    {formatDateBR(sale.saleDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Forma de Pagamento:</span>
                  <span className="text-gray-900 font-semibold">{sale.paymentMethod}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 print:space-y-2">
              <h2 className="text-lg print:text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 print:pb-2">
                Dados do Veículo
              </h2>
              <div className="flex gap-4 items-start">
                <div className="space-y-1.5 print:space-y-2 text-sm print:text-sm flex-1 min-w-0">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Veículo:</span>
                  <span className="text-gray-900 font-semibold text-right max-w-[60%]">{vehicleName}</span>
                </div>
                {sale.vehicle?.plate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Placa:</span>
                    <span className="text-gray-900 font-semibold">{sale.vehicle.plate}</span>
                  </div>
                )}
                {sale.vehicle?.year && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Ano:</span>
                    <span className="text-gray-900 font-semibold">{sale.vehicle.year}</span>
                  </div>
                )}
                {(sale.vehicle as any)?.km && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Quilometragem:</span>
                    <span className="text-gray-900 font-semibold">
                      {(sale.vehicle as any).km.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                )}
                </div>
                {vehicleImage && (
                  <div className="w-20 h-20 print:w-16 print:h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                    <img src={vehicleImage} alt={vehicleName} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dados do Cliente */}
          {sale.client && (
            <div className="space-y-3 print:space-y-2 border-t border-gray-200 pt-3 print:pt-2">
              <h2 className="text-lg print:text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 print:pb-2">
                Dados do Comprador
              </h2>
              <div className="space-y-1.5 print:space-y-2 text-sm print:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Nome:</span>
                  <span className="text-gray-900 font-semibold">{sale.client.name}</span>
                </div>
                {sale.client.cpfCnpj && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">CPF/CNPJ:</span>
                    <span className="text-gray-900 font-semibold">{formatCpfCnpj(sale.client.cpfCnpj)}</span>
                  </div>
                )}
                {sale.client.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Telefone:</span>
                    <span className="text-gray-900 font-semibold">{formatPhone(sale.client.phone)}</span>
                  </div>
                )}
                {sale.client.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">E-mail:</span>
                    <span className="text-gray-900 font-semibold">{sale.client.email}</span>
                  </div>
                )}
                {sale.client.city && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Cidade:</span>
                    <span className="text-gray-900 font-semibold">{sale.client.city}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Valor da Venda */}
          <div className="space-y-3 print:space-y-2 border-t border-gray-200 pt-3 print:pt-2">
            <h2 className="text-lg print:text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 print:pb-2">
              Valor da Transação
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 print:p-5">
              <div className="flex justify-between items-center">
                <span className="text-gray-900 text-base print:text-lg font-semibold">Valor da Venda:</span>
                <span className="text-primary text-2xl print:text-3xl font-bold">{formatCurrency(sale.salePrice)}</span>
              </div>
            </div>
          </div>

          </div>
          {/* RODAPÉ — Separado do conteúdo, fonte menor, no pé da A4 na impressão */}
          <footer className="receipt-footer border-t border-gray-300 mt-8 print:mt-auto pt-5 print:pt-4 shrink-0">
            <div className="text-center space-y-1.5 text-[10px] print:text-[9px] text-gray-500 max-w-2xl mx-auto leading-tight">
              <p className="text-gray-500">
                {RECEIPT_FOOTER_LEGAL}
              </p>
              <p className="text-gray-500">
                Data e hora de emissão: {emissionDate}
              </p>
              <p className="text-gray-400">
                Registro eletrônico gerado pelo sistema.
              </p>
            </div>
          </footer>
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-3 print:hidden border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </DialogContent>

      {/* Estilos para impressão — A4, tipografia e rodapé institucional */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1.5cm;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: Inter, Roboto, 'Segoe UI', system-ui, sans-serif !important;
          }
          
          body > *:not([data-receipt]) {
            display: none !important;
          }
          
          [data-receipt] {
            display: flex !important;
            flex-direction: column !important;
            min-height: calc(297mm - 3cm) !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            font-family: Inter, Roboto, 'Segoe UI', system-ui, sans-serif !important;
          }
          
          [data-receipt] .receipt-body {
            flex: 1 1 auto !important;
          }
          
          [data-receipt] .receipt-header {
            padding-bottom: 0.75rem;
            border-bottom: 1px solid #e5e7eb;
          }
          
          [data-receipt] .receipt-footer {
            border-top: 1px solid #d1d5db !important;
            margin-top: auto !important;
            padding-top: 0.75rem !important;
            font-size: 9px !important;
            line-height: 1.35 !important;
            color: #6b7280 !important;
          }
          
          [data-receipt] .receipt-footer p {
            font-size: inherit !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          [data-receipt] {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          [data-receipt] > * {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </Dialog>
  );
}
