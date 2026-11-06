import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FileCheck,
  Layers,
  Move,
  PenTool,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Type,
  Upload,
  X
} from 'lucide-react';
import { PDFDocument, rgb, degrees } from 'pdf-lib';

interface SignPdfToolProps {
  initialFiles?: File[];
  close: () => void;
}

const WATERMARK_PRESETS = [
  'FOR VERIFICATION ONLY',
  'COPY - FOR OFFICIAL USE ONLY',
  'CONFIDENTIAL',
  'SAMPLE',
  'DRAFT'
];

export default function SignPdfTool({ initialFiles = [], close }: SignPdfToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [mode, setMode] = useState<'sign' | 'watermark'>('sign');

  // Signature state
  const [signType, setSignType] = useState<'draw' | 'type' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState<string>('#000000');
  const [typedName, setTypedName] = useState<string>('');
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string>('');
  const [sigPosition, setSigPosition] = useState<{ xPercent: number; yPercent: number }>({ xPercent: 50, yPercent: 80 });
  const [sigScale, setSigScale] = useState<number>(1.0);

  // Watermark state
  const [watermarkText, setWatermarkText] = useState<string>('FOR VERIFICATION ONLY');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.25);
  const [watermarkColor, setWatermarkColor] = useState<'red' | 'blue' | 'gray'>('red');
  const [watermarkAngle, setWatermarkAngle] = useState<number>(-45);
  const [applyWatermarkToAll, setApplyWatermarkToAll] = useState<boolean>(true);

  // Processing state
  const [busy, setBusy] = useState<boolean>(false);
  const [pageRendering, setPageRendering] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resultPdfBlob, setResultPdfBlob] = useState<Blob | null>(null);

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigUploadInputRef = useRef<HTMLInputElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfViewCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // PDF Document in memory
  const pdfDocCache = useRef<any>(null);

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
      setErrorMessage(t('Please select a PDF document.'));
      return;
    }

    setFile(f);
    setResultPdfBlob(null);
    loadPdfInfo(f);
  }

  async function loadPdfInfo(pdfFile: File) {
    setPageRendering(true);
    try {
      const buffer = await pdfFile.arrayBuffer();
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.mjs');
      Object.assign(globalThis, { pdfjsWorker: { WorkerMessageHandler: worker.WorkerMessageHandler } });

      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
      const doc = await loadingTask.promise;
      pdfDocCache.current = doc;
      setPageCount(doc.numPages);
      setCurrentPage(1);
      renderPageToCanvas(doc, 1);
    } catch (err: any) {
      setErrorMessage(t('Could not load PDF document. Please verify it is not password-protected.'));
    } finally {
      setPageRendering(false);
    }
  }

  async function renderPageToCanvas(doc: any, pageNum: number) {
    if (!doc || !pdfViewCanvasRef.current) return;
    setPageRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = pdfViewCanvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch {
      // Ignored if cancelled
    } finally {
      setPageRendering(false);
    }
  }

  useEffect(() => {
    if (pdfDocCache.current && pageCount > 0) {
      renderPageToCanvas(pdfDocCache.current, currentPage);
    }
  }, [currentPage]);

  // Signature Drawing Pad Handlers
  function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    isDrawingRef.current = true;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    lastPointRef.current = {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function drawMove(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const currentX = (clientX - rect.left) * (canvas.width / rect.width);
    const currentY = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastPointRef.current = { x: currentX, y: currentY };
  }

  function stopDrawing() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    bakeSignatureCanvasToBlob();
  }

  function clearDrawingPad() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureBlob(null);
    setSignatureUrl('');
  }

  function bakeSignatureCanvasToBlob() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        if (signatureUrl) URL.revokeObjectURL(signatureUrl);
        const url = URL.createObjectURL(blob);
        setSignatureBlob(blob);
        setSignatureUrl(url);
      }
    }, 'image/png');
  }

  // Generate typed signature on canvas
  useEffect(() => {
    if (signType !== 'type' || !typedName.trim()) return;

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = inkColor;
    ctx.font = 'italic 52px cursive, "Brush Script MT", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);

    canvas.toBlob((blob) => {
      if (blob) {
        if (signatureUrl) URL.revokeObjectURL(signatureUrl);
        setSignatureBlob(blob);
        setSignatureUrl(URL.createObjectURL(blob));
      }
    }, 'image/png');
  }, [typedName, inkColor, signType]);

  // Upload signature photo & remove white paper background
  function handleSignatureUpload(f?: File) {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      // Threshold out white paper background
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        // If close to white paper, make transparent
        if (r > 190 && g > 190 && b > 190) {
          d[i + 3] = 0;
        } else {
          // Darken ink
          d[i] = 20;
          d[i + 1] = 20;
          d[i + 2] = 40;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          if (signatureUrl) URL.revokeObjectURL(signatureUrl);
          setSignatureBlob(blob);
          setSignatureUrl(URL.createObjectURL(blob));
        }
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
  }

  // Interactive signature repositioning on PDF canvas
  function handlePdfCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mode !== 'sign' || !signatureUrl) return;
    const canvas = pdfViewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setSigPosition({ xPercent: xPct, yPercent: yPct });
  }

  // Bake Signature and/or Watermarks into PDF using pdf-lib
  async function applyChangesToPdf() {
    if (!file) return;
    setBusy(true);
    setErrorMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();

      if (mode === 'watermark') {
        const targetPages = applyWatermarkToAll ? pages : [pages[currentPage - 1]];

        // Color mapping
        let pdfColor = rgb(0.85, 0.1, 0.1); // red
        if (watermarkColor === 'blue') pdfColor = rgb(0.1, 0.3, 0.85);
        if (watermarkColor === 'gray') pdfColor = rgb(0.4, 0.4, 0.4);

        targetPages.forEach((page) => {
          const { width, height } = page.getSize();
          const fontSize = Math.min(width, height) / 10;

          // Draw diagonal centered watermark
          page.drawText(watermarkText, {
            x: width * 0.15,
            y: height * 0.45,
            size: fontSize,
            color: pdfColor,
            opacity: watermarkOpacity,
            rotate: degrees(watermarkAngle)
          });
        });
      } else if (mode === 'sign' && signatureBlob) {
        const sigArrayBuffer = await signatureBlob.arrayBuffer();
        const sigImage = await pdfDoc.embedPng(sigArrayBuffer);
        const targetPage = pages[currentPage - 1];
        const { width, height } = targetPage.getSize();

        // Calculate size and coordinates
        const sigWidth = 140 * sigScale;
        const sigHeight = (140 * (sigImage.height / sigImage.width)) * sigScale;
        const posX = (width * (sigPosition.xPercent / 100)) - (sigWidth / 2);
        // Note: PDF coordinate Y starts from bottom-left (0,0)
        const posY = (height * (1 - (sigPosition.yPercent / 100))) - (sigHeight / 2);

        targetPage.drawImage(sigImage, {
          x: Math.max(0, posX),
          y: Math.max(0, posY),
          width: sigWidth,
          height: sigHeight
        });
      }

      const outBytes = await pdfDoc.save();
      const outBlob = new Blob([outBytes], { type: 'application/pdf' });
      setResultPdfBlob(outBlob);
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to process and sign PDF.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadPdf() {
    if (!resultPdfBlob) return;
    const url = URL.createObjectURL(resultPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'sign' ? 'signed-document.pdf' : 'watermarked-document.pdf';
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
        className="tool-workspace signpdf-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signpdf-title"
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
            {t('Private & Client-Side · 100% On-Device Signing')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon teal">
            <PenTool size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('PDF tools')} <span>/</span> {t('SIGN & WATERMARK')}
              </span>
              <span className="hd-pill">ANTI-FRAUD</span>
            </div>
            <h2 id="signpdf-title">{t('Sign & Watermark PDF')}</h2>
            <p>
              {t('Sign agreements with digital signatures or stamp protective anti-fraud watermarks onto IC and document copies.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% Free · No Cloud Uploads')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main PDF Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {file ? `${t('PAGE')} ${currentPage} ${t('OF')} ${pageCount}` : t('PDF PREVIEW')}
              </span>
              <span>{file?.name || t('Select PDF')}</span>
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
                    <FileCheck size={38} />
                  </span>
                </span>
                <strong>{t('Select PDF to sign or protect')}</strong>
                <span>{t('Drop a contract, agreement, or IC copy here.')}</span>
                <span className="empty-upload">
                  <Upload size={16} />
                  {t('Choose PDF')}
                </span>
                <small>{t('PDF · Up to 100 MB')}</small>
              </button>
            ) : resultPdfBlob ? (
              <div className="sign-result-stage">
                <div className="sign-success-box">
                  <Check size={36} className="success-icon" />
                  <strong>
                    {mode === 'sign' ? t('Document Signed Successfully!') : t('Watermark Applied Successfully!')}
                  </strong>
                  <p>{t('Your file was processed 100% locally on your machine. Ready to download.')}</p>
                </div>

                <div className="result-actions-bar">
                  <button className="primary" onClick={downloadPdf}>
                    <Download size={18} />
                    {mode === 'sign' ? t('Download Signed PDF') : t('Download Protected PDF')}
                  </button>
                  <button className="secondary-btn" onClick={() => setResultPdfBlob(null)}>
                    <RotateCw size={15} />
                    {t('Make further edits')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pdf-stage-wrapper">
                {/* Page Navigation Topbar */}
                {pageCount > 1 && (
                  <div className="pdf-page-nav">
                    <button
                      disabled={currentPage <= 1 || pageRendering}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} />
                      {t('Previous page')}
                    </button>
                    <span>
                      {currentPage} / {pageCount}
                    </span>
                    <button
                      disabled={currentPage >= pageCount || pageRendering}
                      onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                    >
                      {t('Next page')}
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {/* PDF Canvas with interactive signature / watermark overlay */}
                <div className="pdf-interactive-container">
                  <canvas
                    ref={pdfViewCanvasRef}
                    className="pdf-viewport-canvas"
                    onClick={handlePdfCanvasClick}
                  />

                  {/* Signature Placement Overlay */}
                  {mode === 'sign' && signatureUrl && (
                    <div
                      className="sig-placement-box"
                      style={{
                        left: `${sigPosition.xPercent}%`,
                        top: `${sigPosition.yPercent}%`,
                        transform: `translate(-50%, -50%) scale(${sigScale})`
                      }}
                    >
                      <img src={signatureUrl} alt={t('Signature placement')} />
                      <span className="sig-drag-indicator">
                        <Move size={12} />
                        {t('Click canvas to move')}
                      </span>
                    </div>
                  )}

                  {/* Watermark Live Overlay Preview */}
                  {mode === 'watermark' && watermarkText && (
                    <div
                      className="watermark-live-preview"
                      style={{
                        transform: `translate(-50%, -50%) rotate(${watermarkAngle}deg)`,
                        opacity: watermarkOpacity,
                        color:
                          watermarkColor === 'red'
                            ? '#dc2626'
                            : watermarkColor === 'blue'
                            ? '#1d4ed8'
                            : '#4b5563'
                      }}
                    >
                      {watermarkText}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="canvas-footer">
              <ShieldCheck size={14} />
              {t('Processing occurs locally in your browser. Zero bytes uploaded.')}
            </div>
          </div>

          {/* Controls Sidebar */}
          <aside className="workspace-controls" aria-label={t('Signing controls')}>
            <div className="controls-section">
              <div className="controls-heading">
                <h3>{t('Source PDF')}</h3>
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

            {/* Mode Switcher Tabs */}
            <div className="controls-section settings-section">
              <div className="controls-heading">
                <h3>{t('Action Mode')}</h3>
              </div>

              <div className="sign-mode-switch" role="tablist">
                <button
                  type="button"
                  className={`sign-mode-btn ${mode === 'sign' ? 'active' : ''}`}
                  onClick={() => setMode('sign')}
                >
                  <PenTool size={15} />
                  {t('Digital Signature')}
                </button>
                <button
                  type="button"
                  className={`sign-mode-btn ${mode === 'watermark' ? 'active' : ''}`}
                  onClick={() => setMode('watermark')}
                >
                  <ShieldAlert size={15} />
                  {t('Security Stamp')}
                </button>
              </div>

              {mode === 'sign' ? (
                <>
                  <div className="sign-subtabs">
                    <button
                      className={signType === 'draw' ? 'selected' : ''}
                      onClick={() => setSignType('draw')}
                    >
                      {t('Draw')}
                    </button>
                    <button
                      className={signType === 'type' ? 'selected' : ''}
                      onClick={() => setSignType('type')}
                    >
                      {t('Type')}
                    </button>
                    <button
                      className={signType === 'upload' ? 'selected' : ''}
                      onClick={() => setSignType('upload')}
                    >
                      {t('Upload')}
                    </button>
                  </div>

                  {signType === 'draw' && (
                    <div className="drawing-pad-container">
                      <div className="drawing-pad-topbar">
                        <span>{t('Draw signature here')}:</span>
                        <button
                          type="button"
                          className="clear-pad-btn"
                          onClick={clearDrawingPad}
                          title={t('Clear drawing pad')}
                        >
                          <Eraser size={14} />
                          {t('Clear')}
                        </button>
                      </div>
                      <canvas
                        ref={drawCanvasRef}
                        width={400}
                        height={160}
                        className="drawing-pad-canvas"
                        onMouseDown={startDrawing}
                        onMouseMove={drawMove}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={drawMove}
                        onTouchEnd={stopDrawing}
                      />
                    </div>
                  )}

                  {signType === 'type' && (
                    <label className="field">
                      {t('Type your name')}
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                      />
                    </label>
                  )}

                  {signType === 'upload' && (
                    <div className="upload-sig-box">
                      <button
                        type="button"
                        className="secondary-btn full"
                        onClick={() => sigUploadInputRef.current?.click()}
                      >
                        <Upload size={16} />
                        {t('Upload Signature Image')}
                      </button>
                      <input
                        ref={sigUploadInputRef}
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={(e) => {
                          handleSignatureUpload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <small>{t('White paper backgrounds will be removed automatically.')}</small>
                    </div>
                  )}

                  {/* Ink Color Selection */}
                  <div className="field">
                    <span className="field-label">{t('Ink color')}</span>
                    <div className="ink-color-row">
                      {['#000000', '#002699', '#1d4ed8'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`ink-btn ${inkColor === c ? 'active' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setInkColor(c)}
                        >
                          {inkColor === c && <Check size={14} color="#fff" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scale Slider */}
                  {signatureUrl && (
                    <div className="slider-row">
                      <span>{t('Size')}</span>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={sigScale}
                        onChange={(e) => setSigScale(parseFloat(e.target.value))}
                      />
                      <span>{Math.round(sigScale * 100)}%</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label className="field">
                    {t('Watermark text')}
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                    />
                  </label>

                  <div className="watermark-presets-list">
                    <span className="field-label">{t('Popular anti-fraud presets')}:</span>
                    <div className="watermark-preset-chips">
                      {WATERMARK_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className="chip-btn"
                          onClick={() => setWatermarkText(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <span className="field-label">{t('Stamp color')}</span>
                    <div className="ink-color-row">
                      {[
                        { id: 'red', color: '#dc2626' },
                        { id: 'blue', color: '#1d4ed8' },
                        { id: 'gray', color: '#4b5563' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`ink-btn ${watermarkColor === item.id ? 'active' : ''}`}
                          style={{ backgroundColor: item.color }}
                          onClick={() => setWatermarkColor(item.id as any)}
                        >
                          {watermarkColor === item.id && <Check size={14} color="#fff" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="slider-row">
                    <span>{t('Opacity')}</span>
                    <input
                      type="range"
                      min="0.1"
                      max="0.5"
                      step="0.05"
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                    />
                    <span>{Math.round(watermarkOpacity * 100)}%</span>
                  </div>

                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={applyWatermarkToAll}
                      onChange={(e) => setApplyWatermarkToAll(e.target.checked)}
                    />
                    <span>
                      <strong>{t('Apply to all pages')}</strong>
                      <small>{t('Protects every page in your PDF document.')}</small>
                    </span>
                  </label>
                </>
              )}
            </div>

            {/* Action Area */}
            <div className={`workspace-action ${resultPdfBlob ? 'action-complete' : ''}`}>
              {errorMessage && (
                <p className="error" role="alert">
                  {errorMessage}
                </p>
              )}

              {resultPdfBlob ? (
                <button className="primary full" onClick={downloadPdf}>
                  <ArrowDownToLine size={18} />
                  {mode === 'sign' ? t('Download Signed PDF') : t('Download Protected PDF')}
                </button>
              ) : (
                <button
                  className="primary full"
                  disabled={!file || busy || (mode === 'sign' && !signatureUrl)}
                  onClick={applyChangesToPdf}
                >
                  {busy ? t('Processing PDF…') : mode === 'sign' ? t('Sign & Save PDF') : t('Stamp & Protect PDF')}
                  <ArrowRight size={17} />
                </button>
              )}

              <div className="dialog-privacy">
                <ShieldCheck size={13} />
                {t('No server upload · Processed 100% on device')}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
