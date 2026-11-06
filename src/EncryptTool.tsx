import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Download,
  Eye,
  EyeOff,
  FileCheck,
  FileText,
  KeyRound,
  Lock,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Upload,
  X
} from 'lucide-react';

interface EncryptToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function EncryptTool({ initialFiles = [], close }: EncryptToolProps) {
  const [tab, setTab] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Results
  const [busy, setBusy] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [resultBlob, setResultBlob] = useState<{ blob: Blob; filename: string } | null>(null);
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

  // Ingest initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    setResultBlob(null);
    setFile(f);

    // Auto-detect if file is an encrypted .xenn container
    if (f.name.endsWith('.xenn')) {
      setTab('decrypt');
    } else {
      setTab('encrypt');
    }
  }

  // Derive AES-GCM Key using PBKDF2 (100,000 iterations)
  async function deriveKey(pass: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(pass),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt File into .xenn binary container
  async function handleEncrypt() {
    if (!file || !password) return;
    if (password.length < 4) {
      setErrorMessage(t('Password must be at least 4 characters long.'));
      return;
    }

    setBusy(true);
    setStatusMsg(t('Deriving military-grade 256-bit encryption key…'));
    setErrorMessage('');

    try {
      const fileBytes = await file.arrayBuffer();

      // 1. Generate 16-byte random salt and 12-byte IV
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // 2. Derive key
      const key = await deriveKey(password, salt);

      // 3. Encrypt file payload with AES-GCM
      setStatusMsg(t('Encrypting bytes with AES-GCM 256-bit…'));
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        fileBytes
      );

      // 4. Encode Original Filename
      const enc = new TextEncoder();
      const filenameBytes = enc.encode(file.name);
      const filenameLen = filenameBytes.length;

      // 5. Build Container:
      // [MAGIC: "XENN" (4B)] [SALT (16B)] [IV (12B)] [FILENAME_LEN (2B)] [FILENAME (NB)] [CIPHERTEXT]
      const totalSize = 4 + 16 + 12 + 2 + filenameLen + ciphertext.byteLength;
      const container = new Uint8Array(totalSize);
      let offset = 0;

      // Magic
      container.set([0x58, 0x45, 0x4e, 0x4e], offset); // "XENN"
      offset += 4;

      // Salt
      container.set(salt, offset);
      offset += 16;

      // IV
      container.set(iv, offset);
      offset += 12;

      // Filename length
      container[offset] = (filenameLen >> 8) & 0xff;
      container[offset + 1] = filenameLen & 0xff;
      offset += 2;

      // Filename
      container.set(filenameBytes, offset);
      offset += filenameLen;

      // Ciphertext
      container.set(new Uint8Array(ciphertext), offset);

      const blob = new Blob([container], { type: 'application/octet-stream' });
      setResultBlob({ blob, filename: `${file.name}.xenn` });
      setStatusMsg('');
    } catch {
      setErrorMessage(t('Encryption failed.'));
    } finally {
      setBusy(false);
    }
  }

  // Decrypt .xenn container back into original file
  async function handleDecrypt() {
    if (!file || !password) return;
    setBusy(true);
    setStatusMsg(t('Verifying container and password…'));
    setErrorMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);

      // Verify magic
      if (bytes[0] !== 0x58 || bytes[1] !== 0x45 || bytes[2] !== 0x4e || bytes[3] !== 0x4e) {
        throw new Error(t('Invalid .xenn container. This file was not encrypted with Xenn.'));
      }

      let offset = 4;
      const salt = bytes.slice(offset, offset + 16);
      offset += 16;

      const iv = bytes.slice(offset, offset + 12);
      offset += 12;

      const filenameLen = (bytes[offset] << 8) | bytes[offset + 1];
      offset += 2;

      const filenameBytes = bytes.slice(offset, offset + filenameLen);
      const dec = new TextDecoder();
      const origFilename = dec.decode(filenameBytes);
      offset += filenameLen;

      const ciphertext = bytes.slice(offset);

      // Derive key
      const key = await deriveKey(password, salt);

      // Decrypt
      setStatusMsg(t('Decrypting and verifying authentication tag…'));
      const plaintext = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      const blob = new Blob([plaintext]);
      setResultBlob({ blob, filename: origFilename });
      setStatusMsg('');
    } catch {
      setErrorMessage(t('Decryption failed! Wrong password or corrupted file.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadResult() {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resultBlob.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace encrypt-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="encrypt-title"
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
            {t('Private & Client-Side · Military-Grade AES-GCM 256-Bit')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon emerald">
            <Lock size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Security tools')} <span>/</span> {t('ENCRYPTED FILE VAULT')}
              </span>
              <span className="hd-pill">AES-GCM 256-BIT</span>
            </div>
            <h2 id="encrypt-title">{t('Password Encrypted File Vault')}</h2>
            <p>
              {t('Lock any document, photo, or archive with military-grade 256-bit password encryption with zero software install.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Uncrackable · In-Browser')}
          </span>
        </div>

        {/* Tab Selector */}
        <div className="qr-tab-bar">
          <button
            type="button"
            className={tab === 'encrypt' ? 'active' : ''}
            onClick={() => {
              setTab('encrypt');
              setResultBlob(null);
            }}
          >
            <Lock size={16} />
            {t('Encrypt Any File')}
          </button>
          <button
            type="button"
            className={tab === 'decrypt' ? 'active' : ''}
            onClick={() => {
              setTab('decrypt');
              setResultBlob(null);
            }}
          >
            <Unlock size={16} />
            {t('Decrypt .xenn File')}
          </button>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {tab === 'encrypt' ? t('ENCRYPTION VAULT') : t('DECRYPTION VAULT')}
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
                  handleFileSelected(e.dataTransfer.files[0]);
                }}
              >
                <div className="empty-circle">
                  {tab === 'encrypt' ? <Lock size={34} /> : <Unlock size={34} />}
                </div>
                <h3>{tab === 'encrypt' ? t('Drop file to encrypt with password') : t('Drop .xenn file to unlock')}</h3>
                <p>{t('Supports PDF, photos, videos, and archives. Completely private and executed in local browser memory.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select file')}
                </span>
              </button>
            ) : resultBlob ? (
              <div className="encrypt-result-box">
                <div className="result-shield-badge">
                  <ShieldCheck size={48} />
                </div>
                <h3>
                  {tab === 'encrypt'
                    ? t('File Successfully Encrypted!')
                    : t('File Successfully Decrypted!')}
                </h3>
                <p>
                  <strong>{resultBlob.filename}</strong> ({(resultBlob.blob.size / 1024).toFixed(1)} KB)
                </p>
                <button className="download-btn-green large" onClick={downloadResult}>
                  <Download size={18} />
                  {tab === 'encrypt' ? t('Download Encrypted File (.xenn)') : t('Download Decrypted File')}
                </button>
              </div>
            ) : (
              <div className="encrypt-file-selected-box">
                <div className="file-hero-badge">
                  <FileText size={36} />
                </div>
                <div className="file-hero-meta">
                  <strong>{file.name}</strong>
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>

                <div className="security-notice-card">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>{t('Zero-Knowledge In-Browser Security')}</strong>
                    <p>
                      {t('Your password derives a cryptographic key locally. If you lose your password, there is no backdoor to recover the file.')}
                    </p>
                  </div>
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
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {!resultBlob && (
              <>
                <div className="control-group">
                  <label>{tab === 'encrypt' ? t('Set Secret Password') : t('Enter Decryption Password')}</label>
                  <div className="password-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('Enter password…')}
                      className="qr-input"
                    />
                    <button
                      type="button"
                      className="btn-toggle-eye"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? t('Hide password') : t('Show password')}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="control-group">
                  <label>{t('Cryptographic Standards')}</label>
                  <div className="spec-card">
                    <div className="spec-row">
                      <span>{t('Cipher')}</span>
                      <strong>AES-GCM (256-bit)</strong>
                    </div>
                    <div className="spec-row">
                      <span>{t('Key Derivation')}</span>
                      <strong>PBKDF2 (100,000 rounds)</strong>
                    </div>
                    <div className="spec-row">
                      <span>{t('Authentication')}</span>
                      <strong className="badge-green">{t('128-bit Integrity Tag')}</strong>
                    </div>
                  </div>
                </div>

                {tab === 'encrypt' ? (
                  <button
                    className="primary-action"
                    disabled={!file || !password || busy}
                    onClick={handleEncrypt}
                  >
                    {busy ? <RotateCw size={17} className="spin" /> : <Lock size={17} />}
                    {busy ? statusMsg : t('Encrypt & Lock File')}
                  </button>
                ) : (
                  <button
                    className="primary-action"
                    disabled={!file || !password || busy}
                    onClick={handleDecrypt}
                  >
                    {busy ? <RotateCw size={17} className="spin" /> : <Unlock size={17} />}
                    {busy ? statusMsg : t('Unlock & Decrypt File')}
                  </button>
                )}
              </>
            )}

            {file && (
              <button
                className="btn-change-file"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Change file')}
              </button>
            )}

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
