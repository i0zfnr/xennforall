import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Contrast,
  Crop,
  Download,
  FileText,
  Maximize2,
  RefreshCw,
  RotateCw,
  Scan,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Upload,
  X
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface Point {
  x: number;
  y: number;
}

interface ScanDocToolProps {
  initialFiles?: File[];
  close: () => void;
}

type ScanFilter = 'magic' | 'bw' | 'grayscale' | 'original';

export default function ScanDocTool({ initialFiles = [], close }: ScanDocToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);

  // 4 corners for perspective straightening
  const [corners, setCorners] = useState<Point[]>([
    { x: 0.05, y: 0.05 }, // Top-Left
    { x: 0.95, y: 0.05 }, // Top-Right
    { x: 0.95, y: 0.95 }, // Bottom-Right
    { x: 0.05, y: 0.95 }  // Bottom-Left
  ]);
  const [activeCorner, setActiveCorner] = useState<number | null>(null);

  // Filter settings
  const [filter, setFilter] = useState<ScanFilter>('magic');
  const [brightness, setBrightness] = useState<number>(10);
  const [contrast, setContrast] = useState<number>(25);

  // Results
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [scannedCanvas, setScannedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [scannedImageUrl, setScannedImageUrl] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'png' | 'jpg'>('pdf');

  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

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
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && !/\.(jpg|jpeg|png|webp)$/i.test(f.name)) {
      setErrorMessage(t('Please select a JPG, PNG, or WebP photo of your document.'));
      return;
    }

    setFile(f);
    setScannedImageUrl('');
    setScannedCanvas(null);

    const url = URL.createObjectURL(f);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setImageEl(img);
      // Reset default corners
      setCorners([
        { x: 0.05, y: 0.05 },
        { x: 0.95, y: 0.05 },
        { x: 0.95, y: 0.95 },
        { x: 0.05, y: 0.95 }
      ]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setErrorMessage(t('Could not load image file.'));
    };
  }

  // Interactive Corner Dragging
  function handleStageMouseDown(e: React.MouseEvent, cornerIndex: number) {
    e.stopPropagation();
    setActiveCorner(cornerIndex);
  }

  function handleStageMouseMove(e: React.MouseEvent) {
    if (activeCorner === null || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setCorners((prev) => {
      const next = [...prev];
      next[activeCorner] = { x, y };
      return next;
    });
  }

  function handleStageMouseUp() {
    setActiveCorner(null);
  }

  // Perspective Warp & Image Enhancement Pipeline
  async function processDocumentScan() {
    if (!imageEl) return;
    setBusy(true);
    setErrorMessage('');

    try {
      const naturalW = imageEl.naturalWidth;
      const naturalH = imageEl.naturalHeight;

      // Real pixel corner coordinates
      const p0 = { x: corners[0].x * naturalW, y: corners[0].y * naturalH }; // Top-Left
      const p1 = { x: corners[1].x * naturalW, y: corners[1].y * naturalH }; // Top-Right
      const p2 = { x: corners[2].x * naturalW, y: corners[2].y * naturalH }; // Bottom-Right
      const p3 = { x: corners[3].x * naturalW, y: corners[3].y * naturalH }; // Bottom-Left

      // Calculate output width and height based on average edge lengths
      const topDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const bottomDist = Math.hypot(p2.x - p3.x, p2.y - p3.y);
      const leftDist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      const rightDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      const outW = Math.max(300, Math.round((topDist + bottomDist) / 2));
      const outH = Math.max(300, Math.round((leftDist + rightDist) / 2));

      // 1. Source image canvas
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = naturalW;
      srcCanvas.height = naturalH;
      const srcCtx = srcCanvas.getContext('2d');
      if (!srcCtx) throw new Error(t('Canvas processing unavailable.'));
      srcCtx.drawImage(imageEl, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, naturalW, naturalH);

      // 2. Output destination canvas
      const outCanvas = document.createElement('canvas');
      outCanvas.width = outW;
      outCanvas.height = outH;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) throw new Error(t('Output canvas unavailable.'));
      const outData = outCtx.createImageData(outW, outH);

      // Bilinear inverse interpolation mapping
      const srcPix = srcData.data;
      const dstPix = outData.data;

      for (let y = 0; y < outH; y++) {
        const v = y / outH;
        for (let x = 0; x < outW; x++) {
          const u = x / outW;

          // Interpolate along top and bottom edges
          const topX = p0.x + u * (p1.x - p0.x);
          const topY = p0.y + u * (p1.y - p0.y);
          const botX = p3.x + u * (p2.x - p3.x);
          const botY = p3.y + u * (p2.y - p3.y);

          // Bilinear point
          const srcX = Math.round(topX + v * (botX - topX));
          const srcY = Math.round(topY + v * (botY - topY));

          const dstIdx = (y * outW + x) * 4;

          if (srcX >= 0 && srcX < naturalW && srcY >= 0 && srcY < naturalH) {
            const srcIdx = (srcY * naturalW + srcX) * 4;
            let r = srcPix[srcIdx];
            let g = srcPix[srcIdx + 1];
            let b = srcPix[srcIdx + 2];

            // 3. Apply Scan Document Filter
            if (filter === 'bw') {
              // High contrast black-and-white
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              const threshold = 140 - brightness;
              const val = gray > threshold ? 255 : 0;
              r = g = b = val;
            } else if (filter === 'grayscale') {
              const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
              r = g = b = gray;
            } else if (filter === 'magic') {
              // Magic Color: lighten paper background and boost ink contrast
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              const factor = 1.25 + contrast / 100;
              r = Math.min(255, Math.max(0, Math.round((r - 128) * factor + 128 + brightness)));
              g = Math.min(255, Math.max(0, Math.round((g - 128) * factor + 128 + brightness)));
              b = Math.min(255, Math.max(0, Math.round((b - 128) * factor + 128 + brightness)));
            }

            dstPix[dstIdx] = r;
            dstPix[dstIdx + 1] = g;
            dstPix[dstIdx + 2] = b;
            dstPix[dstIdx + 3] = 255;
          } else {
            dstPix[dstIdx] = 255;
            dstPix[dstIdx + 1] = 255;
            dstPix[dstIdx + 2] = 255;
            dstPix[dstIdx + 3] = 255;
          }
        }
      }

      outCtx.putImageData(outData, 0, 0);

      const url = outCanvas.toDataURL('image/jpeg', 0.95);
      setScannedCanvas(outCanvas);
      setScannedImageUrl(url);
    } catch (err: any) {
      setErrorMessage(err.message || t('Document scanning failed.'));
    } finally {
      setBusy(false);
    }
  }

  // Export as PDF or Image
  async function downloadResult() {
    if (!scannedCanvas) return;

    if (exportFormat === 'pdf') {
      const imgBlob = await new Promise<Blob>((resolve) => {
        scannedCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
      });
      const imgBuffer = await imgBlob.arrayBuffer();

      const pdfDoc = await PDFDocument.create();
      const embeddedImg = await pdfDoc.embedJpg(imgBuffer);
      const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: embeddedImg.width,
        height: embeddedImg.height
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      triggerDownload(blob, 'scanned-document.pdf');
    } else {
      const mime = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
      scannedCanvas.toBlob((b) => {
        if (b) triggerDownload(b, `scanned-document.${exportFormat}`);
      }, mime, 0.95);
    }
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const hasResult = !!scannedImageUrl;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace scandoc-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scandoc-title"
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
            {t('Private & Client-Side · Auto Perspective Dewarp')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon violet">
            <Scan size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('DOCUMENT SCANNER')}
              </span>
              <span className="hd-pill">STRAIGHTEN & CLEAN</span>
            </div>
            <h2 id="scandoc-title">{t('Document & Receipt Scanner')}</h2>
            <p>
              {t('Straighten angled paper photos, remove yellow shadows, and generate clean PDF scans.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% Free · CamScanner Alternative')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {hasResult ? t('CLEAN SCANNED DOCUMENT') : t('CORNER SELECTION STAGE')}
              </span>
              <span>{file?.name || t('Select document photo')}</span>
            </div>

            {!imageEl ? (
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
                    <Scan size={38} />
                  </span>
                </span>
                <strong>{t('Select paper photo or receipt')}</strong>
                <span>{t('Drop a phone photo of a document or receipt here.')}</span>
                <span className="empty-upload">
                  <Upload size={16} />
                  {t('Choose photo')}
                </span>
                <small>{t('JPG, PNG, WebP · Up to 50 MB')}</small>
              </button>
            ) : hasResult ? (
              <div className="scandoc-result-stage">
                <div className="scanned-image-preview-wrap">
                  <img src={scannedImageUrl} alt={t('Scanned document output')} />
                </div>

                <div className="result-actions-bar">
                  <button className="primary" onClick={downloadResult}>
                    <Download size={18} />
                    {exportFormat === 'pdf' ? t('Download Scanned PDF') : t('Download Clean Image')}
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setScannedImageUrl('');
                      setScannedCanvas(null);
                    }}
                  >
                    <RotateCw size={15} />
                    {t('Adjust corners & filters')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="scandoc-interactive-stage">
                <div
                  ref={stageRef}
                  className="scandoc-crop-box"
                  onMouseMove={handleStageMouseMove}
                  onMouseUp={handleStageMouseUp}
                  onMouseLeave={handleStageMouseUp}
                >
                  <img src={imageEl.src} alt={t('Original document')} className="crop-bg-image" />

                  {/* Corner Polygon SVG Overlay */}
                  <svg className="corner-polygon-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon
                      points={`${corners[0].x * 100},${corners[0].y * 100} ${corners[1].x * 100},${
                        corners[1].y * 100
                      } ${corners[2].x * 100},${corners[2].y * 100} ${corners[3].x * 100},${corners[3].y * 100}`}
                      fill="rgba(168, 85, 247, 0.18)"
                      stroke="#a855f7"
                      strokeWidth="0.8"
                    />
                  </svg>

                  {/* 4 Interactive Drag Handles */}
                  {corners.map((c, i) => (
                    <div
                      key={i}
                      className="corner-handle"
                      style={{
                        left: `${c.x * 100}%`,
                        top: `${c.y * 100}%`
                      }}
                      onMouseDown={(e) => handleStageMouseDown(e, i)}
                    >
                      <div className="handle-dot" />
                      <span className="handle-label">
                        {i === 0 ? 'TL' : i === 1 ? 'TR' : i === 2 ? 'BR' : 'BL'}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="stage-drag-tip">
                  <Crop size={14} />
                  {t('Drag the 4 corner circles to match the edges of your paper document.')}
                </p>
              </div>
            )}

            <div className="canvas-footer">
              <ShieldCheck size={14} />
              {t('Processing occurs locally in your browser. Zero bytes uploaded.')}
            </div>
          </div>

          {/* Controls Sidebar */}
          <aside className="workspace-controls" aria-label={t('Document scanner controls')}>
            <div className="controls-section">
              <div className="controls-heading">
                <h3>{t('Source photo')}</h3>
              </div>
              <p className="controls-description">
                {file ? file.name : t('Select a photo of your document.')}
              </p>
              <button
                className="dropzone workspace-upload"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={17} />
                <b>{file ? t('Choose a different photo') : t('Select photo')}</b>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  handleFileSelected(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="controls-section settings-section">
              <div className="controls-heading">
                <h3>{t('Scan Filters')}</h3>
              </div>

              {/* Filter Selector */}
              <div className="scan-filter-grid">
                {[
                  { id: 'magic', name: t('Magic Color'), desc: t('Clean paper, vivid text') },
                  { id: 'bw', name: t('Crisp B&W'), desc: t('High contrast scan') },
                  { id: 'grayscale', name: t('Grayscale'), desc: t('Smooth mono tones') },
                  { id: 'original', name: t('Original'), desc: t('Straightened only') }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`filter-btn ${filter === f.id ? 'active' : ''}`}
                    onClick={() => setFilter(f.id as any)}
                  >
                    <strong>{f.name}</strong>
                    <small>{f.desc}</small>
                  </button>
                ))}
              </div>

              {/* Sliders */}
              <div className="slider-row">
                <span>{t('Paper Brightness')}</span>
                <input
                  type="range"
                  min="-30"
                  max="50"
                  value={brightness}
                  disabled={busy}
                  onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                />
                <span>{brightness > 0 ? `+${brightness}` : brightness}</span>
              </div>

              <div className="slider-row">
                <span>{t('Ink Contrast')}</span>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={contrast}
                  disabled={busy}
                  onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                />
                <span>{contrast}</span>
              </div>

              {/* Export Format */}
              <label className="field">
                {t('Export format')}
                <select
                  value={exportFormat}
                  disabled={busy}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                >
                  <option value="pdf">{t('PDF Document (.pdf)')}</option>
                  <option value="png">{t('High Quality Image (.png)')}</option>
                  <option value="jpg">{t('Compressed Photo (.jpg)')}</option>
                </select>
              </label>
            </div>

            {/* Action Area */}
            <div className={`workspace-action ${hasResult ? 'action-complete' : ''}`}>
              {errorMessage && (
                <p className="error" role="alert">
                  {errorMessage}
                </p>
              )}

              {hasResult ? (
                <button className="primary full" onClick={downloadResult}>
                  <ArrowDownToLine size={18} />
                  {exportFormat === 'pdf' ? t('Download Scanned PDF') : t('Download Clean Image')}
                </button>
              ) : (
                <button
                  className="primary full"
                  disabled={!imageEl || busy}
                  onClick={processDocumentScan}
                >
                  {busy ? t('Straightening & cleaning…') : t('Straighten & Clean Scan')}
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
