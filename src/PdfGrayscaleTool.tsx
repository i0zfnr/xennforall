import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Download,
  FileText,
  Printer,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface PdfGrayscaleToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function PdfGrayscaleTool({ initialFiles = [], close }: PdfGrayscaleToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [mode, setMode] = useState<'grayscale' | 'inksaver'>('inksaver');
  const [threshold, setThreshold] = useState<number>(190); // ink saver threshold

  // State
  const [busy, setBusy] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Accessibility lock
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      prevActive?.focus();
    };
  }, []);

  // Ingest initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage(t('Please select a valid PDF document.'));
      return;
    }

    setFile(f);
    setConvertedBlob(null);
    loadPdf(f);
  }

  async function loadPdf(pdfFile: File) {
    setBusy(true);
    setProgressMsg(t('Loading PDF document…'));
    try {
      const buffer = await pdfFile.arrayBuffer();
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.mjs');
      Object.assign(globalThis, { pdfjsWorker: { WorkerMessageHandler: worker.WorkerMessageHandler } });

      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
      const doc = await loadingTask.promise;
      pdfDocRef.current = doc;
      setPageCount(doc.numPages);
      setCurrentPage(1);
      renderPagePreview(doc, 1);
    } catch {
      setErrorMessage(t('Could not load PDF document. Please verify it is not password-protected.'));
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  }

  async function renderPagePreview(doc: any, pageNum: number) {
    if (!doc || !canvasRef.current) return;
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Apply preview filter
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (mode === 'inksaver') {
          // If light, make pure white to save ink; if dark, make sharp black
          const v = gray > threshold ? 255 : gray * 0.85;
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
        } else {
          d[i] = gray;
          d[i + 1] = gray;
          d[i + 2] = gray;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Ignored
    }
  }

  useEffect(() => {
    if (pdfDocRef.current && pageCount > 0) {
      renderPagePreview(pdfDocRef.current, currentPage);
    }
  }, [mode, threshold, currentPage]);

  // Convert full document to ink-saving PDF
  async function convertDocument() {
    if (!file || !pdfDocRef.current) return;
    setBusy(true);
    setProgressMsg(t('Converting all pages to ink-saving grayscale…'));
    setErrorMessage('');

    try {
      const doc = pdfDocRef.current;
      const totalPages = doc.numPages;
      const outPdf = await PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        setProgressMsg(`${t('Processing page')} ${i} ${t('of')} ${totalPages}…`);
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.8 }); // High quality 1.8x print scale

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;
        const pageCtx = pageCanvas.getContext('2d');
        if (!pageCtx) throw new Error(t('Canvas processing failed.'));

        await page.render({ canvasContext: pageCtx, viewport }).promise;

        // Apply grayscale / ink saver filter
        const imgData = pageCtx.getImageData(0, 0, pageCanvas.width, pageCanvas.height);
        const d = imgData.data;

        for (let j = 0; j < d.length; j += 4) {
          const gray = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
          if (mode === 'inksaver') {
            const v = gray > threshold ? 255 : gray * 0.85;
            d[j] = v;
            d[j + 1] = v;
            d[j + 2] = v;
          } else {
            d[j] = gray;
            d[j + 1] = gray;
            d[j + 2] = gray;
          }
        }
        pageCtx.putImageData(imgData, 0, 0);

        const pageImgBlob = await new Promise<Blob>((resolve) => {
          pageCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
        });
        const pageImgBytes = await pageImgBlob.arrayBuffer();

        const embeddedImg = await outPdf.embedJpg(pageImgBytes);
        const outPage = outPdf.addPage([page.view[2] - page.view[0], page.view[3] - page.view[1]]);
        outPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: outPage.getWidth(),
          height: outPage.getHeight()
        });
      }

      const outPdfBytes = await outPdf.save();
      const outBlob = new Blob([outPdfBytes], { type: 'application/pdf' });
      setConvertedBlob(outBlob);
      setProgressMsg('');
    } catch (err: any) {
      setErrorMessage(err.message || t('Conversion failed.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadConvertedPdf() {
    if (!convertedBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const url = URL.createObjectURL(convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}-${mode}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace pdfgrayscale-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdfgrayscale-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={busy} onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('Private & Client-Side · Save Up To 70% Printer Ink')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon emerald">
            <Printer size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('PDF tools')} <span>/</span> {t('PDF INK SAVER & GRAYSCALE')}
              </span>
              <span className="hd-pill">INK SAVER 70%</span>
            </div>
            <h2 id="pdfgrayscale-title">{t('PDF Ink Saver & Grayscale Converter')}</h2>
            <p>
              {t('Convert color PDFs into ink-saving black and white or smooth grayscale before printing to save expensive toner.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('High Contrast · Fast Print')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {file ? `${t('PAGE')} ${currentPage} ${t('OF')} ${pageCount}` : t('PDF PREVIEW')}
              </span>
              <span>{file ? file.name : t('Select a PDF')}</span>
            </div>

            {!file ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileSelected(e.dataTransfer.files[0]);
                }}
              >
                <div className="empty-circle">
                  <Printer size={34} />
                </div>
                <h3>{t('Drop PDF to convert for printing')}</h3>
                <p>{t('Removes color backgrounds, maximizes text contrast, and saves printer cartridge ink.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select PDF')}
                </span>
              </button>
            ) : (
              <div className="pdfgrayscale-stage-wrap">
                <div className="pdf-preview-box">
                  <canvas ref={canvasRef} className="pdf-preview-canvas" />
                </div>

                {pageCount > 1 && (
                  <div className="redact-pagination">
                    <button
                      disabled={currentPage <= 1 || busy}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      {t('Previous')}
                    </button>
                    <span>
                      {currentPage} / {pageCount}
                    </span>
                    <button
                      disabled={currentPage >= pageCount || busy}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      {t('Next')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls Sidebar */}
          <div className="workspace-controls">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".pdf,application/pdf"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <label>{t('Ink Saver Mode')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={mode === 'inksaver' ? 'active' : ''}
                  onClick={() => setMode('inksaver')}
                >
                  <Sparkles size={15} />
                  {t('Ink Saver B&W')}
                </button>
                <button
                  type="button"
                  className={mode === 'grayscale' ? 'active' : ''}
                  onClick={() => setMode('grayscale')}
                >
                  <Printer size={15} />
                  {t('Smooth Grayscale')}
                </button>
              </div>
            </div>

            {mode === 'inksaver' && (
              <div className="control-group">
                <div className="slider-label-row">
                  <span>{t('Background Whitening Threshold')}</span>
                  <span>{threshold}</span>
                </div>
                <input
                  type="range"
                  min="140"
                  max="230"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </div>
            )}

            <div className="control-group">
              <label>{t('Printer Savings')}</label>
              <div className="spec-card">
                <div className="spec-row">
                  <span>{t('Ink Saved')}</span>
                  <strong className="badge-green">{mode === 'inksaver' ? '~50% to 70%' : '~30%'}</strong>
                </div>
                <div className="spec-row">
                  <span>{t('Page Count')}</span>
                  <strong>{pageCount > 0 ? `${pageCount} pages` : '-'}</strong>
                </div>
              </div>
            </div>

            <button
              className="primary-action"
              disabled={!file || busy}
              onClick={convertDocument}
            >
              {busy ? <RotateCw size={17} className="spin" /> : <Printer size={17} />}
              {busy ? progressMsg : t('Convert to Ink-Saving PDF')}
            </button>

            {convertedBlob && (
              <button className="download-btn-green" onClick={downloadConvertedPdf}>
                <Download size={18} />
                {t('Download Print-Ready PDF')}
              </button>
            )}

            {file && (
              <button
                className="btn-change-file"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Change PDF')}
              </button>
            )}

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
