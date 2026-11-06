import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Download,
  Image as ImageIcon,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap
} from 'lucide-react';

interface ModernConvertToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function ModernConvertTool({ initialFiles = [], close }: ModernConvertToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imgDim, setImgDim] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Settings
  const [targetFormat, setTargetFormat] = useState<'image/webp' | 'image/avif' | 'image/jpeg'>('image/webp');
  const [quality, setQuality] = useState<number>(82);

  // Result
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [convertedUrl, setConvertedUrl] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

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

  // Cleanup URLs
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (convertedUrl) URL.revokeObjectURL(convertedUrl);
    };
  }, [imageUrl, convertedUrl]);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    const valid = f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|heic|tiff)$/i.test(f.name);
    if (!valid) {
      setErrorMessage(t('Please select a valid image file.'));
      return;
    }

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    if (convertedUrl) URL.revokeObjectURL(convertedUrl);

    const url = URL.createObjectURL(f);
    setFile(f);
    setImageUrl(url);
    setConvertedBlob(null);
    setConvertedUrl('');

    const img = new Image();
    img.onload = () => {
      setImgDim({ width: img.naturalWidth, height: img.naturalHeight });
      loadedImageRef.current = img;
      convertImage(img, targetFormat, quality);
    };
    img.src = url;
  }

  async function convertImage(img: HTMLImageElement, format: string, q: number) {
    setBusy(true);
    setErrorMessage('');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('Canvas processing failed.'));

      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), format, q / 100);
      });

      if (convertedUrl) URL.revokeObjectURL(convertedUrl);
      const url = URL.createObjectURL(blob);
      setConvertedBlob(blob);
      setConvertedUrl(url);
    } catch (err: any) {
      setErrorMessage(err.message || t('Conversion failed.'));
    } finally {
      setBusy(false);
    }
  }

  // Trigger conversion when settings change
  useEffect(() => {
    if (loadedImageRef.current && file) {
      convertImage(loadedImageRef.current, targetFormat, quality);
    }
  }, [targetFormat, quality]);

  const origSize = file?.size || 0;
  const newSize = convertedBlob?.size || 0;
  const savedPercent = origSize > 0 && newSize > 0 ? Math.round(((origSize - newSize) / origSize) * 100) : 0;

  function downloadConverted() {
    if (!convertedBlob || !file) return;
    const ext = targetFormat === 'image/webp' ? 'webp' : targetFormat === 'image/avif' ? 'avif' : 'jpg';
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = convertedUrl;
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace modernconvert-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modernconvert-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('Private & Client-Side · Next-Gen Web Compression')}
          </span>
          <button className="workspace-close" onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon teal">
            <Zap size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('NEXT-GEN WEBP & AVIF OPTIMIZER')}
              </span>
              <span className="hd-pill">WEBP & AVIF</span>
            </div>
            <h2 id="modernconvert-title">{t('Modern WebP & AVIF Optimizer')}</h2>
            <p>
              {t('Convert photos to next-generation WebP and AVIF formats for lightning-fast websites with up to 75% smaller files.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Ultra Fast · Alpha Preserved')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {convertedBlob ? `${t('OPTIMIZED')} (${targetFormat.replace('image/', '').toUpperCase()})` : t('IMAGE WORKBENCH')}
              </span>
              <span>{file ? file.name : t('Select image')}</span>
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
                  <Zap size={34} />
                </div>
                <h3>{t('Drop image to convert to WebP or AVIF')}</h3>
                <p>{t('Supports JPG, PNG, and HEIC. Dramatically shrinks file sizes while preserving crisp details.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select image')}
                </span>
              </button>
            ) : (
              <div className="modernconvert-stage-wrap">
                <div className="modernconvert-preview-box">
                  <img src={convertedUrl || imageUrl} alt="Converted preview" className="modernconvert-img" />
                </div>

                {convertedBlob && (
                  <div className="modernconvert-stats-bar">
                    <div className="savings-pill-badge">
                      <Sparkles size={16} />
                      <span>{savedPercent > 0 ? `${savedPercent}% ${t('smaller')}` : t('Optimized')}</span>
                    </div>
                    <span>
                      {(origSize / 1024).toFixed(1)} KB ➔ <strong>{(newSize / 1024).toFixed(1)} KB</strong>
                    </span>
                    <button className="download-btn-green" onClick={downloadConverted}>
                      <Download size={16} />
                      {t('Download WebP / AVIF')}
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
              accept="image/*,.jpg,.jpeg,.png,.webp,.avif,.heic"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <label>{t('Output Next-Gen Format')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={targetFormat === 'image/webp' ? 'active' : ''}
                  onClick={() => setTargetFormat('image/webp')}
                >
                  WebP (Universal)
                </button>
                <button
                  type="button"
                  className={targetFormat === 'image/avif' ? 'active' : ''}
                  onClick={() => setTargetFormat('image/avif')}
                >
                  AVIF (Next-Gen)
                </button>
                <button
                  type="button"
                  className={targetFormat === 'image/jpeg' ? 'active' : ''}
                  onClick={() => setTargetFormat('image/jpeg')}
                >
                  JPEG (Classic)
                </button>
              </div>
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Quality Level')}</span>
                <strong>{quality}%</strong>
              </div>
              <input
                type="range"
                min="20"
                max="98"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
              <div className="preset-speed-chips">
                {[65, 75, 82, 90].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={quality === q ? 'active' : ''}
                    onClick={() => setQuality(q)}
                  >
                    {q}%
                  </button>
                ))}
              </div>
            </div>

            {file && (
              <div className="control-group">
                <div className="spec-card">
                  <div className="spec-row">
                    <span>{t('Dimensions')}</span>
                    <strong>{imgDim.width > 0 ? `${imgDim.width} × ${imgDim.height} px` : '-'}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('Original Size')}</span>
                    <strong>{(origSize / 1024).toFixed(1)} KB</strong>
                  </div>
                  {newSize > 0 && (
                    <div className="spec-row">
                      <span>{t('New Size')}</span>
                      <strong className="badge-green">{(newSize / 1024).toFixed(1)} KB</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {file && (
              <button
                className="btn-change-file"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Change photo')}
              </button>
            )}

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
