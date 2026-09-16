import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { renderPdfPage } from './pdf-page.js'

GlobalWorkerOptions.workerSrc = workerUrl
export const loadPdf = url => getDocument({ url })
export { renderPdfPage }
