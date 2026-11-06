import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Archive,
  ArrowDownToLine,
  ArrowRight,
  Check,
  Columns,
  Download,
  Grid,
  Image as ImageIcon,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react';

interface GridSplitToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function GridSplitTool({ initialFiles = [], close }: GridSplitToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imgDim, setImgDim] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Settings
  const [mode, setMode] = useState<'carousel' | 'profile_grid'>('carousel');
  const [sliceCount, setSliceCount] = useState<number>(3); // 2, 3, 4, 5, 6
  const [aspect, setAspect] = useState<'square' | 'portrait'>('portrait'); // square (1:1), portrait (4:5)

  // Slices Preview & Results
  const [slicedImages, setSlicedImages] = useState<{ id: number; url: string; blob: Blob }[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
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
      slicedImages.forEach((s) => URL.revokeObjectURL(s.url));
    };
  }, [imageUrl, slicedImages]);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    const valid = f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name);
    if (!valid) {
      setErrorMessage(t('Please select a valid image file (JPG, PNG, WebP).'));
      return;
    }

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    slicedImages.forEach((s) => URL.revokeObjectURL(s.url));
    setSlicedImages([]);

    const url = URL.createObjectURL(f);
    setFile(f);
    setImageUrl(url);

    const img = new Image();
    img.onload = () => {
      setImgDim({ width: img.naturalWidth, height: img.naturalHeight });
      loadedImageRef.current = img;
    };
    img.src = url;
  }

  // Slice image pipeline
  async function generateSlices() {
    if (!loadedImageRef.current || !file) return;
    setBusy(true);
    setStatusMsg(t('Slicing image tiles…'));
    setErrorMessage('');

    try {
      const img = loadedImageRef.current;
      const results: { id: number; url: string; blob: Blob }[] = [];

      if (mode === 'carousel') {
        // Carousel: Divide width evenly into sliceCount parts
        const sliceWidth = img.naturalWidth / sliceCount;
        const sliceHeight = img.naturalHeight;

        for (let i = 0; i < sliceCount; i++) {
          const canvas = document.createElement('canvas');
          const targetW = 1080;
          const targetH = aspect === 'portrait' ? 1350 : 1080;
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error(t('Canvas processing failed.'));

          // Draw slice cropped & centered to aspect
          const sx = i * sliceWidth;
          ctx.drawImage(img, sx, 0, sliceWidth, sliceHeight, 0, 0, targetW, targetH);

          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.94);
          });
          const url = URL.createObjectURL(blob);
          results.push({ id: i + 1, url, blob });
        }
      } else {
        // 3x3 Profile Grid
        const cols = 3;
        const rows = 3;
        const cellW = img.naturalWidth / cols;
        const cellH = img.naturalHeight / rows;

        let index = 1;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error(t('Canvas processing failed.'));

            const sx = c * cellW;
            const sy = r * cellH;
            ctx.drawImage(img, sx, sy, cellW, cellH, 0, 0, 1080, 1080);

            const blob = await new Promise<Blob>((resolve) => {
              canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.94);
            });
            const url = URL.createObjectURL(blob);
            results.push({ id: index++, url, blob });
          }
        }
      }

      setSlicedImages(results);
      setStatusMsg('');
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to slice image.'));
    } finally {
      setBusy(false);
    }
  }

  // Trigger slice automatically on parameter change when image is loaded
  useEffect(() => {
    if (loadedImageRef.current && file) {
      generateSlices();
    }
  }, [file, mode, sliceCount, aspect]);

  // Download all slices as ZIP
  async function downloadZip() {
    if (slicedImages.length === 0 || !file) return;
    setBusy(true);
    setStatusMsg(t('Packaging ZIP archive…'));

    try {
      const zip = new JSZip();
      const prefix = mode === 'carousel' ? 'carousel-slide' : 'profile-tile';

      slicedImages.forEach((slice) => {
        const num = slice.id.toString().padStart(2, '0');
        zip.file(`${prefix}-${num}.jpg`, slice.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `instagram-${mode}-pack.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setErrorMessage(t('Failed to create ZIP package.'));
    } finally {
      setBusy(false);
      setStatusMsg('');
    }
  }

  function downloadSingleSlice(slice: { id: number; url: string }) {
    const a = document.createElement('a');
    a.href = slice.url;
    a.download = `slide-${slice.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace gridsplit-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gridsplit-title"
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
            {t('Private & Client-Side · Seamless Swipe Export')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon violet">
            <Columns size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('CAROUSEL & PANORAMA SPLITTER')}
              </span>
              <span className="hd-pill">SEAMLESS SWIPE</span>
            </div>
            <h2 id="gridsplit-title">{t('Instagram Carousel & Panorama Splitter')}</h2>
            <p>
              {t('Slice wide photos and panoramas into seamless swipeable carousel slides or 3x3 profile grids.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('ZIP Pack · Numbered Order')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Slices Display */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {slicedImages.length > 0
                  ? `${t('PREVIEW')} (${slicedImages.length} ${t('SLIDES')})`
                  : t('SELECT PANORAMA PHOTO')}
              </span>
              <span>{file ? file.name : t('No image loaded')}</span>
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
                  <Columns size={34} />
                </div>
                <h3>{t('Drop wide or panoramic photo here')}</h3>
                <p>{t('Automatically cuts seamless slides for Instagram carousels and 3x3 grids.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select photo')}
                </span>
              </button>
            ) : (
              <div className="gridsplit-stage-wrap">
                <div className={`slices-preview-container ${mode}`}>
                  {slicedImages.map((slice) => (
                    <div key={slice.id} className="slice-card-item">
                      <img src={slice.url} alt={`Slide ${slice.id}`} className="slice-img" />
                      <div className="slice-badge">#{slice.id}</div>
                      <button
                        className="slice-dl-icon"
                        onClick={() => downloadSingleSlice(slice)}
                        aria-label={`Download slide ${slice.id}`}
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {slicedImages.length > 0 && (
                  <div className="gridsplit-action-bar">
                    <button className="download-btn-green" onClick={downloadZip} disabled={busy}>
                      <Archive size={18} />
                      {busy ? statusMsg : t('Download All Slides (.ZIP)')}
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
              accept="image/*,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <label>{t('Split Layout')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={mode === 'carousel' ? 'active' : ''}
                  onClick={() => setMode('carousel')}
                >
                  <Columns size={15} />
                  {t('Carousel Swipe')}
                </button>
                <button
                  type="button"
                  className={mode === 'profile_grid' ? 'active' : ''}
                  onClick={() => setMode('profile_grid')}
                >
                  <Grid size={15} />
                  {t('3x3 Profile Grid')}
                </button>
              </div>
            </div>

            {mode === 'carousel' ? (
              <>
                <div className="control-group">
                  <label>{t('Number of Slides')}</label>
                  <div className="btn-toggle-group">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={sliceCount === num ? 'active' : ''}
                        onClick={() => setSliceCount(num)}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-group">
                  <label>{t('Slide Aspect Ratio')}</label>
                  <div className="btn-toggle-group">
                    <button
                      type="button"
                      className={aspect === 'portrait' ? 'active' : ''}
                      onClick={() => setAspect('portrait')}
                    >
                      4:5 Portrait (1080×1350)
                    </button>
                    <button
                      type="button"
                      className={aspect === 'square' ? 'active' : ''}
                      onClick={() => setAspect('square')}
                    >
                      1:1 Square (1080×1080)
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="control-group">
                <div className="spec-card">
                  <div className="spec-row">
                    <span>{t('Grid Layout')}</span>
                    <strong>3 columns × 3 rows</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('Total Tiles')}</span>
                    <strong>9 square photos</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('Upload Order')}</span>
                    <strong>Numbered #1 to #9</strong>
                  </div>
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
