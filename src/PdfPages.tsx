import { t } from "./i18n";import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';

// Use PDF.js's supported main-thread fallback for hosts that block module workers.
// The renderer stays lazy-loaded and does not send any file data off the device.
Object.assign(globalThis, { pdfjsWorker: { WorkerMessageHandler } });

export default function PdfPages({ blob }: {blob: Blob;}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof getDocument> | undefined;
    setDocument(null);setPage(1);setLoading(true);setError('');
    void (async () => {
      const data = await blob.arrayBuffer();
      if (disposed) return;
      task = getDocument({ data: new Uint8Array(data) });
      const pdf = await task.promise;
      if (!disposed) setDocument(pdf);
    })().catch(() => {if (!disposed) {setError('Preview unavailable for this PDF. You can still try processing and downloading it.');setLoading(false);}});
    return () => {disposed = true;if (task) void task.destroy().catch(() => {});};
  }, [blob]);

  useEffect(() => {
    if (!document) return;
    let disposed = false;
    let render: RenderTask | undefined;
    setLoading(true);setError('');
    void (async () => {
      const pdfPage = await document.getPage(page);
      if (disposed) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: Math.min(900 / natural.width, 1100 / natural.height) });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('role', 'img');canvas.setAttribute('aria-label', `PDF page ${page} of ${document.numPages}`);
      render = pdfPage.render({ canvas, viewport });
      await render.promise;
      if (!disposed && container.current) {container.current.replaceChildren(canvas);setLoading(false);}
    })().catch(() => {if (!disposed) {setError('This page could not be previewed. Try another page or download the PDF.');setLoading(false);}});
    return () => {disposed = true;render?.cancel();container.current?.replaceChildren();};
  }, [document, page]);

  return <div className="pdf-pages">
    <div className="pdf-page-stage">
      <div ref={container} className="pdf-canvas-container" hidden={loading || !!error} />
      {loading && <div className="pdf-loading" role="status"><span className="spinner" />{t("Rendering page…")}</div>}
      {error && <p className="preview-error" role="status">{error}</p>}
    </div>
    {document && <div className="pdf-pagination"><button disabled={page <= 1} aria-label="Previous PDF page" onClick={() => setPage((n) => n - 1)}><ChevronLeft size={16} /></button><span>{t("Page")}{page}{t("of")}{document.numPages}</span><button disabled={page >= document.numPages} aria-label="Next PDF page" onClick={() => setPage((n) => n + 1)}><ChevronRight size={16} /></button></div>}
  </div>;
}
