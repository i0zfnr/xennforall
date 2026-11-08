import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowDownToLine,
  ArrowRight,
  Camera,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Link,
  MessageCircle,
  QrCode,
  RotateCw,
  Scan,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  Wifi,
  X
} from 'lucide-react';

interface QrStudioToolProps {
  close: () => void;
}

export default function QrStudioTool({ close }: QrStudioToolProps) {
  const [tab, setTab] = useState<'create' | 'scan'>('create');

  // Generator State
  const [qrType, setQrType] = useState<'url' | 'wifi' | 'whatsapp' | 'vcard' | 'text'>('url');
  const [urlVal, setUrlVal] = useState<string>('https://xennforall.ryaze.my.id');

  // Wi-Fi inputs
  const [wifiSsid, setWifiSsid] = useState<string>('MyOffice_5G');
  const [wifiPass, setWifiPass] = useState<string>('SuperSecret123');
  const [wifiType, setWifiType] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState<boolean>(false);

  // WhatsApp inputs
  const [waPhone, setWaPhone] = useState<string>('60123456789');
  const [waMsg, setWaMsg] = useState<string>('Hello! I would like to make an inquiry.');

  // vCard inputs
  const [vcardName, setVcardName] = useState<string>('Alex Wong');
  const [vcardPhone, setVcardPhone] = useState<string>('+60 12-345 6789');
  const [vcardEmail, setVcardEmail] = useState<string>('alex@example.com');
  const [vcardOrg, setVcardOrg] = useState<string>('Tech Solutions');

  // Text inputs
  const [plainText, setPlainText] = useState<string>('');

  // Styling state
  const [fgColor, setFgColor] = useState<string>('#0f172a');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [eccLevel, setEccLevel] = useState<'M' | 'Q' | 'H'>('H');
  const [centerIcon, setCenterIcon] = useState<'none' | 'wifi' | 'whatsapp' | 'link' | 'user'>('none');

  // Scanner State
  const [isScanningLive, setIsScanningLive] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<string>('');
  const [scanError, setScanError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerVideoRef = useRef<HTMLVideoElement>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

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

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, []);

  // Generate payload string based on type
  function getPayloadString(): string {
    if (qrType === 'url') {
      return urlVal.trim();
    }
    if (qrType === 'wifi') {
      const h = wifiHidden ? 'H:true;' : '';
      return `WIFI:S:${wifiSsid};T:${wifiType};P:${wifiPass};${h};`;
    }
    if (qrType === 'whatsapp') {
      const cleanPhone = waPhone.replace(/[^0-9]/g, '');
      const encodedMsg = encodeURIComponent(waMsg);
      return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
    }
    if (qrType === 'vcard') {
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${vcardName}`,
        `TEL:${vcardPhone}`,
        `EMAIL:${vcardEmail}`,
        `ORG:${vcardOrg}`,
        'END:VCARD'
      ].join('\n');
    }
    return plainText || 'https://xennforall.ryaze.my.id';
  }

  // Draw QR code to canvas whenever inputs change
  useEffect(() => {
    if (tab !== 'create' || !canvasRef.current) return;
    const payload = getPayloadString();
    const canvas = canvasRef.current;

    QRCode.toCanvas(
      canvas,
      payload,
      {
        width: 480,
        margin: 2,
        errorCorrectionLevel: eccLevel,
        color: {
          dark: fgColor,
          light: bgColor
        }
      },
      (err) => {
        if (!err && centerIcon !== 'none') {
          drawCenterIcon(canvas, centerIcon);
        }
      }
    );
  }, [
    tab,
    qrType,
    urlVal,
    wifiSsid,
    wifiPass,
    wifiType,
    wifiHidden,
    waPhone,
    waMsg,
    vcardName,
    vcardPhone,
    vcardEmail,
    vcardOrg,
    plainText,
    fgColor,
    bgColor,
    eccLevel,
    centerIcon
  ]);

  function drawCenterIcon(canvas: HTMLCanvasElement, iconType: string) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const center = canvas.width / 2;
    const size = canvas.width * 0.18;
    const half = size / 2;

    // Draw circular or rounded background badge
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(center, center, half + 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw icon symbol
    ctx.fillStyle = fgColor;
    ctx.font = `bold ${Math.round(size * 0.55)}px sans-serif`;
    ctx.fillStyle = fgColor;
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (iconType === 'wifi') {
      ctx.beginPath();
      ctx.arc(center, center + 4, 10, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(center, center + 4, 6, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(center, center + 5, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (iconType === 'whatsapp') {
      ctx.beginPath();
      ctx.ellipse(center, center - 1, 9, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(center - 4, center + 5);
      ctx.lineTo(center - 7, center + 9);
      ctx.lineTo(center - 1, center + 6);
      ctx.stroke();
    } else if (iconType === 'link') {
      ctx.beginPath();
      ctx.arc(center - 3, center, 4.5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(center + 3, center, 4.5, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(center - 3, center);
      ctx.lineTo(center + 3, center);
      ctx.stroke();
    } else if (iconType === 'user') {
      ctx.beginPath();
      ctx.arc(center, center - 3, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(center, center + 9, 7, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();
    }
  }

  function downloadPng() {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-${qrType}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function copyQrImage() {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current?.toBlob((b) => resolve(b!), 'image/png');
      });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  // Camera Live Scanner
  async function startCameraScanner() {
    setScanError('');
    setScanResult('');
    setIsScanningLive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      cameraStreamRef.current = stream;

      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream;
        await scannerVideoRef.current.play();
      }

      // Start BarcodeDetector loop if supported
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'data_matrix']
        });

        scanIntervalRef.current = window.setInterval(async () => {
          if (!scannerVideoRef.current || scannerVideoRef.current.readyState < 2) return;
          try {
            const barcodes = await barcodeDetector.detect(scannerVideoRef.current);
            if (barcodes && barcodes.length > 0) {
              setScanResult(barcodes[0].rawValue);
              stopCameraScanner();
            }
          } catch {
            // Frame detection error
          }
        }, 300);
      } else {
        setScanError(t('Live camera barcode detection is not supported in this browser. Please upload a photo to scan.'));
      }
    } catch {
      setScanError(t('Unable to access camera for scanning. Please check camera permissions.'));
      setIsScanningLive(false);
    }
  }

  function stopCameraScanner() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanningLive(false);
  }

  // Scan from photo upload
  async function handleScanPhoto(file?: File) {
    if (!file) return;
    setScanError('');
    setScanResult('');

    if ('BarcodeDetector' in window) {
      try {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        await img.decode();
        URL.revokeObjectURL(url);

        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'code_128', 'data_matrix']
        });
        const barcodes = await barcodeDetector.detect(img);
        if (barcodes && barcodes.length > 0) {
          setScanResult(barcodes[0].rawValue);
        } else {
          setScanError(t('No QR code or barcode found in this image. Try another photo with clearer contrast.'));
        }
      } catch {
        setScanError(t('Could not decode barcode from image.'));
      }
    } else {
      setScanError(t('In-browser barcode detection requires a modern Chromium or Safari browser.'));
    }
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace qrstudio-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qrstudio-title"
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
            {t('100% In-Browser · High-Res Vector Output')}
          </span>
          <button className="workspace-close" onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon coral">
            <QrCode size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Utility tools')} <span>/</span> {t('SMART QR & BARCODE STUDIO')}
              </span>
              <span className="hd-pill">DUITNOW & WI-FI READY</span>
            </div>
            <h2 id="qrstudio-title">{t('Smart QR Code & Barcode Studio')}</h2>
            <p>
              {t('Generate styled QR codes for instant Wi-Fi login, WhatsApp direct chat, links, or scan codes via camera.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Custom Badges · Infinite Res')}
          </span>
        </div>

        {/* Tab Selector */}
        <div className="qr-tab-bar">
          <button
            type="button"
            className={tab === 'create' ? 'active' : ''}
            onClick={() => {
              stopCameraScanner();
              setTab('create');
            }}
          >
            <Sparkles size={16} />
            {t('Create Custom QR Code')}
          </button>
          <button
            type="button"
            className={tab === 'scan' ? 'active' : ''}
            onClick={() => setTab('scan')}
          >
            <Scan size={16} />
            {t('Scan QR & Barcode')}
          </button>
        </div>

        {tab === 'create' ? (
          <div className="workspace-grid">
            {/* Visual Canvas Display */}
            <div className="workspace-canvas">
              <div className="canvas-heading">
                <span>
                  <span className="canvas-dot" />
                  {t('LIVE QR PREVIEW')}
                </span>
                <span>{qrType.toUpperCase()} {t('Format')}</span>
              </div>

              <div className="qr-canvas-preview-wrap">
                <div className="qr-badge-card" style={{ backgroundColor: bgColor }}>
                  <canvas ref={canvasRef} className="qr-rendered-canvas" />
                </div>
              </div>

              <div className="qr-download-actions">
                <button className="download-btn-green" onClick={downloadPng}>
                  <Download size={18} />
                  {t('Download High-Res PNG')}
                </button>
                <button className="primary-action" onClick={copyQrImage}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? t('Copied to Clipboard!') : t('Copy Image')}
                </button>
              </div>
            </div>

            {/* Controls Sidebar */}
            <div className="workspace-controls">
              {/* Type Switcher */}
              <div className="control-group">
                <label>{t('QR Code Type')}</label>
                <div className="qr-type-chips">
                  <button
                    type="button"
                    className={qrType === 'url' ? 'active' : ''}
                    onClick={() => {
                      setQrType('url');
                      setCenterIcon('link');
                    }}
                  >
                    <Globe size={14} />
                    Website
                  </button>
                  <button
                    type="button"
                    className={qrType === 'wifi' ? 'active' : ''}
                    onClick={() => {
                      setQrType('wifi');
                      setCenterIcon('wifi');
                    }}
                  >
                    <Wifi size={14} />
                    Wi-Fi
                  </button>
                  <button
                    type="button"
                    className={qrType === 'whatsapp' ? 'active' : ''}
                    onClick={() => {
                      setQrType('whatsapp');
                      setCenterIcon('whatsapp');
                    }}
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    className={qrType === 'vcard' ? 'active' : ''}
                    onClick={() => {
                      setQrType('vcard');
                      setCenterIcon('user');
                    }}
                  >
                    <User size={14} />
                    vCard
                  </button>
                </div>
              </div>

              {/* Dynamic Inputs based on type */}
              {qrType === 'url' && (
                <div className="control-group">
                  <label>{t('Website URL')}</label>
                  <input
                    type="url"
                    value={urlVal}
                    onChange={(e) => setUrlVal(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="qr-input"
                  />
                </div>
              )}

              {qrType === 'wifi' && (
                <>
                  <div className="control-group">
                    <label>{t('Wi-Fi Network Name (SSID)')}</label>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      placeholder="e.g. Starbucks_Guest"
                      className="qr-input"
                    />
                  </div>
                  <div className="control-group">
                    <label>{t('Wi-Fi Password')}</label>
                    <input
                      type="text"
                      value={wifiPass}
                      onChange={(e) => setWifiPass(e.target.value)}
                      placeholder="Password"
                      className="qr-input"
                    />
                  </div>
                </>
              )}

              {qrType === 'whatsapp' && (
                <>
                  <div className="control-group">
                    <label>{t('WhatsApp Phone Number (with Country Code)')}</label>
                    <input
                      type="tel"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      placeholder="e.g. 60123456789"
                      className="qr-input"
                    />
                  </div>
                  <div className="control-group">
                    <label>{t('Pre-filled Message')}</label>
                    <textarea
                      rows={2}
                      value={waMsg}
                      onChange={(e) => setWaMsg(e.target.value)}
                      placeholder="Hi, I saw your catalog..."
                      className="qr-input"
                    />
                  </div>
                </>
              )}

              {qrType === 'vcard' && (
                <>
                  <div className="control-group">
                    <label>{t('Full Name')}</label>
                    <input
                      type="text"
                      value={vcardName}
                      onChange={(e) => setVcardName(e.target.value)}
                      className="qr-input"
                    />
                  </div>
                  <div className="control-group">
                    <label>{t('Phone Number')}</label>
                    <input
                      type="tel"
                      value={vcardPhone}
                      onChange={(e) => setVcardPhone(e.target.value)}
                      className="qr-input"
                    />
                  </div>
                  <div className="control-group">
                    <label>{t('Company / Title')}</label>
                    <input
                      type="text"
                      value={vcardOrg}
                      onChange={(e) => setVcardOrg(e.target.value)}
                      className="qr-input"
                    />
                  </div>
                </>
              )}

              {/* Colors */}
              <div className="control-group">
                <label>{t('QR Code Color')}</label>
                <div className="color-palette-row">
                  {[
                    { color: '#0f172a', name: 'Slate' },
                    { color: '#2563eb', name: 'Blue' },
                    { color: '#059669', name: 'Emerald' },
                    { color: '#7c3aed', name: 'Violet' },
                    { color: '#e11d48', name: 'Rose' },
                    { color: '#d97706', name: 'Amber' }
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      className={`color-pick-circle ${fgColor === c.color ? 'active' : ''}`}
                      style={{ backgroundColor: c.color }}
                      onClick={() => setFgColor(c.color)}
                      aria-label={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Center Logo */}
              <div className="control-group">
                <label>{t('Center Badge')}</label>
                <div className="btn-toggle-group">
                  <button
                    type="button"
                    className={centerIcon === 'none' ? 'active' : ''}
                    onClick={() => setCenterIcon('none')}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    className={centerIcon === 'wifi' ? 'active' : ''}
                    onClick={() => setCenterIcon('wifi')}
                  >
                    <Wifi size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Wi-Fi
                  </button>
                  <button
                    type="button"
                    className={centerIcon === 'whatsapp' ? 'active' : ''}
                    onClick={() => setCenterIcon('whatsapp')}
                  >
                    <MessageCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> WhatsApp
                  </button>
                  <button
                    type="button"
                    className={centerIcon === 'link' ? 'active' : ''}
                    onClick={() => setCenterIcon('link')}
                  >
                    <Link size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="workspace-grid">
            {/* Live Camera Scanner */}
            <div className="workspace-canvas">
              <div className="canvas-heading">
                <span>
                  <span className="canvas-dot" />
                  {isScanningLive ? t('CAMERA SCANNER ACTIVE') : t('SCANNER READY')}
                </span>
                <span>{t('Point at QR code or barcode')}</span>
              </div>

              <div className="scanner-viewport-wrap">
                {isScanningLive ? (
                  <div className="scanner-live-box">
                    <video ref={scannerVideoRef} playsInline muted className="scanner-video-element" />
                    <div className="scanner-target-reticle">
                      <div className="reticle-corner top-left" />
                      <div className="reticle-corner top-right" />
                      <div className="reticle-corner bottom-left" />
                      <div className="reticle-corner bottom-right" />
                      <div className="scanner-laser-line" />
                    </div>
                  </div>
                ) : (
                  <div className="scanner-idle-box">
                    <Scan size={44} />
                    <p>{t('Use your device camera to scan any QR code or barcode in real time.')}</p>
                    <button className="primary-action" onClick={startCameraScanner}>
                      <Camera size={18} />
                      {t('Start Camera Scanner')}
                    </button>
                  </div>
                )}
              </div>

              {scanResult && (
                <div className="scan-result-card">
                  <div className="scan-result-header">
                    <Check size={18} />
                    <strong>{t('Decoded Result')}</strong>
                  </div>
                  <div className="scan-result-content">{scanResult}</div>
                  <div className="scan-result-actions">
                    <button
                      className="primary-action small"
                      onClick={() => {
                        navigator.clipboard.writeText(scanResult);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? t('Copied!') : t('Copy Text')}
                    </button>
                    {scanResult.startsWith('http') && (
                      <a href={scanResult} target="_blank" rel="noreferrer" className="external-link-btn">
                        <ExternalLink size={14} />
                        {t('Open URL')}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Scan from file */}
            <div className="workspace-controls">
              <input
                ref={scanFileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => {
                  handleScanPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              <div className="control-group">
                <label>{t('Or Upload QR Photo')}</label>
                <button className="workspace-empty small" onClick={() => scanFileInputRef.current?.click()}>
                  <ImageIcon size={24} />
                  <p>{t('Select image with QR code')}</p>
                </button>
              </div>

              {isScanningLive && (
                <button className="record-btn-stop" onClick={stopCameraScanner}>
                  {t('Stop Camera Scanner')}
                </button>
              )}

              {scanError && <div className="error-banner">{scanError}</div>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
