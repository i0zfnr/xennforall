import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  LockKeyhole,
  RotateCw,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface RedactBox {
  id: string;
  page: number;
  x: number; // percentage (0 to 100)
  y: number; // percentage (0 to 100)
  width: number; // percentage
  height: number; // percentage
  color: 'black' | 'white';
}

interface RedactPdfToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function RedactPdfTool({ initialFiles = [], close }: RedactPdfToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [redactColor, setRedactColor] = useState<'black' | 'white'>('black');
  const [boxes, setBoxes] = useState<RedactBox[]>([]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentDragRect, setCurrentDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Processing state
  const [busy, setBusy] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [sanitizedBlob, setSanitizedBlob] = useState<Blob | null>(null);

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Keyboard accessibility and modal lock
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
    setBoxes([]);
    setSanitizedBlob(null);
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
      renderPage(doc, 1);
    } catch {
      setErrorMessage(t('Could not load PDF document. Please verify it is not password-protected.'));
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  }

  async function renderPage(doc: any, pageNum: number) {
    if (!doc || !canvasRef.current) return;
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch {
      // Catch cancelled renders
    }
  }

  useEffect(() => {
    if (pdfDocRef.current && pageCount > 0) {
      renderPage(pdfDocRef.current, currentPage);
    }
  }, [currentPage]);

  // Drawing Redaction Rectangles
  function handleMouseDown(e: React.MouseEvent) {
    if (!stageWrapperRef.current || busy || sanitizedBlob) return;
    const rect = stageWrapperRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentDragRect({ x, y, w: 0, h: 0 });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing || !startPoint || !stageWrapperRef.current) return;
    const rect = stageWrapperRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const w = Math.abs(currentX - startPoint.x);
    const h = Math.abs(currentY - startPoint.y);

    setCurrentDragRect({ x, y, w, h });
  }

  function handleMouseUp() {
    if (!isDrawing || !currentDragRect) return;
    setIsDrawing(false);

    // Only add if box has meaningful size (> 1% width and height)
    if (currentDragRect.w > 1 && currentDragRect.h > 1) {
      const newBox: RedactBox = {
        id: Math.random().toString(36).substring(2, 9),
        page: currentPage,
        x: currentDragRect.x,
        y: currentDragRect.y,
        width: currentDragRect.w,
        height: currentDragRect.h,
        color: redactColor
      };
      setBoxes((prev) => [...prev, newBox]);
    }

    setStartPoint(null);
    setCurrentDragRect(null);
  }

  function removeBox(id: string) {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
  }

  // Permanent Sanitization Pipeline:
  // Render pages to canvas, burn redaction boxes, and convert to clean flattened PDF
  async function applyPermanentRedaction() {
    if (!file || !pdfDocRef.current) return;
    setBusy(true);
    setErrorMessage('');
    setProgressMsg(t('Permanently sanitizing document pages…'));

    try {
      const doc = pdfDocRef.current;
      const totalPages = doc.numPages;
      const outPdf = await PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        setProgressMsg(`${t('Sanitizing page')} ${i} ${t('of')} ${totalPages}…`);
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High quality 2.0x scale

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;
        const pageCtx = pageCanvas.getContext('2d');
        if (!pageCtx) throw new Error(t('Canvas processing failed.'));

        // Render clean PDF page to canvas
        await page.render({ canvasContext: pageCtx, viewport }).promise;

        // Burn redaction boxes for this page
        const pageBoxes = boxes.filter((b) => b.page === i);
        pageBoxes.forEach((box) => {
          pageCtx.fillStyle = box.color === 'black' ? '#000000' : '#ffffff';
          const rx = (box.x / 100) * pageCanvas.width;
          const ry = (box.y / 100) * pageCanvas.height;
          const rw = (box.width / 100) * pageCanvas.width;
          const rh = (box.height / 100) * pageCanvas.height;
          pageCtx.fillRect(rx, ry, rw, rh);
        });

        // Convert page to clean image JPEG to completely eradicate underlying vector text
        const pageImgBlob = await new Promise<Blob>((resolve) => {
          pageCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
        });
        const pageImgBytes = await pageImgBlob.arrayBuffer();

        const embeddedImg = await outPdf.embedJpg(pageImgBytes);
        // Add page matching original point dimensions
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
      setSanitizedBlob(outBlob);
      setProgressMsg('');
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to sanitize and redact PDF.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadSanitizedPdf() {
    if (!sanitizedBlob) return;
    const url = URL.createObjectURL(sanitizedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sanitized-redacted-document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const currentPageBoxes = boxes.filter((b) => b.page === currentPage);
  const hasResult = !!sanitizedBlob;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace redact-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="redact-title"
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
            {t('Private & Client-Side · Permanent Text Eradication')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon rose">
            <ShieldAlert size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('PDF tools')} <span>/</span> {t('PDF REDACTOR')}
              </span>
              <span className="hd-pill">PRIVACY BLACKOUT</span>
            </div>
            <h2 id="redact-title">{t('PDF Redactor & Privacy Blackout')}</h2>
            <p>
              {t('Permanently blackout or whiteout confidential details, IC numbers, bank balances, and addresses.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% Client-Side · Unrecoverable')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual PDF Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {file ? `${t('PAGE')} ${currentPage} ${t('OF')} ${pageCount}` : t('PDF PREVIEW')}
              </span>
              <span>{file?.name || t('Select PDF to redact')}</span>
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
                <span className="empty-file-art">
                  <span className="empty-paper back-paper" />
                  <span className="empty-paper">
                    <EyeOff size={38} />
                  </span>
                </span>
                <strong>{t('Select PDF to redact')}</strong>
                <span>{t('Drop a bank statement, payslip, or government document here.')}</span>
                <span className="empty-upload">
                  <Upload size={16} />
                  {t('Choose PDF')}
                </span>
                <small>{t('PDF · Up to 100 MB')}</small>
              </button>
            ) : hasResult ? (
              <div className="redact-result-stage">
                <div className="sign-success-box">
                  <Check size={36} className="success-icon" />
                  <strong>{t('Document Sanitized & Redacted!')}</strong>
                  <p>
                    {t(
                      'All redactions are permanently burned and underlying text layers flattened. Sensitive info cannot be copied or recovered.'
                    )}
                  </p>
                </div>

                <div className="result-actions-bar">
                  <button className="primary" onClick={downloadSanitizedPdf}>
                    <Download size={18} />
                    {t('Download Sanitized PDF')}
                  </button>
                  <button className="secondary-btn" onClick={() => setSanitizedBlob(null)}>
                    <RotateCw size={15} />
                    {t('Add more redactions')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="redact-stage-wrapper">
                {/* Page Navigation */}
                {pageCount > 1 && (
                  <div className="pdf-page-nav">
                    <button
                      disabled={currentPage <= 1 || busy}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} />
                      {t('Previous page')}
                    </button>
                    <span>
                      {currentPage} / {pageCount}
                    </span>
                    <button
                      disabled={currentPage >= pageCount || busy}
                      onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                    >
                      {t('Next page')}
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {/* Interactive Drawing Stage */}
                <div
                  ref={stageWrapperRef}
                  className="redact-interactive-stage"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  <canvas ref={canvasRef} className="redact-pdf-canvas" />

                  {/* Rendered Redaction Boxes for Current Page */}
                  {currentPageBoxes.map((box) => (
                    <div
                      key={box.id}
                      className={`redact-box-overlay ${box.color}`}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`
                      }}
                    >
                      <button
                        type="button"
                        className="delete-box-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBox(box.id);
                        }}
                        title={t('Remove redaction box')}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {/* Dragging In-Progress Box */}
                  {currentDragRect && (
                    <div
                      className={`redact-box-overlay in-progress ${redactColor}`}
                      style={{
                        left: `${currentDragRect.x}%`,
                        top: `${currentDragRect.y}%`,
                        width: `${currentDragRect.w}%`,
                        height: `${currentDragRect.h}%`
                      }}
                    />
                  )}
                </div>

                <p className="stage-drag-tip">
                  <Scissors size={14} />
                  {t('Click and drag over confidential text, numbers, or photos to create a blackout box.')}
                </p>
              </div>
            )}

            <div className="canvas-footer">
              <ShieldCheck size={14} />
              {t('Processing occurs locally in your browser. Zero bytes uploaded.')}
            </div>
          </div>

          {/* Controls Sidebar */}
          <aside className="workspace-controls" aria-label={t('Redaction settings')}>
            <div className="controls-section">
              <div className="controls-heading">
                <h3>{t('Document file')}</h3>
              </div>
              <p className="controls-description">
                {file ? `${file.name} (${pageCount} ${t('pages')})` : t('Select a PDF to begin.')}
              </p>
              <button
                className="dropzone workspace-upload"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={17} />
                <b>{file ? t('Choose a different PDF') : t('Select PDF')}</b>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  handleFileSelected(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="controls-section settings-section">
              <div className="controls-heading">
                <h3>{t('Redaction Style')}</h3>
              </div>

              <div className="redact-color-picker">
                <button
                  type="button"
                  className={`color-choice-btn ${redactColor === 'black' ? 'active' : ''}`}
                  onClick={() => setRedactColor('black')}
                >
                  <span className="color-swatch black" />
                  <strong>{t('Blackout (Solid Black)')}</strong>
                </button>
                <button
                  type="button"
                  className={`color-choice-btn ${redactColor === 'white' ? 'active' : ''}`}
                  onClick={() => setRedactColor('white')}
                >
                  <span className="color-swatch white" />
                  <strong>{t('Whiteout (Clean White)')}</strong>
                </button>
              </div>

              {/* Redactions list */}
              <div className="redactions-summary-card">
                <div className="summary-header">
                  <span>{t('Total Redactions')}:</span>
                  <strong>{boxes.length}</strong>
                </div>
                {boxes.length > 0 && (
                  <button
                    type="button"
                    className="clear-all-redacts-btn"
                    onClick={() => setBoxes([])}
                  >
                    <Trash2 size={13} />
                    {t('Clear all')}
                  </button>
                )}
              </div>
            </div>

            {/* Action Area */}
            <div className={`workspace-action ${hasResult ? 'action-complete' : ''}`}>
              {errorMessage && (
                <p className="error" role="alert">
                  {errorMessage}
                </p>
              )}

              {busy && progressMsg && (
                <p className="status" role="status">
                  <span className="spinner" />
                  {progressMsg}
                </p>
              )}

              {hasResult ? (
                <button className="primary full" onClick={downloadSanitizedPdf}>
                  <ArrowDownToLine size={18} />
                  {t('Download Sanitized PDF')}
                </button>
              ) : (
                <button
                  className="primary full"
                  disabled={!file || busy || boxes.length === 0}
                  onClick={applyPermanentRedaction}
                >
                  {busy ? t('Sanitizing…') : t('Permanently Redact PDF')}
                  <ArrowRight size={17} />
                </button>
              )}

              <div className="dialog-privacy">
                <LockKeyhole size={13} />
                {t('Permanently removes underlying text · Safe for sharing')}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
