import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Copy,
  Download,
  FileCheck,
  FileText,
  Image as ImageIcon,
  RotateCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react';

interface OcrReaderToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function OcrReaderTool({ initialFiles = [], close }: OcrReaderToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Processing state
  const [busy, setBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');
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

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    const valid = f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|tiff|bmp)$/i.test(f.name);
    if (!valid) {
      setErrorMessage(t('Please select a valid document or receipt image file.'));
      return;
    }

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(f);
    setFile(f);
    setImageUrl(url);
    setExtractedText('');
    setConfidence(0);
    runOcr(f);
  }

  // Tesseract OCR Execution in Browser Memory
  async function runOcr(imgFile: File) {
    setBusy(true);
    setProgress(5);
    setStatusMsg(t('Initializing in-browser OCR engine…'));
    setErrorMessage('');

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const p = Math.round((m.progress || 0) * 100);
            setProgress(p);
            setStatusMsg(`${t('Extracting text')} (${p}%)…`);
          } else if (m.status === 'loading tesseract core') {
            setStatusMsg(t('Loading OCR WebAssembly core…'));
          }
        }
      });

      const ret = await worker.recognize(imgFile);
      setExtractedText(ret.data.text.trim());
      setConfidence(Math.round(ret.data.confidence));
      await worker.terminate();

      setStatusMsg('');
    } catch {
      setErrorMessage(t('OCR processing failed. Please verify the image contains readable text.'));
    } finally {
      setBusy(false);
    }
  }

  function copyText() {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadTxt() {
    if (!extractedText || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}-extracted.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const wordCount = extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0;
  const charCount = extractedText.length;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace ocr-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ocr-title"
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
            {t('Private & Client-Side · In-Browser WebAssembly OCR')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon blue">
            <FileText size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Document tools')} <span>/</span> {t('OCR TEXT EXTRACTOR')}
              </span>
              <span className="hd-pill">RECEIPT & SCAN OCR</span>
            </div>
            <h2 id="ocr-title">{t('OCR Photo & Document Text Extractor')}</h2>
            <p>
              {t('Extract editable text, receipts, phone numbers, and figures from photos with zero cloud server uploads.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% In-Browser · Confidential')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {extractedText
                  ? `${t('EXTRACTED TEXT')} (${wordCount} ${t('words')})`
                  : busy
                  ? statusMsg
                  : t('DOCUMENT IMAGE')}
              </span>
              <span>{file ? file.name : t('Select document photo')}</span>
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
                  <FileText size={34} />
                </div>
                <h3>{t('Drop document or receipt photo here')}</h3>
                <p>{t('Supports receipts, contracts, invoices, and book pages. In-browser neural OCR.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select photo')}
                </span>
              </button>
            ) : busy ? (
              <div className="ocr-progress-box">
                <RotateCw size={36} className="spin text-primary" />
                <h3>{statusMsg}</h3>
                <div className="progress-bar-wrap">
                  <div className="progress-bar-inner" style={{ width: `${progress}%` }} />
                </div>
                <small>{progress}% completed</small>
              </div>
            ) : (
              <div className="ocr-stage-wrap">
                <div className="ocr-split-view">
                  {/* Original Image Snippet */}
                  <div className="ocr-image-preview-panel">
                    <img src={imageUrl} alt="Document" className="ocr-source-img" />
                  </div>

                  {/* Extracted Text Area */}
                  <div className="ocr-text-result-panel">
                    <textarea
                      value={extractedText}
                      onChange={(e) => setExtractedText(e.target.value)}
                      placeholder={t('No text detected in this image.')}
                      className="ocr-result-textarea"
                    />
                  </div>
                </div>

                {extractedText && (
                  <div className="ocr-action-bar">
                    <button className="primary-action" onClick={copyText}>
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? t('Copied to Clipboard!') : t('Copy Text')}
                    </button>
                    <button className="download-btn-green" onClick={downloadTxt}>
                      <Download size={16} />
                      {t('Download as .TXT')}
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
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.tiff"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {extractedText && (
              <div className="control-group">
                <label>{t('Text Statistics')}</label>
                <div className="spec-card">
                  <div className="spec-row">
                    <span>{t('Words Extracted')}</span>
                    <strong>{wordCount} {t('words')}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('Characters')}</span>
                    <strong>{charCount}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('Accuracy Confidence')}</span>
                    <strong className="badge-green">{confidence}%</strong>
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
