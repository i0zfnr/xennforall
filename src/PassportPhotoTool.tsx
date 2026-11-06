import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Download,
  Grid,
  Maximize2,
  Minus,
  Plus,
  Printer,
  RotateCw,
  ShieldCheck,
  Upload,
  User,
  X
} from 'lucide-react';

interface PassportPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

const PRESETS: PassportPreset[] = [
  { id: 'my_ic', name: 'Malaysia Passport & IC', widthMm: 35, heightMm: 50, description: '35 × 50 mm (Official Standard)' },
  { id: 'intl_standard', name: 'Standard / Schengen / UK / SG', widthMm: 35, heightMm: 45, description: '35 × 45 mm (Global Standard)' },
  { id: 'us_visa', name: 'US Visa & Passport / India', widthMm: 51, heightMm: 51, description: '2 × 2 inches (51 × 51 mm Square)' },
  { id: 'id_card', name: 'Driving License / Student Card', widthMm: 25, heightMm: 30, description: '25 × 30 mm' }
];

interface BackgroundOption {
  id: string;
  name: string;
  color: string;
  border?: boolean;
}

const BG_OPTIONS: BackgroundOption[] = [
  { id: 'white', name: 'White', color: '#ffffff', border: true },
  { id: 'my_blue', name: 'Malaysia IC Blue', color: '#0052cc' },
  { id: 'intl_blue', name: 'Light Blue', color: '#38bdf8' },
  { id: 'red', name: 'Red', color: '#dc2626' },
  { id: 'grey', name: 'Light Grey', color: '#e5e7eb', border: true },
  { id: 'original', name: 'Original Photo', color: 'transparent' }
];

