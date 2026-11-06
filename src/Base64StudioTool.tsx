import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  Binary,
  Check,
  Code,
  Copy,
  Download,
  Image as ImageIcon,
  ShieldCheck,
  Upload,
  X
} from 'lucide-react';

interface Base64StudioToolProps {
  initialFiles?: File[];
  close: () => void;
}

type StudioTab = 'encode' | 'decode';
type ExportFormat = 'data-uri' | 'raw-base64' | 'html-img' | 'css-bg' | 'markdown';

export default function Base64StudioTool({ initialFiles = [], close }: Base64StudioToolProps) {
  const [tab, setTab] = useState<StudioTab>('encode');

  // Encoder state
  const [sourceFile, setSourceFile] = useState<File | null>(initialFiles[0] || null);
  const [dataUri, setDataUri] = useState<string>('');
  const [rawBase64, setRawBase64] = useState<string>('');
  const [fileMime, setFileMime] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [activeFormat, setActiveFormat] = useState<ExportFormat>('data-uri');
  const [copied, setCopied] = useState<boolean>(false);

  // Decoder state
  const [inputText, setInputText] = useState<string>('');
  const [decodedUrl, setDecodedUrl] = useState<string>('');
  const [decodedMime, setDecodedMime] = useState<string>('application/octet-stream');
  const [decodedSize, setDecodedSize] = useState<number>(0);
  const [decodeError, setDecodeError] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal accessibility
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

  // Cleanup decoded URL
  useEffect(() => {
    return () => {
      if (decodedUrl) URL.revokeObjectURL(decodedUrl);
    };
  }, [decodedUrl]);

  // Initial file encode
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      encodeFile(initialFiles[0]);
    }
  }, []);

  function encodeFile(file: File) {
    setSourceFile(file);
    setFileSize(file.size);
    const mime = file.type || 'application/octet-stream';
    setFileMime(mime);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setDataUri(result);
      const commaIdx = result.indexOf(',');
      if (commaIdx !== -1) {
        setRawBase64(result.substring(commaIdx + 1));
      } else {
        setRawBase64(result);
      }
    };
    reader.readAsDataURL(file);
  }

  function getFormattedOutput(): string {
    if (!dataUri) return '';
    switch (activeFormat) {
      case 'data-uri':
        return dataUri;
      case 'raw-base64':
        return rawBase64;
      case 'html-img':
        return `<img src="${dataUri}" alt="${sourceFile?.name || 'Embedded asset'}" />`;
      case 'css-bg':
        return `background-image: url("${dataUri}");`;
      case 'markdown':
        return `![${sourceFile?.name || 'Image'}](${dataUri})`;
      default:
        return dataUri;
    }
  }

  async function copyOutput() {
    const text = getFormattedOutput();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  function downloadTxtFile() {
    const text = getFormattedOutput();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sourceFile?.name || 'asset'}-base64.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function handleDecode(input: string) {
    setInputText(input);
    setDecodeError('');

    if (decodedUrl) {
      URL.revokeObjectURL(decodedUrl);
      setDecodedUrl('');
    }

    const trimmed = input.trim();
    if (!trimmed) {
      setDecodedSize(0);
      return;
    }

    try {
      let mime = 'application/octet-stream';
      let b64 = trimmed;

      if (trimmed.startsWith('data:')) {
        const matches = trimmed.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/s);
        if (matches && matches.length >= 3) {
          mime = matches[1];
          b64 = matches[2].replace(/\s/g, '');
        } else {
          throw new Error(t('Invalid Data URI format. Expected data:[mime];base64,[data]'));
        }
      } else {
        b64 = trimmed.replace(/\s/g, '');
      }

      const binaryStr = atob(b64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      if (mime === 'application/octet-stream' && len > 4) {
        if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
          mime = 'image/jpeg';
        } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
          mime = 'image/png';
        } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
          mime = 'image/gif';
        } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
          mime = 'image/webp';
        } else if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
          mime = 'application/pdf';
        }
      }

      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      setDecodedUrl(url);
      setDecodedMime(mime);
      setDecodedSize(blob.size);
    } catch (err: any) {
      setDecodeError(err.message || t('Failed to decode Base64 string. Please verify input.'));
    }
  }

  function downloadDecodedFile() {
    if (!decodedUrl) return;
    const link = document.createElement('a');
    link.href = decodedUrl;

    let ext = 'bin';
    if (decodedMime.includes('jpeg') || decodedMime.includes('jpg')) ext = 'jpg';
    else if (decodedMime.includes('png')) ext = 'png';
    else if (decodedMime.includes('webp')) ext = 'webp';
    else if (decodedMime.includes('gif')) ext = 'gif';
    else if (decodedMime.includes('svg')) ext = 'svg';
    else if (decodedMime.includes('pdf')) ext = 'pdf';
    else if (decodedMime.includes('json')) ext = 'json';
    else if (decodedMime.includes('audio/mpeg') || decodedMime.includes('mp3')) ext = 'mp3';
    else if (decodedMime.includes('wav')) ext = 'wav';

    link.download = `decoded-file-${Date.now()}.${ext}`;
    link.click();
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace base64-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="base64-title"
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
            {t('Private & Client-Side · 100% In-Browser')}
          </span>
          <button className="workspace-close" onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon teal">
            <Binary size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Developer tools')} <span>/</span> {t('BASE64 DATA URI STUDIO')}
              </span>
              <span className="hd-pill">DUAL ENCODER</span>
            </div>
            <h2 id="base64-title">{t('Base64 Data URI & Asset Studio')}</h2>
            <p>
              {t('Encode files to inline Base64/Data URI strings, HTML/CSS tags, or decode Base64 back to files.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Instant Encode · Zero Limits')}
          </span>
        </div>

        {/* Tab Toggle Row */}
        <div className="base64-tab-row">
          <button
            type="button"
            className={`tab-pill-btn ${tab === 'encode' ? 'active' : ''}`}
            onClick={() => setTab('encode')}
          >
            <Upload size={14} />
            {t('File to Base64 (Encoder)')}
          </button>
          <button
            type="button"
            className={`tab-pill-btn ${tab === 'decode' ? 'active' : ''}`}
            onClick={() => setTab('decode')}
          >
            <ArrowRightLeft size={14} />
            {t('Base64 to File (Decoder)')}
          </button>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {tab === 'encode' ? (
            <>
              {/* Left Column: Stage Output & Copy */}
              <div className="workspace-canvas">
                <div className="canvas-heading">
                  <span>
                    <span className="canvas-dot" />
                    {dataUri ? `${activeFormat.toUpperCase()} ${t('OUTPUT')}` : t('BASE64 CANVAS')}
                  </span>
                  <span>{sourceFile ? sourceFile.name : t('Select file')}</span>
                </div>

                {!dataUri ? (
                  <button
                    className="workspace-empty"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) encodeFile(e.dataTransfer.files[0]);
                    }}
                  >
                    <div className="empty-circle">
                      <Binary size={34} />
                    </div>
                    <h3>{t('Select file to encode')}</h3>
                    <p>{t('Images, audio, SVGs, documents, PDFs, or fonts.')}</p>
                    <span className="btn-fake">
                      <Upload size={16} />
                      {t('Choose File')}
                    </span>
                  </button>
                ) : (
                  <div className="base64-output-wrap">
                    {/* Format Selector Chips */}
                    <div className="format-chips-bar">
                      {[
                        { id: 'data-uri', label: 'Data URI' },
                        { id: 'raw-base64', label: 'Raw Base64' },
                        { id: 'html-img', label: 'HTML <img>' },
                        { id: 'css-bg', label: 'CSS Background' },
                        { id: 'markdown', label: 'Markdown' }
                      ].map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          className={`format-chip ${activeFormat === fmt.id ? 'active' : ''}`}
                          onClick={() => setActiveFormat(fmt.id as ExportFormat)}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      readOnly
                      className="base64-code-textarea"
                      value={getFormattedOutput()}
                    />

                    <div className="base64-actions-bar">
                      <button
                        type="button"
                        className="primary-action"
                        onClick={copyOutput}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? t('Copied to Clipboard!') : t('Copy to Clipboard')}
                      </button>

                      <button
                        type="button"
                        className="download-btn-green"
                        onClick={downloadTxtFile}
                      >
                        <Download size={16} />
                        {t('Download .txt')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls & Specs */}
              <div className="workspace-controls">
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) encodeFile(e.target.files[0]);
                    e.target.value = '';
                  }}
                />

                {sourceFile ? (
                  <div className="control-group">
                    <div className="spec-card">
                      <div className="spec-row">
                        <span>{t('File Name')}</span>
                        <strong className="truncate max-w-[160px]">{sourceFile.name}</strong>
                      </div>
                      <div className="spec-row">
                        <span>{t('MIME Type')}</span>
                        <strong>{fileMime}</strong>
                      </div>
                      <div className="spec-row">
                        <span>{t('Original Size')}</span>
                        <strong>{formatBytes(fileSize)}</strong>
                      </div>
                      <div className="spec-row">
                        <span>{t('Base64 Size')}</span>
                        <strong className="badge-green">{formatBytes(rawBase64.length)}</strong>
                      </div>
                    </div>

                    {fileMime.startsWith('image/') && (
                      <div className="base64-thumb-preview bg-checkerboard">
                        <img src={dataUri} alt="Asset" className="thumb-preview-img" />
                      </div>
                    )}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="btn-change-file"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} />
                  {sourceFile ? t('Change File') : t('Choose File')}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Decoder Stage */}
              <div className="workspace-canvas">
                <div className="canvas-heading">
                  <span>
                    <span className="canvas-dot" />
                    {decodedUrl ? t('DECODED ASSET PREVIEW') : t('DECODER INPUT')}
                  </span>
                  <span>{decodedMime}</span>
                </div>

                <div className="base64-decoder-wrap">
                  <label className="text-xs font-semibold mb-1 block">
                    {t('Paste Base64 or Data URI String')}
                  </label>
                  <textarea
                    className="base64-decode-input"
                    value={inputText}
                    onChange={(e) => handleDecode(e.target.value)}
                    placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
                    rows={6}
                  />

                  {decodeError && <div className="error-banner">{decodeError}</div>}

                  {decodedUrl && (
                    <div className="decoded-preview-card">
                      {decodedMime.startsWith('image/') && (
                        <div className="decoded-img-box bg-checkerboard">
                          <img src={decodedUrl} alt="Decoded Preview" className="decoded-img" />
                        </div>
                      )}

                      {decodedMime.startsWith('audio/') && (
                        <div className="decoded-audio-box">
                          <audio src={decodedUrl} controls className="w-full" />
                        </div>
                      )}

                      <div className="base64-actions-bar mt-3">
                        <button
                          type="button"
                          className="download-btn-green"
                          onClick={downloadDecodedFile}
                        >
                          <Download size={16} />
                          {t('Download Decoded File')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Decoder Sidebar Specs */}
              <div className="workspace-controls">
                <div className="control-group">
                  <div className="spec-card">
                    <div className="spec-row">
                      <span>{t('Detected MIME')}</span>
                      <strong>{decodedMime}</strong>
                    </div>
                    {decodedSize > 0 && (
                      <div className="spec-row">
                        <span>{t('Decoded Size')}</span>
                        <strong className="badge-green">{formatBytes(decodedSize)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
