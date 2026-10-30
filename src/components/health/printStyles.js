// Impressão (PDF pelo navegador): só a área #health-print aparece, em fundo branco.
export const HEALTH_PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #health-print, #health-print * { visibility: visible !important; color: #000 !important; background: transparent !important; box-shadow: none !important; }
  #health-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12mm; }
  #health-print .print\\:hidden { display: none !important; }
  @page { margin: 12mm; }
}
`;
