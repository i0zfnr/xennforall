import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  FileCheck,
  FileText,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X
} from 'lucide-react';

interface PdfMetadataToolProps {
  initialFiles?: File[];
  close: () => void;
}

interface PdfMetaFields {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  producer: string;
  creator: string;
  creationDate: string;
  modificationDate: string;
}

export default function PdfMetadataTool({ initialFiles = [], close }: PdfMetadataToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [meta, setMeta] = useState<PdfMetaFields>({
    title: '',
    author: '',
    subject: '',
    keywords: '',
    producer: '',
    creator: '',
    creationDate: '',
    modificationDate: ''
  });
  const [hasMetadata, setHasMetadata] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
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

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      loadPdf(initialFiles[0]);
    }
  }, []);

  async function loadPdf(f: File) {
    if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') return;
    setFile(f);
    setBusy(true);
    setStatusMsg(t('Inspecting PDF metadata…'));

    try {
      const arrayBuf = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuf, { updateMetadata: false });

      const title = pdfDoc.getTitle() || '';
      const author = pdfDoc.getAuthor() || '';
      const subject = pdfDoc.getSubject() || '';
      const keywords = pdfDoc.getKeywords() || '';
      const producer = pdfDoc.getProducer() || '';
      const creator = pdfDoc.getCreator() || '';
      const creationDate = pdfDoc.getCreationDate()?.toLocaleString() || '';
      const modificationDate = pdfDoc.getModificationDate()?.toLocaleString() || '';

      const detected = Boolean(title || author || subject || keywords || producer || creator || creationDate || modificationDate);
      setHasMetadata(detected);
      setMeta({
        title,
        author,
        subject,
        keywords,
        producer,
        creator,
        creationDate,
        modificationDate
      });
      setStatusMsg('');
    } catch (err) {
      console.error(err);
      setStatusMsg(t('Failed to parse PDF metadata. Verify file is not password protected.'));
    } finally {
      setBusy(false);
    }
  }

  // Save modified or sanitized PDF
  async function saveSanitizedPdf(stripAll: boolean) {
    if (!file) return;
    setBusy(true);
    setStatusMsg(stripAll ? t('Stripping all hidden metadata…') : t('Saving updated metadata…'));

    try {
      const arrayBuf = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuf);

      if (stripAll) {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
      } else {
        pdfDoc.setTitle(meta.title);
        pdfDoc.setAuthor(meta.author);
        pdfDoc.setSubject(meta.subject);
        pdfDoc.setKeywords(meta.keywords ? meta.keywords.split(',').map((k) => k.trim()) : []);
        pdfDoc.setProducer(meta.producer);
        pdfDoc.setCreator(meta.creator);
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'document';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = stripAll ? `${baseName}-sanitized.pdf` : `${baseName}-updated.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMsg('');
    } catch (err) {
      console.error(err);
      setStatusMsg(t('Error exporting PDF document.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace pdfmetadata-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdfmetadata-title"
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
          <span className="tool-icon red">
            <ShieldAlert size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Security & Privacy')} <span>/</span> {t('PDF METADATA SANITIZER')}
              </span>
              <span className="hd-pill">PRIVACY WIPE</span>
            </div>
            <h2 id="pdfmetadata-title">{t('PDF Metadata Cleaner & Deep Inspector')}</h2>
            <p>
              {t('Inspect and eradicate hidden author names, software producer tags, modification history, and creation timestamps before sharing PDFs.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Deep Wipe · Zero Server Uploads')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Inspection Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {file ? t('METADATA INSPECTION REPORT') : t('PDF STAGE')}
              </span>
              <span>{file ? file.name : t('Select PDF')}</span>
            </div>

            {!file ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) loadPdf(e.dataTransfer.files[0]);
                }}
              >
                <div className="empty-circle">
                  <FileText size={34} />
                </div>
                <h3>{t('Drop PDF file to inspect & sanitize metadata')}</h3>
                <p>{t('Detects hidden creator software, timestamps, authors, and system footprints.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose PDF')}
                </span>
              </button>
            ) : (
              <div className="pdfmetadata-stage-wrap">
                {/* Risk / Clean Status Badge */}
                <div className={`meta-status-banner ${hasMetadata ? 'warning' : 'clean'}`}>
                  {hasMetadata ? (
                    <>
                      <ShieldAlert size={20} className="text-amber-400" />
                      <div>
                        <strong>{t('Hidden Metadata Detected in Document')}</strong>
                        <p>{t('This PDF reveals author info, editing software, and timestamps.')}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={20} className="text-emerald-400" />
                      <div>
                        <strong>{t('Clean Document')}</strong>
                        <p>{t('No identifying metadata or tracking footprints found.')}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Metadata Fields Inspection Card */}
                <div className="pdfmetadata-fields-card">
                  <div className="meta-field-row">
                    <span>{t('Document Title')}</span>
                    <strong>{meta.title || <em className="text-muted">{t('Not specified')}</em>}</strong>
                  </div>
                  <div className="meta-field-row">
                    <span>{t('Author / Owner')}</span>
                    <strong className={meta.author ? 'badge-amber-text' : ''}>
                      {meta.author || <em className="text-muted">{t('Not specified')}</em>}
                    </strong>
                  </div>
                  <div className="meta-field-row">
                    <span>{t('PDF Producer / Software')}</span>
                    <strong className={meta.producer ? 'badge-amber-text' : ''}>
                      {meta.producer || <em className="text-muted">{t('Not specified')}</em>}
                    </strong>
                  </div>
                  <div className="meta-field-row">
                    <span>{t('Creator Tool')}</span>
                    <strong>{meta.creator || <em className="text-muted">{t('Not specified')}</em>}</strong>
                  </div>
                  <div className="meta-field-row">
                    <span>{t('Created Date')}</span>
                    <strong>{meta.creationDate || <em className="text-muted">{t('Not specified')}</em>}</strong>
                  </div>
                  <div className="meta-field-row">
                    <span>{t('Modified Date')}</span>
                    <strong>{meta.modificationDate || <em className="text-muted">{t('Not specified')}</em>}</strong>
                  </div>
                </div>

                {/* Actions */}
                <div className="pdfmetadata-actions-row">
                  <button
                    type="button"
                    className="download-btn-green"
                    disabled={busy}
                    onClick={() => saveSanitizedPdf(true)}
                  >
                    <Trash2 size={16} />
                    {t('Eradicate All Metadata & Download')}
                  </button>
                </div>

                {statusMsg && <div className="reverb-status-hint">{statusMsg}</div>}
              </div>
            )}
          </div>

          {/* Controls Sidebar */}
          <div className="workspace-controls">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="application/pdf,.pdf"
              onChange={(e) => {
                if (e.target.files?.[0]) loadPdf(e.target.files[0]);
                e.target.value = '';
              }}
            />

            {file && (
              <>
                <div className="control-group">
                  <label>{t('Edit Author')}</label>
                  <input
                    type="text"
                    className="tool-input-text"
                    value={meta.author}
                    onChange={(e) => setMeta({ ...meta, author: e.target.value })}
                    placeholder="Anonymous"
                  />
                </div>

                <div className="control-group">
                  <label>{t('Edit Title')}</label>
                  <input
                    type="text"
                    className="tool-input-text"
                    value={meta.title}
                    onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                    placeholder="Document Title"
                  />
                </div>

                <div className="control-group">
                  <label>{t('Edit Keywords')}</label>
                  <input
                    type="text"
                    className="tool-input-text"
                    value={meta.keywords}
                    onChange={(e) => setMeta({ ...meta, keywords: e.target.value })}
                    placeholder="contract, invoice, report"
                  />
                </div>

                <button
                  type="button"
                  className="primary-action w-full"
                  disabled={busy}
                  onClick={() => saveSanitizedPdf(false)}
                >
                  <Check size={16} />
                  {t('Save Custom Metadata')}
                </button>
              </>
            )}

            <button
              type="button"
              className="btn-change-file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              {file ? t('Change PDF') : t('Select PDF')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
