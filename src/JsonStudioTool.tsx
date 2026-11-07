import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Braces,
  Check,
  Code,
  Copy,
  Download,
  FileCode,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react';

interface JsonStudioToolProps {
  initialFiles?: File[];
  close: () => void;
}

const DEFAULT_JSON = `{
  "app": "Xenn for all",
  "version": "2.0.0",
  "private": true,
  "clientSide": true,
  "features": [
    "PDF Tools",
    "Image Studio",
    "Audio Acoustics",
    "Developer Suite"
  ],
  "stats": {
    "totalTools": 54,
    "serverUploads": 0
  }
}`;

export default function JsonStudioTool({ initialFiles = [], close }: JsonStudioToolProps) {
  const [jsonInput, setJsonInput] = useState<string>(DEFAULT_JSON);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [indent, setIndent] = useState<number>(2);

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
      initialFiles[0].text().then((txt) => {
        if (txt) setJsonInput(txt);
      }).catch((e) => console.error(e));
    }
  }, []);

  // Validate on change
  useEffect(() => {
    validateJson(jsonInput);
  }, [jsonInput]);

  function validateJson(val: string): boolean {
    if (!val.trim()) {
      setErrorMsg('');
      return true;
    }
    try {
      JSON.parse(val);
      setErrorMsg('');
      return true;
    } catch (err: any) {
      setErrorMsg(err.message || t('Invalid JSON syntax'));
      return false;
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, indent));
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg(err.message || t('Cannot format invalid JSON'));
    }
  }

  function handleMinify() {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed));
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg(err.message || t('Cannot minify invalid JSON'));
    }
  }

  async function copyJson() {
    await navigator.clipboard.writeText(jsonInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadJsonFile() {
    const blob = new Blob([jsonInput], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `data-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace jsonstudio-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jsonstudio-title"
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
            <Braces size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Developer tools')} <span>/</span> {t('JSON FORMATTER & VALIDATOR')}
              </span>
              <span className="hd-pill">FORMAT & MINIFY</span>
            </div>
            <h2 id="jsonstudio-title">{t('JSON Studio & Syntax Formatter')}</h2>
            <p>
              {t('Beautify, validate, minify, and clean JSON data in browser memory with instant error location.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Instant Validation · Fast Export')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main JSON Editor */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {!errorMsg ? `${t('VALID JSON')} (${jsonInput.length} ${t('bytes')})` : t('SYNTAX ERROR')}
              </span>
              <span>{errorMsg ? <span className="text-red-400 font-bold">{t('Syntax Issue')}</span> : t('Ready')}</span>
            </div>

            <div className="jsonstudio-stage-wrap">
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className={`json-code-textarea ${errorMsg ? 'has-error' : ''}`}
                rows={18}
                spellCheck={false}
              />

              {errorMsg && (
                <div className="error-banner">
                  <strong>{t('Invalid JSON')}:</strong> {errorMsg}
                </div>
              )}

              <div className="jsonstudio-actions-row">
                <button
                  type="button"
                  className="primary-action"
                  onClick={copyJson}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? t('Copied JSON!') : t('Copy JSON')}
                </button>

                <button
                  type="button"
                  className="download-btn-green"
                  onClick={downloadJsonFile}
                >
                  <Download size={16} />
                  {t('Download .JSON')}
                </button>
              </div>
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="workspace-controls">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".json,.txt"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  e.target.files[0].text().then((txt) => {
                    if (txt) setJsonInput(txt);
                  });
                }
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <label>{t('Formatting Actions')}</label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="primary-action w-full"
                  onClick={handleFormat}
                >
                  <Sparkles size={16} />
                  {t('Format & Beautify JSON')}
                </button>

                <button
                  type="button"
                  className="btn-change-file"
                  style={{ marginTop: 0 }}
                  onClick={handleMinify}
                >
                  <Code size={16} />
                  {t('Minify (Compact Single Line)')}
                </button>
              </div>
            </div>

            <div className="control-group">
              <label>{t('Indentation')}</label>
              <div className="btn-toggle-group">
                {[2, 4].map((spaces) => (
                  <button
                    key={spaces}
                    type="button"
                    className={indent === spaces ? 'active' : ''}
                    onClick={() => {
                      setIndent(spaces);
                      try {
                        const parsed = JSON.parse(jsonInput);
                        setJsonInput(JSON.stringify(parsed, null, spaces));
                      } catch (_) {}
                    }}
                  >
                    {spaces} {t('Spaces')}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <div className="spec-card">
                <div className="spec-row">
                  <span>{t('Characters')}</span>
                  <strong>{jsonInput.length}</strong>
                </div>
                <div className="spec-row">
                  <span>{t('Lines')}</span>
                  <strong>{jsonInput.split('\n').length}</strong>
                </div>
                <div className="spec-row">
                  <span>{t('Validation')}</span>
                  <strong className={errorMsg ? 'text-red-400' : 'badge-green-text'}>
                    {errorMsg ? t('Invalid') : t('Valid JSON')}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-change-file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              {t('Open .JSON File')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
