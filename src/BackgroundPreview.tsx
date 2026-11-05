import { t } from "./i18n";
import { useEffect, useState } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';

export function useBlobUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

const imageLabels: Record<string, { working: string; done: string }> = {
  background: { working: 'Finding your subject…', done: 'Background removed' },
  compress: { working: 'Optimizing your image…', done: 'Compressed JPG' },
  convert: { working: 'Converting your image…', done: 'Converted image' },
  resize: { working: 'Resizing your image…', done: 'Resized image' }
};

export function BackgroundPreview({ file, result, busy, mode = 'background' }: { file: File; result?: Blob; busy: boolean; mode?: string }) {
  const labels = imageLabels[mode] || { working: 'Processing image…', done: 'Processed image' };
  const [originalSize, setOriginalSize] = useState('');
  const [outputSize, setOutputSize] = useState('');
  const originalUrl = useBlobUrl(file);
  const resultUrl = useBlobUrl(result);
  const [split, setSplit] = useState(100);
  const [ready, setReady] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    setReady(false);
    setSplit(100);
    setRevealing(false);
  }, [result]);

  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      setRevealing(true);
      setSplit(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  return (
    <section className="background-preview" aria-label={t(`${labels.done} preview`)} aria-busy={busy}>
      <div className="preview-heading">
        <span>
          <SlidersHorizontal size={14} />{' '}
          {busy ? t("Processing on your device…") : ready ? t(labels.done) : t("Original image preview")}
        </span>
        {ready && <Check size={16} />}
      </div>
      <div className={`preview-stage ${busy ? 'is-processing' : ''} ${ready ? 'is-complete' : ''} ${revealing ? 'is-revealing' : ''}`}>
        {originalUrl && (
          <img
            className="preview-original"
            src={originalUrl}
            alt={t("Original image")}
            onLoad={(event) => setOriginalSize(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)}
          />
        )}
        {resultUrl && (
          <img
            className="preview-cutout"
            src={resultUrl}
            alt={t(labels.done)}
            onLoad={(event) => {
              setOutputSize(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`);
              setReady(true);
            }}
          />
        )}
        {ready && (
          <div className="preview-before" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
            <img src={originalUrl} alt="" />
          </div>
        )}
        {busy && (
          <>
            <div className="preview-scan" aria-hidden="true" />
            <div className="preview-processing">
              <span className="spinner" /> {t(labels.working)}
            </div>
          </>
        )}
        {ready && split > 0 && split < 100 && (
          <div className="preview-divider" style={{ left: `${split}%` }} aria-hidden="true">
            <span>↔</span>
          </div>
        )}
        <div className="preview-label">
          {busy ? t("Processing on your device") : ready ? (mode === 'background' ? t("Transparent background") : t(labels.done)) : t("Original image")}
        </div>
      </div>
      {ready ? (
        <label className="preview-comparison">
          <span>
            <b>{t("Original")}</b>
            <span>{t("Drag to compare")}</span>
            <b>{t(labels.done)}</b>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={split}
            aria-label={t(`Compare original with ${labels.done.toLowerCase()}`)}
            onChange={(event) => {
              setRevealing(false);
              setSplit(Number(event.target.value));
            }}
          />
        </label>
      ) : (
        <p className="preview-caption">
          {t(busy ? 'Working on your device. Your finished image will appear here.' : 'Your original image. Choose your settings, then start below.')}
        </p>
      )}
      <div className="image-preview-details">
        <span>
          <b>{t("Original")}</b>
          {originalSize && <span>{originalSize} px</span>}
          <span>{(file.size / 1024).toFixed(1)} KB</span>
        </span>
        {ready && result && (
          <span>
            <b>{t(labels.done)}</b>
            <span>{outputSize} px</span>
            <span>
              {(result.size / 1024).toFixed(1)} KB
              {mode === 'compress' &&
                (result.size < file.size
                  ? ` · ${Math.round((1 - result.size / file.size) * 100)}% smaller`
                  : t(" · no size reduction"))}
            </span>
          </span>
        )}
      </div>
    </section>
  );
}
