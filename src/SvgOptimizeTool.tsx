import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Code,
  Copy,
  Download,
  Eye,
  FileCode,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react';

interface SvgOptimizeToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function SvgOptimizeTool({ initialFiles = [], close }: SvgOptimizeToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [rawSvg, setRawSvg] = useState<string>('');
  const [cleanSvg, setCleanSvg] = useState<string>('');
  const [roundDecimals, setRoundDecimals] = useState<boolean>(true);
  const [stripMetadata, setStripMetadata] = useState<boolean>(true);
  const [stripComments, setStripComments] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  async function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    if (!f.name.toLowerCase().endsWith('.svg') && f.type !== 'image/svg+xml') {
      setErrorMessage(t('Please select a valid SVG vector file.'));
      return;
    }
    setFile(f);
    const text = await f.text();
    setRawSvg(text);
  }

  // Pure in-browser SVG Optimization Pipeline
  function optimizeSvgContent(input: string): string {
    let s = input;

    // 1. Remove XML declaration and doctype
    s = s.replace(/<\?xml[\s\S]*?\?>/gi, '');
    s = s.replace(/<!DOCTYPE[\s\S]*?>/gi, '');

    // 2. Remove comments
    if (stripComments) {
      s = s.replace(/<!--[\s\S]*?-->/g, '');
    }

    // 3. Remove metadata, i:pgf, and editor tags
    if (stripMetadata) {
      s = s.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
      s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
      // Strip editor namespaces and attributes
      s = s.replace(/\s(xmlns:sketch|xmlns:inkscape|xmlns:sodipodi|xmlns:adobe|sketch:type|data-name|inkscape:[a-z-]+|sodipodi:[a-z-]+)="[^"]*"/gi, '');
    }

    // 4. Round decimal precision in coordinate strings
    if (roundDecimals) {
      // Matches floating point numbers like 12.384729 and rounds to 2 decimals
      s = s.replace(/([0-9]+\.[0-9]{3,})/g, (match) => {
        const num = parseFloat(match);
        return Number(num.toFixed(2)).toString();
      });
    }

    // 5. Remove empty groups and redundant whitespace
    s = s.replace(/<g\s*>\s*<\/g>/gi, '');
    s = s.replace(/\s{2,}/g, ' ');
    s = s.replace(/>\s+</g, '><');

    return s.trim();
  }

  useEffect(() => {
    if (rawSvg) {
      const optimized = optimizeSvgContent(rawSvg);
      setCleanSvg(optimized);
    } else {
      setCleanSvg('');
    }
  }, [rawSvg, roundDecimals, stripMetadata, stripComments]);

  const origBytes = new Blob([rawSvg]).size;
  const cleanBytes = new Blob([cleanSvg]).size;
  const savedPercent = origBytes > 0 ? Math.max(0, Math.round(((origBytes - cleanBytes) / origBytes) * 100)) : 0;

  function copyCode() {
    if (!cleanSvg) return;
    navigator.clipboard.writeText(cleanSvg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadSvg() {
    if (!cleanSvg) return;
    const blob = new Blob([cleanSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace(/\.svg$/i, '-optimized.svg') : 'optimized.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace svgoptimize-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="svgoptimize-title"
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
            {t('Private & Client-Side · In-Browser SVG Minifier')}
          </span>
          <button className="workspace-close" onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon orange">
            <Code size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Design tools')} <span>/</span> {t('SVG CLEANER & MINIFIER')}
              </span>
              <span className="hd-pill">CODE MINIFIER</span>
            </div>
            <h2 id="svgoptimize-title">{t('SVG Vector Cleaner & Code Minifier')}</h2>
            <p>
              {t('Strip editor bloat, metadata, and excess decimal precision from Figma, Canva, and Illustrator SVGs.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Zero Bloat · Instant Copy')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {cleanSvg ? `${t('VECTOR PREVIEW')} (${savedPercent}% ${t('smaller')})` : t('SVG WORKBENCH')}
              </span>
              <span>{file ? file.name : t('Select or paste SVG')}</span>
            </div>

            {!rawSvg ? (
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
                  <Code size={34} />
                </div>
                <h3>{t('Drop SVG file here to clean & minify')}</h3>
                <p>{t('Removes Illustrator comments, rounded path decimals, and trims file size by up to 60%.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select SVG')}
                </span>
              </button>
            ) : (
              <div className="svgoptimize-stage-wrap">
                <div className="svg-preview-box">
                  <div
                    className="rendered-svg-wrap"
                    dangerouslySetInnerHTML={{ __html: cleanSvg }}
                  />
                </div>

                <div className="svg-code-box">
                  <pre className="svg-code-pre">{cleanSvg.slice(0, 500)}…</pre>
                </div>

                <div className="svg-action-row">
                  <button className="primary-action" onClick={copyCode}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? t('Copied Clean SVG Code!') : t('Copy SVG Code')}
                  </button>
                  <button className="download-btn-green" onClick={downloadSvg}>
                    <Download size={16} />
                    {t('Download Clean SVG')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls Sidebar */}
          <div className="workspace-controls">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".svg,image/svg+xml"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <label>{t('Optimization Rules')}</label>

              <div className="filter-card-option" style={{ marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  id="strip-meta-toggle"
                  checked={stripMetadata}
                  onChange={(e) => setStripMetadata(e.target.checked)}
                />
                <label htmlFor="strip-meta-toggle">
                  <strong>{t('Strip Editor Metadata')}</strong>
                  <p>{t('Removes Illustrator, Figma, and Inkscape namespaced tags.')}</p>
                </label>
              </div>

              <div className="filter-card-option" style={{ marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  id="round-dec-toggle"
                  checked={roundDecimals}
                  onChange={(e) => setRoundDecimals(e.target.checked)}
                />
                <label htmlFor="round-dec-toggle">
                  <strong>{t('Round Path Precision (2 Decimals)')}</strong>
                  <p>{t('Rounds coordinates to save significant path length without visual loss.')}</p>
                </label>
              </div>

              <div className="filter-card-option">
                <input
                  type="checkbox"
                  id="strip-comments-toggle"
                  checked={stripComments}
                  onChange={(e) => setStripComments(e.target.checked)}
                />
                <label htmlFor="strip-comments-toggle">
                  <strong>{t('Remove Comments & Prologs')}</strong>
                  <p>{t('Strips XML declarations, doctypes, and generator comments.')}</p>
                </label>
              </div>
            </div>

            {rawSvg && (
              <div className="control-group">
                <label>{t('Compression Impact')}</label>
                <div className="spec-card">
                  <div className="spec-row">
                    <span>{t('Original Size')}</span>
                    <strong>{(origBytes / 1024).toFixed(1)} KB</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('Minified Size')}</span>
                    <strong className="badge-green">{(cleanBytes / 1024).toFixed(1)} KB</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('Bytes Saved')}</span>
                    <strong className="badge-green">{savedPercent}% {t('smaller')}</strong>
                  </div>
                </div>
              </div>
            )}

            {rawSvg && (
              <button
                className="btn-change-file"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Change SVG')}
              </button>
            )}

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
