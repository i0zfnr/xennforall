import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Download,
  Film,
  Image as ImageIcon,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Type,
  Upload,
  X
} from 'lucide-react';

interface VideoToGifToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function VideoToGifTool({ initialFiles = [], close }: VideoToGifToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(0);

  // Trimming & Settings
  const [startTime, setStartTime] = useState<number>(0);
  const [clipLength, setClipLength] = useState<number>(3.0); // max 8s
  const [fps, setFps] = useState<number>(12); // 10, 12, 15
  const [targetWidth, setTargetWidth] = useState<number>(400); // 320, 400, 480
  const [topText, setTopText] = useState<string>('');
  const [bottomText, setBottomText] = useState<string>('');

  // Processing state
  const [busy, setBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Result
  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [gifUrl, setGifUrl] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Cleanup URLs
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (gifUrl) URL.revokeObjectURL(gifUrl);
    };
  }, [videoUrl, gifUrl]);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    const valid = f.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(f.name);
    if (!valid) {
      setErrorMessage(t('Please select a valid video file (MP4, MOV, WebM).'));
      return;
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);

    const url = URL.createObjectURL(f);
    setFile(f);
    setVideoUrl(url);
    setGifBlob(null);
    setGifUrl('');

    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => {
      setVideoDuration(v.duration);
      setClipLength(Math.min(4.0, v.duration));
    };
  }

  // Pure Client-Side GIF89a LZW Encoder
  function encodeGif(frames: ImageData[], width: number, height: number, frameDelayMs: number): Blob {
    const bytes: number[] = [];

    function writeStr(s: string) {
      for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
    }

    function writeWord(w: number) {
      bytes.push(w & 0xff);
      bytes.push((w >> 8) & 0xff);
    }

    // 1. GIF Header
    writeStr('GIF89a');

    // 2. Logical Screen Descriptor
    writeWord(width);
    writeWord(height);
    bytes.push(0x70); // GCT Flag = 0, Color Res = 7 (8 bits), Sort = 0, GCT Size = 0
    bytes.push(0); // Background Color Index
    bytes.push(0); // Pixel Aspect Ratio

    // 3. Netscape Application Extension for infinite loop
    bytes.push(0x21); // Extension Introducer
    bytes.push(0xff); // App Extension Label
    bytes.push(11); // Block Size
    writeStr('NETSCAPE2.0');
    bytes.push(3); // Sub-block Size
    bytes.push(1);
    writeWord(0); // Loop count = 0 (infinite)
    bytes.push(0); // Block Terminator

    // Delay in 1/100ths of a second
    const delay = Math.max(2, Math.round(frameDelayMs / 10));

    // Encode each frame
    for (let f = 0; f < frames.length; f++) {
      const frameData = frames[f].data;

      // Build 64-color quantized palette for speed and clarity
      const palette: number[][] = [];
      const colorMap = new Map<number, number>();

      const indexedPixels = new Uint8Array(width * height);
      let pixelIndex = 0;

      for (let i = 0; i < frameData.length; i += 4) {
        // Quantize RGB to 4 bits per channel (4096 colors down to 64 palette)
        const r = (frameData[i] >> 4) << 4;
        const g = (frameData[i + 1] >> 4) << 4;
        const b = (frameData[i + 2] >> 4) << 4;
        const key = (r << 16) | (g << 8) | b;

        let palIdx = colorMap.get(key);
        if (palIdx === undefined) {
          if (palette.length < 64) {
            palIdx = palette.length;
            palette.push([r, g, b]);
            colorMap.set(key, palIdx);
          } else {
            // Map to nearest existing color
            palIdx = 0;
            let minDist = 999999;
            for (let p = 0; p < palette.length; p++) {
              const dr = r - palette[p][0];
              const dg = g - palette[p][1];
              const db = b - palette[p][2];
              const dist = dr * dr + dg * dg + db * db;
              if (dist < minDist) {
                minDist = dist;
                palIdx = p;
              }
            }
          }
        }
        indexedPixels[pixelIndex++] = palIdx;
      }

      // Pad palette to power of 2 (64 colors -> 2^6 = 64)
      const colorBits = 6;
      const paletteSize = 1 << colorBits;
      while (palette.length < paletteSize) {
        palette.push([0, 0, 0]);
      }

      // Graphic Control Extension
      bytes.push(0x21); // Extension Introducer
      bytes.push(0xf9); // Graphic Control Label
      bytes.push(4); // Block Size
      bytes.push(0); // Packed fields: disposal = 0, transparent = 0
      writeWord(delay);
      bytes.push(0); // Transparent Color Index
      bytes.push(0); // Block Terminator

      // Image Descriptor
      bytes.push(0x2c); // Image Separator
      writeWord(0); // Left position
      writeWord(0); // Top position
      writeWord(width);
      writeWord(height);
      // Local Color Table Flag (1), Interlace (0), Sort (0), Size (colorBits - 1)
      bytes.push(0x80 | (colorBits - 1));

      // Write Local Color Table (RGB bytes)
      for (let p = 0; p < palette.length; p++) {
        bytes.push(palette[p][0]);
        bytes.push(palette[p][1]);
        bytes.push(palette[p][2]);
      }

      // LZW Compression
      const minCodeSize = Math.max(2, colorBits);
      bytes.push(minCodeSize);

      const clearCode = 1 << minCodeSize;
      const eoiCode = clearCode + 1;

      let codeSize = minCodeSize + 1;
      let nextCode = clearCode + 2;
      const dict = new Map<string, number>();

      function resetDict() {
        dict.clear();
        codeSize = minCodeSize + 1;
        nextCode = clearCode + 2;
      }

      // Bit packing accumulator
      let curBits = 0;
      let curVal = 0;
      const subBlock: number[] = [];

      function writeBits(code: number) {
        curVal |= code << curBits;
        curBits += codeSize;
        while (curBits >= 8) {
          subBlock.push(curVal & 0xff);
          curVal >>= 8;
          curBits -= 8;
          if (subBlock.length === 255) {
            bytes.push(255);
            for (let k = 0; k < 255; k++) bytes.push(subBlock[k]);
            subBlock.length = 0;
          }
        }
      }

      function flushSubBlock() {
        if (curBits > 0) {
          subBlock.push(curVal & 0xff);
          curVal = 0;
          curBits = 0;
        }
        if (subBlock.length > 0) {
          bytes.push(subBlock.length);
          for (let k = 0; k < subBlock.length; k++) bytes.push(subBlock[k]);
          subBlock.length = 0;
        }
      }

      writeBits(clearCode);
      resetDict();

      let prefix = indexedPixels[0].toString();
      for (let i = 1; i < indexedPixels.length; i++) {
        const char = indexedPixels[i];
        const combined = `${prefix},${char}`;

        if (dict.has(combined)) {
          prefix = combined;
        } else {
          // Output prefix code
          if (prefix.includes(',')) {
            writeBits(dict.get(prefix)!);
          } else {
            writeBits(Number(prefix));
          }

          dict.set(combined, nextCode++);

          if (nextCode >= (1 << codeSize)) {
            if (codeSize < 12) {
              codeSize++;
            } else {
              writeBits(clearCode);
              resetDict();
            }
          }

          prefix = char.toString();
        }
      }

      // Flush final prefix
      if (prefix.includes(',')) {
        writeBits(dict.get(prefix)!);
      } else {
        writeBits(Number(prefix));
      }

      writeBits(eoiCode);
      flushSubBlock();
      bytes.push(0); // Frame block terminator
    }

    // 4. GIF Trailer
    bytes.push(0x3b);

    return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
  }

  // Generate Animated GIF from Video
  async function generateGif() {
    if (!file || !videoUrl) return;
    setBusy(true);
    setProgress(5);
    setProgressMsg(t('Seeking video frames…'));
    setErrorMessage('');

    try {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = videoUrl;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error(t('Failed to load video.')));
      });

      const aspect = video.videoHeight / (video.videoWidth || 1);
      const width = targetWidth;
      const height = Math.round(width * aspect);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('Canvas processing failed.'));

      const frameDelayMs = 1000 / fps;
      const totalFramesCount = Math.min(60, Math.floor(clipLength * fps));
      const frames: ImageData[] = [];

      for (let i = 0; i < totalFramesCount; i++) {
        const currentTime = startTime + (i / fps);
        if (currentTime > video.duration) break;

        setProgress(Math.round((i / totalFramesCount) * 75) + 5);
        setProgressMsg(`${t('Extracting frame')} ${i + 1} ${t('of')} ${totalFramesCount}…`);

        video.currentTime = currentTime;
        await new Promise<void>((res) => {
          video.onseeked = () => res();
        });

        // Draw frame
        ctx.drawImage(video, 0, 0, width, height);

        // Draw meme captions if present
        if (topText.trim()) {
          drawCaptionText(ctx, topText.trim().toUpperCase(), width / 2, 34, width - 20);
        }
        if (bottomText.trim()) {
          drawCaptionText(ctx, bottomText.trim().toUpperCase(), width / 2, height - 14, width - 20);
        }

        frames.push(ctx.getImageData(0, 0, width, height));
      }

      setProgress(85);
      setProgressMsg(t('Compressing GIF palette and LZW dictionary…'));

      const blob = encodeGif(frames, width, height, frameDelayMs);
      const url = URL.createObjectURL(blob);
      setGifBlob(blob);
      setGifUrl(url);

      setProgress(100);
      setProgressMsg(t('Animated GIF created!'));
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to generate GIF.'));
    } finally {
      setBusy(false);
    }
  }

  function drawCaptionText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
    ctx.save();
    ctx.font = '900 24px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(text, x, y, maxW);
    ctx.fillText(text, x, y, maxW);
    ctx.restore();
  }

  function downloadGif() {
    if (!gifBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = gifUrl;
    a.download = `${baseName}-animated.gif`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace videotogif-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="videotogif-title"
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
            {t('Private & Client-Side · In-Browser LZW GIF Encoder')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon orange">
            <Film size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Video tools')} <span>/</span> {t('ANIMATED GIF & STICKER MAKER')}
              </span>
              <span className="hd-pill">MEME & STICKER</span>
            </div>
            <h2 id="videotogif-title">{t('Video to Animated GIF & Sticker Maker')}</h2>
            <p>
              {t('Turn video clips into smooth animated GIFs or meme stickers with captions directly in your browser.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Instant Preview · Infinite Loops')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {gifBlob ? t('ANIMATED GIF PREVIEW') : t('VIDEO TRIMMER')}
              </span>
              <span>{file ? file.name : t('Select a video')}</span>
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
                  <Film size={34} />
                </div>
                <h3>{t('Drop video file here to make a GIF')}</h3>
                <p>{t('Supports MP4, MOV, WebM, and MKV. Fast client-side rendering with zero watermarks.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select video')}
                </span>
              </button>
            ) : gifBlob ? (
              <div className="gif-result-wrap">
                <img src={gifUrl} alt="Generated GIF" className="gif-result-element" />
                <div className="gif-badge-info">
                  <Check size={16} />
                  <span>
                    GIF Ready! Size: {((gifBlob.size / 1024 / 1024) > 1 ? `${(gifBlob.size / 1024 / 1024).toFixed(2)} MB` : `${(gifBlob.size / 1024).toFixed(1)} KB`)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="gif-trimmer-wrap">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="preview-video-element"
                />
              </div>
            )}
          </div>

          {/* Controls Sidebar */}
          <div className="workspace-controls">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="video/*,.mp4,.mov,.webm,.mkv"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {/* Trimming sliders */}
            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Start Time')}</span>
                <span>{startTime.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(0, videoDuration - 1)}
                step="0.5"
                value={startTime}
                disabled={busy || !file}
                onChange={(e) => setStartTime(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Clip Duration')}</span>
                <span>{clipLength.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="1"
                max={Math.min(6, Math.max(1, videoDuration - startTime))}
                step="0.5"
                value={clipLength}
                disabled={busy || !file}
                onChange={(e) => setClipLength(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>{t('Resolution')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={targetWidth === 320 ? 'active' : ''}
                  onClick={() => setTargetWidth(320)}
                >
                  320px (Mini)
                </button>
                <button
                  type="button"
                  className={targetWidth === 400 ? 'active' : ''}
                  onClick={() => setTargetWidth(400)}
                >
                  400px (Std)
                </button>
                <button
                  type="button"
                  className={targetWidth === 480 ? 'active' : ''}
                  onClick={() => setTargetWidth(480)}
                >
                  480px (HD)
                </button>
              </div>
            </div>

            <div className="control-group">
              <label>{t('Meme Text Captions (Optional)')}</label>
              <input
                type="text"
                placeholder={t('Top caption…')}
                value={topText}
                onChange={(e) => setTopText(e.target.value)}
                className="qr-input"
              />
              <input
                type="text"
                placeholder={t('Bottom caption…')}
                value={bottomText}
                onChange={(e) => setBottomText(e.target.value)}
                className="qr-input"
                style={{ marginTop: '8px' }}
              />
            </div>

            <button
              className="primary-action"
              disabled={!file || busy}
              onClick={generateGif}
            >
              {busy ? <RotateCw size={17} className="spin" /> : <Film size={17} />}
              {busy ? progressMsg : t('Create Animated GIF')}
            </button>

            {gifBlob && (
              <button className="download-btn-green" onClick={downloadGif}>
                <Download size={18} />
                {t('Download Animated GIF')}
              </button>
            )}

            {file && (
              <button
                className="btn-change-file"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Change video')}
              </button>
            )}

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
