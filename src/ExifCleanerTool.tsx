import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Camera,
  Check,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  Globe,
  Image as ImageIcon,
  Lock,
  MapPin,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X
} from 'lucide-react';

interface ExifData {
  hasGps: boolean;
  latitude?: number;
  longitude?: number;
  latitudeDms?: string;
  longitudeDms?: string;
  altitude?: number;
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  lensModel?: string;
  totalTagsCount: number;
}

interface ExifCleanerToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function ExifCleanerTool({ initialFiles = [], close }: ExifCleanerToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Exif info
  const [exif, setExif] = useState<ExifData | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);

  // Sanitized result
  const [sanitizedBlob, setSanitizedBlob] = useState<Blob | null>(null);
  const [sanitizedUrl, setSanitizedUrl] = useState<string>('');
  const [sanitizedSize, setSanitizedSize] = useState<number>(0);
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png'>('jpeg');

  // Processing state
  const [busy, setBusy] = useState<boolean>(false);
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

  // Object URL cleanup
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      if (sanitizedUrl) URL.revokeObjectURL(sanitizedUrl);
    };
  }, [imagePreviewUrl, sanitizedUrl]);

  // Initial files
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    const valid = f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|tiff)$/i.test(f.name);
    if (!valid) {
      setErrorMessage(t('Please select a valid image file (JPG, PNG, WebP).'));
      return;
    }

    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (sanitizedUrl) URL.revokeObjectURL(sanitizedUrl);

    const url = URL.createObjectURL(f);
    setFile(f);
    setImagePreviewUrl(url);
    setSanitizedBlob(null);
    setSanitizedUrl('');

    // Load dimensions
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;

    // Inspect EXIF
    parseExif(f);
  }

  // Lightweight in-browser EXIF and GPS Parser
  async function parseExif(imgFile: File) {
    setIsInspecting(true);
    setExif(null);

    try {
      const buffer = await imgFile.arrayBuffer();
      const view = new DataView(buffer);

      // Check for JPEG SOI marker (0xFFD8)
      if (view.getUint16(0, false) !== 0xffd8) {
        // Not a standard JPEG or has no EXIF marker
        setExif({ hasGps: false, totalTagsCount: 0 });
        setIsInspecting(false);
        return;
      }

      let offset = 2;
      const length = view.byteLength;
      let app1Found = false;
      let exifOffset = 0;

      while (offset < length - 4) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xffe1) {
          // APP1 Marker found
          const app1Length = view.getUint16(offset, false);
          // Check for 'Exif\0\0' (0x457869660000)
          if (view.getUint32(offset + 2, false) === 0x45786966 && view.getUint16(offset + 6, false) === 0x0000) {
            app1Found = true;
            exifOffset = offset + 8;
            break;
          }
          offset += app1Length;
        } else if ((marker & 0xff00) === 0xff00) {
          const markerLen = view.getUint16(offset, false);
          offset += markerLen;
        } else {
          break;
        }
      }

      if (!app1Found) {
        setExif({ hasGps: false, totalTagsCount: 0 });
        setIsInspecting(false);
        return;
      }

      // Read TIFF header
      const endianMarker = view.getUint16(exifOffset, false);
      const isLittleEndian = endianMarker === 0x4949; // 'II' = little endian, 'MM' = big endian

      const ifd0Offset = view.getUint32(exifOffset + 4, isLittleEndian);
      let currentOffset = exifOffset + ifd0Offset;

      const entriesCount = view.getUint16(currentOffset, isLittleEndian);
      currentOffset += 2;

      let make: string | undefined;
      let model: string | undefined;
      let software: string | undefined;
      let dateTime: string | undefined;
      let exifIfdOffset: number | undefined;
      let gpsIfdOffset: number | undefined;
      let tagCounter = 0;

      function readString(strOffset: number, len: number): string {
        let str = '';
        for (let i = 0; i < len; i++) {
          const charCode = view.getUint8(strOffset + i);
          if (charCode === 0) break;
          str += String.fromCharCode(charCode);
        }
        return str.trim();
      }

      for (let i = 0; i < entriesCount; i++) {
        const tag = view.getUint16(currentOffset, isLittleEndian);
        const count = view.getUint32(currentOffset + 4, isLittleEndian);
        const valOffset = currentOffset + 8;

        tagCounter++;

        if (tag === 0x010f) {
          // Make
          const strOff = exifOffset + view.getUint32(valOffset, isLittleEndian);
          make = readString(strOff, count);
        } else if (tag === 0x0110) {
          // Model
          const strOff = exifOffset + view.getUint32(valOffset, isLittleEndian);
          model = readString(strOff, count);
        } else if (tag === 0x0131) {
          // Software
          const strOff = count > 4 ? exifOffset + view.getUint32(valOffset, isLittleEndian) : valOffset;
          software = readString(strOff, count);
        } else if (tag === 0x0132) {
          // DateTime
          const strOff = exifOffset + view.getUint32(valOffset, isLittleEndian);
          dateTime = readString(strOff, count);
        } else if (tag === 0x8769) {
          // Exif IFD Pointer
          exifIfdOffset = exifOffset + view.getUint32(valOffset, isLittleEndian);
        } else if (tag === 0x8825) {
          // GPS IFD Pointer
          gpsIfdOffset = exifOffset + view.getUint32(valOffset, isLittleEndian);
        }

        currentOffset += 12;
      }

      // Read Exif Sub-IFD
      let exposureTime: string | undefined;
      let fNumber: string | undefined;
      let iso: number | undefined;
      let focalLength: string | undefined;
      let lensModel: string | undefined;

      if (exifIfdOffset && exifIfdOffset < length - 2) {
        const subCount = view.getUint16(exifIfdOffset, isLittleEndian);
        let subOff = exifIfdOffset + 2;

        for (let i = 0; i < subCount; i++) {
          const tag = view.getUint16(subOff, isLittleEndian);
          const count = view.getUint32(subOff + 4, isLittleEndian);
          const valOff = subOff + 8;
          tagCounter++;

          if (tag === 0x829a) {
            // Exposure Time
            const numOff = exifOffset + view.getUint32(valOff, isLittleEndian);
            const num = view.getUint32(numOff, isLittleEndian);
            const den = view.getUint32(numOff + 4, isLittleEndian);
            exposureTime = den > 1 ? `1/${Math.round(den / num)}s` : `${num}s`;
          } else if (tag === 0x829d) {
            // F-Number
            const numOff = exifOffset + view.getUint32(valOff, isLittleEndian);
            const num = view.getUint32(numOff, isLittleEndian);
            const den = view.getUint32(numOff + 4, isLittleEndian);
            fNumber = `f/${(num / den).toFixed(1)}`;
          } else if (tag === 0x8827) {
            // ISO
            iso = view.getUint16(valOff, isLittleEndian);
          } else if (tag === 0x920a) {
            // Focal Length
            const numOff = exifOffset + view.getUint32(valOff, isLittleEndian);
            const num = view.getUint32(numOff, isLittleEndian);
            const den = view.getUint32(numOff + 4, isLittleEndian);
            focalLength = `${(num / den).toFixed(1)} mm`;
          } else if (tag === 0xa434) {
            // LensModel
            const strOff = exifOffset + view.getUint32(valOff, isLittleEndian);
            lensModel = readString(strOff, count);
          }

          subOff += 12;
        }
      }

      // Read GPS IFD
      let hasGps = false;
      let latitude: number | undefined;
      let longitude: number | undefined;
      let latitudeDms: string | undefined;
      let longitudeDms: string | undefined;
      let altitude: number | undefined;

      if (gpsIfdOffset && gpsIfdOffset < length - 2) {
        hasGps = true;
        const gpsCount = view.getUint16(gpsIfdOffset, isLittleEndian);
        let gOff = gpsIfdOffset + 2;

        let latRef = 'N';
        let lonRef = 'E';
        let latParts: number[] = [];
        let lonParts: number[] = [];

        function readRational(rOff: number): number {
          const num = view.getUint32(rOff, isLittleEndian);
          const den = view.getUint32(rOff + 4, isLittleEndian);
          return den === 0 ? 0 : num / den;
        }

        for (let i = 0; i < gpsCount; i++) {
          const tag = view.getUint16(gOff, isLittleEndian);
          const valOff = gOff + 8;
          tagCounter++;

          if (tag === 0x0001) {
            // Lat Ref
            latRef = String.fromCharCode(view.getUint8(valOff));
          } else if (tag === 0x0002) {
            // Latitude Rational[3]
            const rOff = exifOffset + view.getUint32(valOff, isLittleEndian);
            latParts = [readRational(rOff), readRational(rOff + 8), readRational(rOff + 16)];
          } else if (tag === 0x0003) {
            // Lon Ref
            lonRef = String.fromCharCode(view.getUint8(valOff));
          } else if (tag === 0x0004) {
            // Longitude Rational[3]
            const rOff = exifOffset + view.getUint32(valOff, isLittleEndian);
            lonParts = [readRational(rOff), readRational(rOff + 8), readRational(rOff + 16)];
          } else if (tag === 0x0006) {
            // Altitude
            const rOff = exifOffset + view.getUint32(valOff, isLittleEndian);
            altitude = readRational(rOff);
          }

          gOff += 12;
        }

        if (latParts.length === 3 && lonParts.length === 3) {
          const latDec = latParts[0] + latParts[1] / 60 + latParts[2] / 3600;
          const lonDec = lonParts[0] + lonParts[1] / 60 + lonParts[2] / 3600;

          latitude = latRef === 'S' ? -latDec : latDec;
          longitude = lonRef === 'W' ? -lonDec : lonDec;

          latitudeDms = `${Math.floor(latParts[0])}° ${Math.floor(latParts[1])}' ${latParts[2].toFixed(1)}" ${latRef}`;
          longitudeDms = `${Math.floor(lonParts[0])}° ${Math.floor(lonParts[1])}' ${lonParts[2].toFixed(1)}" ${lonRef}`;
        }
      }

      setExif({
        hasGps: !!latitude && !!longitude,
        latitude,
        longitude,
        latitudeDms,
        longitudeDms,
        altitude,
        make,
        model,
        software,
        dateTime,
        exposureTime,
        fNumber,
        iso,
        focalLength,
        lensModel,
        totalTagsCount: tagCounter
      });
    } catch {
      // Fallback
      setExif({ hasGps: false, totalTagsCount: 0 });
    } finally {
      setIsInspecting(false);
    }
  }

  // Eradicate Metadata by 100% clean Canvas Rasterization
  async function eradicateMetadata() {
    if (!file || !imagePreviewUrl) return;
    setBusy(true);
    setStatusMsg(t('Stripping all EXIF, GPS, and device markers…'));
    setErrorMessage('');

    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(t('Failed to load image for sanitization.')));
        img.src = imagePreviewUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('Canvas initialization failed.'));

      // Draw original pixels
      ctx.drawImage(img, 0, 0);

      // Re-encode via canvas Blob (natively strips 100% of EXIF, GPS, and metadata)
      const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
      const quality = outputFormat === 'png' ? undefined : 0.94;

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), mime, quality);
      });

      const url = URL.createObjectURL(blob);
      setSanitizedBlob(blob);
      setSanitizedUrl(url);
      setSanitizedSize(blob.size);
      setStatusMsg(t('Metadata eradicated completely!'));
    } catch (err: any) {
      setErrorMessage(err.message || t('Sanitization failed.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadSanitizedImage() {
    if (!sanitizedBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const ext = outputFormat === 'png' ? 'png' : 'jpg';
    const a = document.createElement('a');
    a.href = sanitizedUrl;
    a.download = `${baseName}-sanitized.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace exifcleaner-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exifcleaner-title"
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
            {t('Private & Client-Side · 100% Metadata Eradication')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon amber">
            <ShieldAlert size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('EXIF & GEOTAG ERASER')}
              </span>
              <span className="hd-pill">PRIVACY SHIELD</span>
            </div>
            <h2 id="exifcleaner-title">{t('EXIF & Geotag Eraser')}</h2>
            <p>
              {t('Inspect and wipe hidden GPS coordinates, camera models, lens details, and timestamps before sharing photos online.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Zero Footprint · 100% In-Browser')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {sanitizedBlob ? t('SANITIZED PHOTO (METADATA STRIPPED)') : t('PHOTO INSPECTOR')}
              </span>
              <span>{file ? file.name : t('Select a photo')}</span>
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
                  <Camera size={34} />
                </div>
                <h3>{t('Drop photo to inspect & clean metadata')}</h3>
                <p>{t('Supports JPEG, PNG, and WebP. Discovers hidden GPS coordinates, camera specs, and dates.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select photo')}
                </span>
              </button>
            ) : (
              <div className="exif-stage-container">
                <div className="exif-image-preview-box">
                  <img
                    src={sanitizedUrl || imagePreviewUrl}
                    alt={file.name}
                    className="exif-preview-img"
                  />
                  {sanitizedBlob && (
                    <div className="sanitized-overlay-badge">
                      <ShieldCheck size={16} />
                      {t('100% Clean Image')}
                    </div>
                  )}
                </div>

                {/* Exif Security Findings Banner */}
                {exif && exif.hasGps && (
                  <div className="exif-warning-banner">
                    <AlertTriangle size={20} />
                    <div className="warning-text">
                      <strong>{t('GPS Coordinates Detected in Photo!')}</strong>
                      <p>
                        {t('This image exposes your location')}: {exif.latitudeDms}, {exif.longitudeDms}.
                      </p>
                    </div>
                    {exif.latitude && exif.longitude && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${exif.latitude}&mlon=${exif.longitude}#map=16/${exif.latitude}/${exif.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="map-view-btn"
                      >
                        <Globe size={14} />
                        {t('View on Map')}
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}

                {/* Detected Metadata Tags Grid */}
                {exif && (
                  <div className="metadata-cards-grid">
                    <div className="meta-card">
                      <div className="meta-card-title">
                        <MapPin size={16} />
                        <span>{t('GPS & Geotag Location')}</span>
                      </div>
                      <div className="meta-card-body">
                        {exif.hasGps ? (
                          <>
                            <div className="meta-item">
                              <span>{t('Latitude')}</span>
                              <strong className="coord-red">{exif.latitudeDms}</strong>
                            </div>
                            <div className="meta-item">
                              <span>{t('Longitude')}</span>
                              <strong className="coord-red">{exif.longitudeDms}</strong>
                            </div>
                            {exif.altitude !== undefined && (
                              <div className="meta-item">
                                <span>{t('Altitude')}</span>
                                <strong>{exif.altitude.toFixed(1)} m</strong>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="meta-none">
                            <Check size={14} />
                            {t('No GPS coordinates detected in this file.')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="meta-card">
                      <div className="meta-card-title">
                        <Camera size={16} />
                        <span>{t('Device & Camera Info')}</span>
                      </div>
                      <div className="meta-card-body">
                        {exif.make || exif.model || exif.software ? (
                          <>
                            {exif.make && (
                              <div className="meta-item">
                                <span>{t('Make')}</span>
                                <strong>{exif.make}</strong>
                              </div>
                            )}
                            {exif.model && (
                              <div className="meta-item">
                                <span>{t('Device Model')}</span>
                                <strong>{exif.model}</strong>
                              </div>
                            )}
                            {exif.software && (
                              <div className="meta-item">
                                <span>{t('Software')}</span>
                                <strong>{exif.software}</strong>
                              </div>
                            )}
                            {exif.lensModel && (
                              <div className="meta-item">
                                <span>{t('Lens Model')}</span>
                                <strong>{exif.lensModel}</strong>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="meta-none">
                            <Check size={14} />
                            {t('No device markers found.')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="meta-card">
                      <div className="meta-card-title">
                        <Eye size={16} />
                        <span>{t('Date & Exposure Settings')}</span>
                      </div>
                      <div className="meta-card-body">
                        {exif.dateTime || exif.iso || exif.exposureTime ? (
                          <>
                            {exif.dateTime && (
                              <div className="meta-item">
                                <span>{t('Captured Date')}</span>
                                <strong>{exif.dateTime}</strong>
                              </div>
                            )}
                            {exif.iso && (
                              <div className="meta-item">
                                <span>ISO</span>
                                <strong>{exif.iso}</strong>
                              </div>
                            )}
                            {exif.exposureTime && (
                              <div className="meta-item">
                                <span>{t('Shutter')}</span>
                                <strong>{exif.exposureTime}</strong>
                              </div>
                            )}
                            {exif.fNumber && (
                              <div className="meta-item">
                                <span>{t('Aperture')}</span>
                                <strong>{exif.fNumber}</strong>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="meta-none">
                            <Check size={14} />
                            {t('No exposure markers found.')}
                          </div>
                        )}
                      </div>
                    </div>
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

            <div className="control-group">
              <label>{t('Clean Output Format')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={outputFormat === 'jpeg' ? 'active' : ''}
                  onClick={() => setOutputFormat('jpeg')}
                >
                  JPEG (94% Quality)
                </button>
                <button
                  type="button"
                  className={outputFormat === 'png' ? 'active' : ''}
                  onClick={() => setOutputFormat('png')}
                >
                  PNG (Lossless)
                </button>
              </div>
            </div>

            <div className="control-group">
              <label>{t('Photo Summary')}</label>
              <div className="spec-card">
                <div className="spec-row">
                  <span>{t('Resolution')}</span>
                  <strong>{imageDimensions.width > 0 ? `${imageDimensions.width} × ${imageDimensions.height} px` : '-'}</strong>
                </div>
                <div className="spec-row">
                  <span>{t('Original Size')}</span>
                  <strong>{file ? `${(file.size / 1024).toFixed(1)} KB` : '-'}</strong>
                </div>
                {sanitizedSize > 0 && (
                  <div className="spec-row">
                    <span>{t('Cleaned Size')}</span>
                    <strong className="badge-green">{(sanitizedSize / 1024).toFixed(1)} KB</strong>
                  </div>
                )}
                <div className="spec-row">
                  <span>{t('Hidden Tags')}</span>
                  <strong>{exif ? `${exif.totalTagsCount} tags inspected` : '-'}</strong>
                </div>
              </div>
            </div>

            <button
              className="primary-action"
              disabled={!file || busy}
              onClick={eradicateMetadata}
            >
              {busy ? <RotateCw size={17} className="spin" /> : <Trash2 size={17} />}
              {busy ? statusMsg : t('Eradicate All Metadata')}
            </button>

            {sanitizedBlob && (
              <button className="download-btn-green" onClick={downloadSanitizedImage}>
                <Download size={18} />
                {t('Download Clean Image')}
              </button>
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
