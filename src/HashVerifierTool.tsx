import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  FileCheck,
  Files,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X
} from 'lucide-react';

interface HashVerifierToolProps {
  initialFiles?: File[];
  close: () => void;
}

interface HashResults {
  sha256: string;
  sha512: string;
  sha1: string;
}

export default function HashVerifierTool({ initialFiles = [], close }: HashVerifierToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [hashes, setHashes] = useState<HashResults>({ sha256: '', sha512: '', sha1: '' });
  const [expectedHash, setExpectedHash] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string>('');

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
      computeFileHashes(initialFiles[0]);
    }
  }, []);

  async function computeFileHashes(f: File) {
    setFile(f);
    setBusy(true);
    setHashes({ sha256: '', sha512: '', sha1: '' });

    try {
      const buffer = await f.arrayBuffer();

      // Compute SHA-256, SHA-512, SHA-1 in parallel via native Web Crypto API
      const [buf256, buf512, buf1] = await Promise.all([
        crypto.subtle.digest('SHA-256', buffer),
        crypto.subtle.digest('SHA-512', buffer),
        crypto.subtle.digest('SHA-1', buffer)
      ]);

      setHashes({
        sha256: bufferToHex(buf256),
        sha512: bufferToHex(buf512),
        sha1: bufferToHex(buf1)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  function bufferToHex(buffer: ArrayBuffer): string {
    const byteArray = new Uint8Array(buffer);
    const hexCodes = [...byteArray].map((value) => {
      const hexCode = value.toString(16);
      return hexCode.padStart(2, '0');
    });
    return hexCodes.join('');
  }

  async function copyHash(name: string, val: string) {
    await navigator.clipboard.writeText(val);
    setCopiedKey(name);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  // Check matching
  const cleanedExpected = expectedHash.trim().toLowerCase();
  const isMatch = Boolean(
    cleanedExpected &&
      (cleanedExpected === hashes.sha256.toLowerCase() ||
        cleanedExpected === hashes.sha512.toLowerCase() ||
        cleanedExpected === hashes.sha1.toLowerCase())
  );
  const isMismatch = Boolean(cleanedExpected && !isMatch && hashes.sha256);

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace hashverifier-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hashverifier-title"
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
          <span className="tool-icon blue">
            <KeyRound size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Security & Privacy')} <span>/</span> {t('CRYPTOGRAPHIC HASH VERIFIER')}
              </span>
              <span className="hd-pill">SHA-256 & SHA-512</span>
            </div>
            <h2 id="hashverifier-title">{t('Checksum & Cryptographic Hash Verifier')}</h2>
            <p>
              {t('Compute authentic SHA-256, SHA-512, and SHA-1 cryptographic hashes directly in browser memory to verify file integrity and detect tampering.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Web Crypto API · Zero Uploads')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {hashes.sha256 ? t('HASH CHECKSUMS') : t('FILE WORKBENCH')}
              </span>
              <span>{file ? file.name : t('Select file')}</span>
            </div>

            {!file ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) computeFileHashes(e.dataTransfer.files[0]);
                }}
              >
                <div className="empty-circle">
                  <KeyRound size={34} />
                </div>
                <h3>{t('Drop file to calculate checksum hashes')}</h3>
                <p>{t('Supports any installer, ISO, image, document, or archive. 100% in local RAM.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose File')}
                </span>
              </button>
            ) : (
              <div className="hashverifier-stage-wrap">
                {/* Checksum Match / Mismatch Result Banner */}
                {cleanedExpected && (
                  <div className={`meta-status-banner ${isMatch ? 'clean' : 'warning'}`}>
                    {isMatch ? (
                      <>
                        <ShieldCheck size={22} className="text-emerald-400" />
                        <div>
                          <strong>{t('Checksum Match Verified!')}</strong>
                          <p>{t('This file exactly matches the expected cryptographic signature. It is authentic and uncorrupted.')}</p>
                        </div>
                      </>
                    ) : isMismatch ? (
                      <>
                        <ShieldAlert size={22} className="text-amber-400" />
                        <div>
                          <strong>{t('Checksum Mismatch Warning!')}</strong>
                          <p>{t('The calculated hash does not match your provided checksum. The file may be altered or incomplete.')}</p>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}

                {/* Hash Output Cards */}
                <div className="hash-cards-list">
                  {[
                    { label: 'SHA-256', val: hashes.sha256 },
                    { label: 'SHA-512', val: hashes.sha512 },
                    { label: 'SHA-1', val: hashes.sha1 }
                  ].map((item) => (
                    <div key={item.label} className="hash-item-card">
                      <div className="hash-item-header">
                        <strong>{item.label}</strong>
                        <button
                          type="button"
                          className="copy-snippet-btn"
                          disabled={!item.val}
                          onClick={() => copyHash(item.label, item.val)}
                        >
                          {copiedKey === item.label ? <Check size={14} /> : <Copy size={14} />}
                          {copiedKey === item.label ? t('Copied!') : t('Copy Hash')}
                        </button>
                      </div>
                      <pre className="hash-hex-string">
                        {item.val || (busy ? t('Calculating hash…') : '-')}
                      </pre>
                    </div>
                  ))}
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
              onChange={(e) => {
                if (e.target.files?.[0]) computeFileHashes(e.target.files[0]);
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <label>{t('Compare with Expected Checksum')}</label>
              <textarea
                className="tool-textarea"
                rows={4}
                value={expectedHash}
                onChange={(e) => setExpectedHash(e.target.value)}
                placeholder={t('Paste official SHA-256 or SHA-512 checksum to verify authenticity…')}
              />
            </div>

            {file && (
              <div className="control-group">
                <div className="spec-card">
                  <div className="spec-row">
                    <span>{t('File Name')}</span>
                    <strong className="truncate max-w-[160px]">{file.name}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('File Size')}</span>
                    <strong>{(file.size / 1024 / 1024).toFixed(2)} MB</strong>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn-change-file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              {file ? t('Change File') : t('Select File')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
