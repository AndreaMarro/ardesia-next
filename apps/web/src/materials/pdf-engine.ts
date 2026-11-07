import {getDocument, GlobalWorkerOptions} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
export function openPdf(bytes: Uint8Array) {
  const task = getDocument({data: bytes, enableXfa: false, disableFontFace: true,
    cMapUrl: '/pdf-runtime/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdf-runtime/standard_fonts/', wasmUrl: '/pdf-runtime/wasm/'});
  // Password-protected originals require a separate explicit workflow; never hang a modal.
  task.onPassword = () => {void task.destroy();};
  return task;
}
