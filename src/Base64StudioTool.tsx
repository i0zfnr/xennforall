import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRightLeft,
  Binary,
  Check,
  Code,
  Copy,
  Download,
  FileCode,
  FileText,
  Image as ImageIcon,
  Sparkles,
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

  // Encode file to Base64
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

  // Get formatted code string based on format selection
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

  // Copy code with feedback
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

  // Download raw Base64 as text file
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

  // Decode Base64 input to Blob and URL
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

      // Convert Base64 to Binary string
      const binaryStr = atob(b64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Auto-detect image MIME from magic numbers if mime is octet-stream
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

  // Download Decoded File
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="base64-modal-title"
      ref={dialogRef as any}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md overflow-hidden animate-fade-in outline-none"
    >
      <div className="bg-surface border border-subtle rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Binary className="w-5 h-5" />
            </div>
            <div>
              <h2 id="base64-modal-title" className="text-lg font-bold text-main leading-tight">
                {t('Base64 Data URI & Asset Studio')}
              </h2>
              <p className="text-xs text-muted">
                {t('Encode files into Data URIs, HTML/CSS snippets, or decode Base64 back to files')}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-2 text-muted hover:text-main rounded-xl hover:bg-surface-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t('Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex px-5 pt-3 border-b border-subtle bg-surface gap-2">
          <button
            type="button"
            onClick={() => setTab('encode')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 min-h-[44px] ${
              tab === 'encode'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            <Upload className="w-4 h-4" />
            {t('File to Base64 (Encoder)')}
          </button>
          <button
            type="button"
            onClick={() => setTab('decode')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 min-h-[44px] ${
              tab === 'decode'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            {t('Base64 to File (Decoder)')}
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'encode' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              {/* Left Column: File selection & info */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-subtle hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-all hover:bg-surface-alt/40 flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-main text-sm">{t('Select file to encode')}</h3>
                    <p className="text-xs text-muted mt-1">
                      {t('Images, audio, SVGs, documents, PDFs, or fonts')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary mt-1 min-h-[44px] px-4 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    {t('Choose File')}
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      encodeFile(e.target.files[0]);
                    }
                  }}
                />

                {sourceFile && (
                  <div className="bg-surface-alt border border-subtle rounded-xl p-4 flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-main">{t('Asset Details')}</h4>
                    <div className="flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted">{t('File Name')}:</span>
                        <span className="font-semibold text-main truncate max-w-[200px]">{sourceFile.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">{t('MIME Type')}:</span>
                        <span className="font-mono text-main">{fileMime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">{t('Original Size')}:</span>
                        <span className="font-semibold text-main">{formatBytes(fileSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">{t('Base64 Size')}:</span>
                        <span className="font-semibold text-primary">{formatBytes(rawBase64.length)}</span>
                      </div>
                    </div>

                    {fileMime.startsWith('image/') && (
                      <div className="mt-2 pt-2 border-t border-subtle flex justify-center">
                        <img
                          src={dataUri}
                          alt="File Preview"
                          className="max-h-36 max-w-full rounded-lg border border-subtle object-contain bg-checkerboard"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Format selection & code output */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                {dataUri ? (
                  <>
                    {/* Format Selector Pills */}
                    <div className="flex flex-wrap gap-2">
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
                          onClick={() => setActiveFormat(fmt.id as ExportFormat)}
                          className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all min-h-[44px] flex items-center justify-center ${
                            activeFormat === fmt.id
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : 'border-subtle bg-surface-alt text-muted hover:text-main'
                          }`}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>

                    {/* Output textarea */}
                    <div className="relative flex-1 flex flex-col min-h-[260px]">
                      <textarea
                        readOnly
                        value={getFormattedOutput()}
                        className="w-full flex-1 p-3 rounded-xl bg-black/40 border border-subtle font-mono text-xs text-emerald-300 leading-relaxed resize-none focus:outline-none"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={copyOutput}
                        className="btn btn-primary flex-1 py-2.5 min-h-[44px] text-xs font-semibold flex items-center justify-center gap-2"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        {copied ? t('Copied to Clipboard!') : t('Copy to Clipboard')}
                      </button>

                      <button
                        type="button"
                        onClick={downloadTxtFile}
                        className="btn btn-secondary py-2.5 px-4 min-h-[44px] text-xs font-semibold flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {t('Download .txt')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-surface-alt/30 rounded-xl border border-dashed border-subtle text-muted text-xs">
                    <Code className="w-8 h-8 mb-2 opacity-50" />
                    <span>{t('Upload an asset on the left to inspect and export encoded strings')}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Decoder Tab */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              <div className="lg:col-span-7 flex flex-col gap-3">
                <label className="text-xs font-bold text-main">
                  {t('Paste Base64 or Data URI String')}
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => handleDecode(e.target.value)}
                  placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
                  className="w-full h-72 p-3 rounded-xl bg-surface-alt border border-subtle font-mono text-xs text-main leading-relaxed resize-none focus:outline-none focus:border-primary"
                />

                {decodeError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                    {decodeError}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-main">{t('Decoded Result & Preview')}</h3>

                {decodedUrl ? (
                  <div className="bg-surface-alt border border-subtle rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted">{t('Detected MIME')}:</span>
                        <span className="font-mono text-main font-semibold">{decodedMime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">{t('Decoded Size')}:</span>
                        <span className="font-semibold text-main">{formatBytes(decodedSize)}</span>
                      </div>
                    </div>

                    {decodedMime.startsWith('image/') && (
                      <div className="p-2 border border-subtle rounded-lg bg-checkerboard flex items-center justify-center max-h-56 overflow-hidden">
                        <img
                          src={decodedUrl}
                          alt="Decoded Preview"
                          className="max-h-52 max-w-full object-contain rounded"
                        />
                      </div>
                    )}

                    {decodedMime.startsWith('audio/') && (
                      <div className="p-2 border border-subtle rounded-lg bg-surface flex flex-col gap-2">
                        <audio src={decodedUrl} controls className="w-full" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={downloadDecodedFile}
                      className="btn btn-primary w-full py-2.5 min-h-[44px] text-xs font-semibold flex items-center justify-center gap-2 mt-2"
                    >
                      <Download className="w-4 h-4" />
                      {t('Download Decoded File')}
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface-alt/30 rounded-xl border border-dashed border-subtle text-muted text-xs">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                    <span>{t('Paste Base64 data to decode into downloadable file and live preview')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
