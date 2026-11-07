import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  FileCheck,
  Files,
  FolderArchive,
  RefreshCw,
  ShieldCheck,
  Type,
  Upload,
  X
} from 'lucide-react';

interface BatchRenamerToolProps {
  initialFiles?: File[];
  close: () => void;
}

type CaseMode = 'none' | 'lower' | 'upper' | 'title' | 'kebab' | 'snake';

export default function BatchRenamerTool({ initialFiles = [], close }: BatchRenamerToolProps) {
  const [files, setFiles] = useState<File[]>(initialFiles);

  // Pattern settings
  const [prefix, setPrefix] = useState<string>('');
  const [suffix, setSuffix] = useState<string>('');
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [caseMode, setCaseMode] = useState<CaseMode>('none');
  const [includeIndex, setIncludeIndex] = useState<boolean>(true);
  const [indexPadding, setIndexPadding] = useState<number>(3); // e.g. 001
  const [startIndex, setStartIndex] = useState<number>(1);
  const [includeDate, setIncludeDate] = useState<boolean>(false);

  // Export
  const [busy, setBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');

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

  function handleAddFiles(incoming: FileList | null) {
    if (!incoming) return;
    const list = Array.from(incoming);
    if (list.length === 0) return;
    setFiles((prev) => [...prev, ...list]);
  }

  // Calculate renamed filename for a given file
  function computeNewName(file: File, index: number): string {
    const dotIdx = file.name.lastIndexOf('.');
    let base = dotIdx !== -1 ? file.name.substring(0, dotIdx) : file.name;
    const ext = dotIdx !== -1 ? file.name.substring(dotIdx) : '';

    // 1. Find & Replace
    if (findText) {
      base = base.replaceAll(findText, replaceText);
    }

    // 2. Case transformation
    if (caseMode === 'lower') {
      base = base.toLowerCase();
    } else if (caseMode === 'upper') {
      base = base.toUpperCase();
    } else if (caseMode === 'kebab') {
      base = base.toLowerCase().replace(/[\s_]+/g, '-');
    } else if (caseMode === 'snake') {
      base = base.toLowerCase().replace(/[\s-]+/g, '_');
    } else if (caseMode === 'title') {
      base = base.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    }

    // 3. Date stamp
    let dateStr = '';
    if (includeDate) {
      const d = new Date();
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateStr = `${yr}${mo}${day}_`;
    }

    // 4. Index padding
    let indexStr = '';
    if (includeIndex) {
      indexStr = `_${String(startIndex + index).padStart(indexPadding, '0')}`;
    }

    return `${prefix}${dateStr}${base}${suffix}${indexStr}${ext}`;
  }

  // Export all as renamed ZIP
  async function downloadRenamedZip() {
    if (files.length === 0) return;
    setBusy(true);
    setStatusMsg(t('Packaging renamed files into ZIP…'));
    setProgress(0);

    try {
      const zip = new JSZip();

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const newName = computeNewName(f, i);
        zip.file(newName, f);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `renamed-files-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMsg('');
    } catch (err) {
      console.error(err);
      setStatusMsg(t('Failed to create ZIP package.'));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace batchrenamer-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batchrenamer-title"
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
            {t('Private & Client-Side · 100% In-Browser')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon teal">
            <FolderArchive size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('File utilities')} <span>/</span> {t('BATCH FILE RENAMER')}
              </span>
              <span className="hd-pill">ZIP ARCHIVE</span>
            </div>
            <h2 id="batchrenamer-title">{t('Batch File Renamer & Pattern Stamper')}</h2>
            <p>
              {t('Rename dozens of files at once using smart prefixes, find and replace, date stamps, and index counters. Download all as a ZIP archive.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Pattern Stamping · Instant ZIP')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Table Preview */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {files.length > 0 ? `${t('RENAME PREVIEW')} (${files.length} ${t('files')})` : t('FILE LIST')}
              </span>
              <span>{files.length > 0 ? t('Before & After Comparison') : t('Select files')}</span>
            </div>

            {files.length === 0 ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleAddFiles(e.dataTransfer.files);
                }}
              >
                <div className="empty-circle">
                  <Files size={34} />
                </div>
                <h3>{t('Drop files to batch rename')}</h3>
                <p>{t('Supports photos, documents, PDFs, and videos. Files never leave your local device memory.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Files')}
                </span>
              </button>
            ) : (
              <div className="batchrenamer-stage-wrap">
                {/* Table Comparison View */}
                <div className="batchrenamer-table-card">
                  <div className="table-header-row">
                    <span className="col-original">{t('Original Name')}</span>
                    <span className="col-arrow">➔</span>
                    <span className="col-new">{t('New Renamed Output')}</span>
                  </div>

                  <div className="table-rows-scroll">
                    {files.map((file, idx) => (
                      <div key={idx} className="table-item-row">
                        <span className="col-original truncate">{file.name}</span>
                        <span className="col-arrow">➔</span>
                        <span className="col-new truncate badge-green-text">
                          {computeNewName(file, idx)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="batchrenamer-actions-row">
                  <button
                    type="button"
                    className="download-btn-green"
                    disabled={busy || files.length === 0}
                    onClick={downloadRenamedZip}
                  >
                    <ArrowDownToLine size={16} />
                    {t('Download Renamed ZIP')} ({files.length} {t('files')})
                  </button>

                  <button
                    type="button"
                    className="btn-change-file"
                    style={{ width: 'auto', marginTop: 0 }}
                    onClick={() => setFiles([])}
                  >
                    {t('Clear List')}
                  </button>
                </div>

                {busy && (
                  <div className="watermark-status-box">
                    <span>{statusMsg}</span>
                    {progress > 0 && <small>{progress}%</small>}
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
              multiple
              onChange={(e) => {
                handleAddFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <label>{t('Prefix (Start of name)')}</label>
              <input
                type="text"
                className="tool-input-text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. Vacation_"
              />
            </div>

            <div className="control-group">
              <label>{t('Suffix (End of name)')}</label>
              <input
                type="text"
                className="tool-input-text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="e.g. _final"
              />
            </div>

            <div className="control-group">
              <label>{t('Find & Replace')}</label>
              <div className="find-replace-grid">
                <input
                  type="text"
                  className="tool-input-text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="Find..."
                />
                <input
                  type="text"
                  className="tool-input-text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Replace with..."
                />
              </div>
            </div>

            <div className="control-group">
              <label>{t('Case Formatting')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={caseMode === 'none' ? 'active' : ''}
                  onClick={() => setCaseMode('none')}
                >
                  As Is
                </button>
                <button
                  type="button"
                  className={caseMode === 'lower' ? 'active' : ''}
                  onClick={() => setCaseMode('lower')}
                >
                  lower
                </button>
                <button
                  type="button"
                  className={caseMode === 'kebab' ? 'active' : ''}
                  onClick={() => setCaseMode('kebab')}
                >
                  kebab-case
                </button>
                <button
                  type="button"
                  className={caseMode === 'snake' ? 'active' : ''}
                  onClick={() => setCaseMode('snake')}
                >
                  snake_case
                </button>
              </div>
            </div>

            <div className="control-group toggle-row-card">
              <div className="toggle-info">
                <span>{t('Add Sequential Numbering (_001)')}</span>
              </div>
              <input
                type="checkbox"
                checked={includeIndex}
                onChange={(e) => setIncludeIndex(e.target.checked)}
                className="custom-toggle-input"
              />
            </div>

            <div className="control-group toggle-row-card">
              <div className="toggle-info">
                <span>{t('Add Date Stamp (YYYYMMDD_)')}</span>
              </div>
              <input
                type="checkbox"
                checked={includeDate}
                onChange={(e) => setIncludeDate(e.target.checked)}
                className="custom-toggle-input"
              />
            </div>

            <button
              type="button"
              className="btn-change-file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              + {t('Add More Files')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