interface PassportPhotoToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function PassportPhotoTool({ initialFiles = [], close }: PassportPhotoToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);

  // Settings
  const [selectedPreset, setSelectedPreset] = useState<PassportPreset>(PRESETS[0]);
  const [selectedBg, setSelectedBg] = useState<BackgroundOption>(BG_OPTIONS[0]);
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [showFaceGuide, setShowFaceGuide] = useState<boolean>(true);

  // Processing state
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Results
  const [singlePhotoUrl, setSinglePhotoUrl] = useState<string>('');
  const [singlePhotoBlob, setSinglePhotoBlob] = useState<Blob | null>(null);
  const [printSheetUrl, setPrintSheetUrl] = useState<string>('');
  const [printSheetBlob, setPrintSheetBlob] = useState<Blob | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'sheet'>('single');

  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
      setErrorMessage(t('Please select a JPG, PNG, or WebP photo.'));
      return;
    }

    setFile(f);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setImageEl(img);
      setZoom(1.0);
      setPanX(0);
      setPanY(0);
      setRotation(0);
      setSinglePhotoUrl('');
      setPrintSheetUrl('');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setErrorMessage(t('Could not load image file.'));
    };
  }

  // Draw photo onto preview canvas whenever adjustments change
  useEffect(() => {
    if (!imageEl) return;
    drawSinglePhotoCanvas();
  }, [imageEl, selectedPreset, selectedBg, zoom, panX, panY, rotation]);

  function drawSinglePhotoCanvas(targetCanvas?: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = targetCanvas || previewCanvasRef.current || document.createElement('canvas');
    if (!imageEl) return canvas;

    // 300 DPI calculation (1 mm approx. 11.81 pixels at 300 DPI)
    const pxWidth = Math.round(selectedPreset.widthMm * 11.811);
    const pxHeight = Math.round(selectedPreset.heightMm * 11.811);

    canvas.width = pxWidth;
    canvas.height = pxHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Background color pass
    if (selectedBg.id !== 'original') {
      ctx.fillStyle = selectedBg.color;
      ctx.fillRect(0, 0, pxWidth, pxHeight);
    }

    ctx.save();
    // Center origin
    ctx.translate(pxWidth / 2 + panX, pxHeight / 2 + panY);
    ctx.rotate((rotation * Math.PI) / 180);

    // Scaling to cover
    const scale = Math.max(pxWidth / imageEl.naturalWidth, pxHeight / imageEl.naturalHeight) * zoom;
    const drawW = imageEl.naturalWidth * scale;
    const drawH = imageEl.naturalHeight * scale;

    ctx.drawImage(imageEl, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    return canvas;
  }

  // Generate Single Photo & Printable 4x6 Sheet
  async function generatePassportPhotos() {
    if (!imageEl) return;
    setBusy(true);
    setErrorMessage('');

    try {
      // 1. Single Photo at 300 DPI
      const singleCanvas = drawSinglePhotoCanvas(document.createElement('canvas'));
      const singleBlob = await new Promise<Blob>((resolve, reject) => {
        singleCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(t('Failed to export single photo.')))),
          'image/jpeg',
          0.95
        );
      });
      const singleUrl = URL.createObjectURL(singleBlob);
      setSinglePhotoBlob(singleBlob);
      setSinglePhotoUrl(singleUrl);

      // 2. Printable 4x6 Inch Sheet (1200 x 1800 px at 300 DPI)
      const sheetCanvas = document.createElement('canvas');
      const sheetWidth = 1800; // 6 inches at 300 DPI (landscape 6x4)
      const sheetHeight = 1200; // 4 inches at 300 DPI
      sheetCanvas.width = sheetWidth;
      sheetCanvas.height = sheetHeight;
      const sheetCtx = sheetCanvas.getContext('2d');
      if (!sheetCtx) throw new Error(t('Canvas rendering unavailable.'));

      // Clean white sheet background
      sheetCtx.fillStyle = '#ffffff';
      sheetCtx.fillRect(0, 0, sheetWidth, sheetHeight);

      const pWidth = singleCanvas.width;
      const pHeight = singleCanvas.height;

      // Determine grid layout (e.g. 2 rows x 4 cols or 2 rows x 3 cols)
      const cols = Math.floor((sheetWidth - 100) / (pWidth + 30));
      const rows = Math.floor((sheetHeight - 100) / (pHeight + 30));
      const totalCount = cols * rows;

      const gapX = 30;
      const gapY = 30;
      const totalGridW = cols * pWidth + (cols - 1) * gapX;
      const totalGridH = rows * pHeight + (rows - 1) * gapY;
      const startX = (sheetWidth - totalGridW) / 2;
      const startY = (sheetHeight - totalGridH) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const posX = startX + c * (pWidth + gapX);
          const posY = startY + r * (pHeight + gapY);

          // Draw passport photo
          sheetCtx.drawImage(singleCanvas, posX, posY, pWidth, pHeight);

          // Thin cutting guide border
          sheetCtx.strokeStyle = '#d1d5db';
          sheetCtx.lineWidth = 1;
          sheetCtx.strokeRect(posX, posY, pWidth, pHeight);
        }
      }

      // Sheet header note
      sheetCtx.fillStyle = '#6b7280';
      sheetCtx.font = '24px sans-serif';
      sheetCtx.fillText(
        `Xenn for all · Printable 4×6 inch Photo Sheet (${selectedPreset.name} · ${totalCount} Photos)`,
        startX,
        startY - 20
      );

      const sheetBlob = await new Promise<Blob>((resolve, reject) => {
        sheetCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(t('Failed to export photo sheet.')))),
          'image/jpeg',
          0.95
        );
      });
      const sheetUrl = URL.createObjectURL(sheetBlob);
      setPrintSheetBlob(sheetBlob);
      setPrintSheetUrl(sheetUrl);

      setActiveTab('single');
    } catch (err: any) {
      setErrorMessage(err.message || t('Error generating passport photo.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Interactive Pan via canvas drag
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDraggingRef.current) return;
    setPanX(e.clientX - dragStartRef.current.x);
    setPanY(e.clientY - dragStartRef.current.y);
  }

  function handleMouseUp() {
    isDraggingRef.current = false;
  }

  const hasResult = !!singlePhotoUrl;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace passport-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passport-title"
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
            {t('Private & In-Browser · 300 DPI Official Specs')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon amber">
            <Camera size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('PASSPORT & IC PHOTO')}
              </span>
              <span className="hd-pill">300 DPI PRINT</span>
            </div>
            <h2 id="passport-title">{t('Passport & IC Photo Studio')}</h2>
            <p>
              {t('Official biometric standards, custom background colors, and print-ready 4×6 photo sheets.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% Free · Print at Home or Pharmacy')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Canvas Area */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {hasResult ? t('GENERATED PASSPORT PHOTOS') : t('ALIGNMENT STAGE')}
              </span>
              <span>{file?.name || t('Select portrait photo')}</span>
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
                    <User size={38} />
                  </span>
                </span>
                <strong>{t('Select your portrait photo')}</strong>
                <span>{t('Drop a selfie or photo here. We will align it to official passport specifications.')}</span>
                <span className="empty-upload">
                  <Upload size={16} />
                  {t('Choose photo')}
                </span>
                <small>{t('JPG, PNG, WebP · Up to 50 MB')}</small>
              </button>
            ) : hasResult ? (
              <div className="passport-result-stage">
                <div className="passport-tab-switch">
                  <button
                    className={`tab-btn ${activeTab === 'single' ? 'active' : ''}`}
                    onClick={() => setActiveTab('single')}
                  >
                    <User size={15} />
                    {t('Single Digital Photo')}
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'sheet' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sheet')}
                  >
                    <Grid size={15} />
                    {t('Printable 4×6 Sheet')}
                  </button>
                </div>

                <div className="passport-preview-container">
                  {activeTab === 'single' && singlePhotoUrl ? (
                    <div className="single-photo-preview-wrap">
                      <img src={singlePhotoUrl} alt={t('Passport single photo')} />
                      <div className="photo-spec-chip">
                        <span>{selectedPreset.name}</span>
                        <strong>{selectedPreset.widthMm} × {selectedPreset.heightMm} mm · 300 DPI</strong>
                      </div>
                    </div>
                  ) : activeTab === 'sheet' && printSheetUrl ? (
                    <div className="sheet-preview-wrap">
                      <img src={printSheetUrl} alt={t('Printable 4x6 photo sheet')} />
                      <div className="photo-spec-chip">
                        <span>4×6 Inch Sheet (10×15 cm)</span>
                        <strong>Ready to print at any photo kiosk or pharmacy</strong>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="result-actions-bar">
                  {activeTab === 'single' && singlePhotoBlob && (
                    <button
                      className="primary"
                      onClick={() => downloadBlob(singlePhotoBlob, 'passport-photo-single.jpg')}
                    >
                      <Download size={17} />
                      {t('Download Single Photo (JPG)')}
                    </button>
                  )}
                  {activeTab === 'sheet' && printSheetBlob && (
                    <button
                      className="primary"
                      onClick={() => downloadBlob(printSheetBlob, 'passport-photos-4x6-sheet.jpg')}
                    >
                      <Printer size={17} />
                      {t('Download 4×6 Print Sheet (JPG)')}
                    </button>
                  )}
                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setSinglePhotoUrl('');
                      setPrintSheetUrl('');
                    }}
                  >
                    <RotateCw size={15} />
                    {t('Adjust alignment')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="passport-stage-wrapper">
                <div className="passport-interactive-stage">
                  <div
                    className="passport-canvas-box"
                    style={{
                      aspectRatio: `${selectedPreset.widthMm} / ${selectedPreset.heightMm}`
                    }}
                  >
                    <canvas
                      ref={previewCanvasRef}
                      className="passport-canvas"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    />

                    {/* Official Biometric Face Guide Overlay */}
                    {showFaceGuide && (
                      <div className="face-guide-overlay" pointer-events="none">
                        <div className="face-oval" />
                        <div className="eye-line" />
                        <div className="chin-line" />
                        <span className="guide-label">{t('Align eyes & chin inside guide')}</span>
                      </div>
                    )}
                  </div>

                  <p className="stage-drag-tip">
                    <Maximize2 size={14} />
                    {t('Click and drag photo to center. Use sliders to zoom and adjust angle.')}
                  </p>
                </div>
              </div>
            )}

            <div className="canvas-footer">
              <ShieldCheck size={14} />
              {t('Processing occurs locally in your browser. Zero bytes uploaded.')}
            </div>
          </div>

          {/* Controls Sidebar */}
          <aside className="workspace-controls" aria-label={t('Passport photo controls')}>
            <div className="controls-section">
              <div className="controls-heading">
                <h3>{t('Photo source')}</h3>
              </div>
              <p className="controls-description">
                {file ? file.name : t('Choose a portrait to get started.')}
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
                <h3>{t('Size & Background')}</h3>
              </div>

              {/* Standard Preset Selector */}
              <label className="field">
                {t('Document standard')}
                <select
                  value={selectedPreset.id}
                  disabled={busy}
                  onChange={(e) => {
                    const p = PRESETS.find((x) => x.id === e.target.value) || PRESETS[0];
                    setSelectedPreset(p);
                  }}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.description})
                    </option>
                  ))}
                </select>
              </label>

              {/* Background Color Palette */}
              <div className="field">
                <span className="field-label">{t('Background color')}</span>
                <div className="passport-bg-palette" role="radiogroup" aria-label={t('Background color')}>
                  {BG_OPTIONS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      role="radio"
                      aria-checked={selectedBg.id === bg.id}
                      className={`bg-color-btn ${selectedBg.id === bg.id ? 'active' : ''} ${
                        bg.border ? 'has-border' : ''
                      }`}
                      style={{ backgroundColor: bg.color }}
                      onClick={() => setSelectedBg(bg)}
                      title={bg.name}
                    >
                      {selectedBg.id === bg.id && (
                        <Check size={14} color={bg.id === 'white' || bg.id === 'grey' ? '#000' : '#fff'} />
                      )}
                    </button>
                  ))}
                </div>
                <small className="bg-choice-label">
                  {t('Selected')}: <strong>{selectedBg.name}</strong>
                </small>
              </div>

              {/* Zoom & Alignment Sliders */}
              <div className="passport-adjust-sliders">
                <div className="slider-row">
                  <span>{t('Zoom')}</span>
                  <input
                    type="range"
                    min="0.6"
                    max="2.5"
                    step="0.02"
                    value={zoom}
                    disabled={busy || !imageEl}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                  />
                  <span>{Math.round(zoom * 100)}%</span>
                </div>

                <div className="slider-row">
                  <span>{t('Angle')}</span>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={rotation}
                    disabled={busy || !imageEl}
                    onChange={(e) => setRotation(parseFloat(e.target.value))}
                  />
                  <span>{rotation > 0 ? `+${rotation}` : rotation}°</span>
                </div>
              </div>

              {/* Toggle Face Guide */}
              <label className="field-checkbox">
                <input
                  type="checkbox"
                  checked={showFaceGuide}
                  onChange={(e) => setShowFaceGuide(e.target.checked)}
                />
                <span>
                  <strong>{t('Biometric face guide overlay')}</strong>
                  <small>{t('Helps center eyes and chin per official passport rules.')}</small>
                </span>
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
                <button
                  className="primary full"
                  onClick={() =>
                    activeTab === 'single'
                      ? downloadBlob(singlePhotoBlob!, 'passport-photo-single.jpg')
                      : downloadBlob(printSheetBlob!, 'passport-photos-4x6-sheet.jpg')
                  }
                >
                  <ArrowDownToLine size={18} />
                  {activeTab === 'single' ? t('Download Single Photo') : t('Download 4×6 Sheet')}
                </button>
              ) : (
                <button
                  className="primary full"
                  disabled={!imageEl || busy}
                  onClick={generatePassportPhotos}
                >
                  {busy ? t('Generating photos…') : t('Generate Passport Photos')}
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
