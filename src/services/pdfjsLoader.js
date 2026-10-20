// Carrega o leitor de PDF sob demanda (fora do pacote principal). O worker é um arquivo do próprio app, permitido pela política de segurança.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.js', import.meta.url).toString();

export default pdfjs;
