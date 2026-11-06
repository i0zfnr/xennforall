import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowDownToLine,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  Image as ImageIcon,
  Info,
  Play,
  Pause,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Video,
  X
} from 'lucide-react';
import JSZip from 'jszip';

interface LivePhotoToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function LivePhotoTool({ initialFiles = [], close }: LivePhotoToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Settings
  const [keyFrameTime, setKeyFrameTime] = useState<number>(0);
  const [motionStartTime, setMotionStartTime] = useState<number>(0);
  const [motionDuration, setMotionDuration] = useState<number>(3.0);
  const [framing, setFraming] = useState<'blur' | 'letterbox' | 'original'>('blur');

  // Preview & Processing state
  const [keyFrameBlob, setKeyFrameBlob] = useState<Blob | null>(null);
  const [keyFrameUrl, setKeyFrameUrl] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Results
  const [livePhotoZip, setLivePhotoZip] = useState<{ blob: Blob; filename: string } | null>(null);
  const [motionVideoBlob, setMotionVideoBlob] = useState<Blob | null>(null);
  const [motionVideoUrl, setMotionVideoUrl] = useState<string>('');
  const [showGuide, setShowGuide] = useState<boolean>(true);

  // Hidden DOM elements
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const snapshotCanvasRef = useRef<HTMLCanvasElement>(null);

  // Keyboard accessibility and modal lock
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

  function handleFileSelected(selectedFile?: File) {
    if (!selectedFile) return;
    setErrorMessage('');
    setStatusMessage('');
    setLivePhotoZip(null);
    setMotionVideoBlob(null);
    setMotionVideoUrl('');

    const isVideo = selectedFile.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(selectedFile.name);
    if (!isVideo) {
      setErrorMessage(t('Please choose a video file (MP4, MOV, or WebM).'));
      return;
    }

    if (selectedFile.size > 250 * 1024 * 1024) {
      setErrorMessage(t('File size exceeds 250 MB limit.'));
      return;
    }

    setFile(selectedFile);
    const tempUrl = URL.createObjectURL(selectedFile);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = tempUrl;
    v.onloadedmetadata = () => {
      const dur = v.duration || 0;
      setVideoDuration(dur);
      setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
      setKeyFrameTime(Math.min(0.5, dur));
      setMotionStartTime(0);
      setMotionDuration(Math.min(3.0, dur));
      URL.revokeObjectURL(tempUrl);
      extractKeyFrameSnapshot(selectedFile, Math.min(0.5, dur));
    };
    v.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      setErrorMessage(t('Could not read video metadata. Please verify file format.'));
    };
  }

  // Extract high-resolution still frame snapshot at specific time
  async function extractKeyFrameSnapshot(videoFile: File, atTime: number) {
    const v = document.createElement('video');
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    const tempUrl = URL.createObjectURL(videoFile);
    v.src = tempUrl;

    await new Promise<void>((resolve) => {
      v.onloadedmetadata = () => resolve();
    });

    v.currentTime = atTime;
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
    });

    const canvas = document.createElement('canvas');
    let targetW = 1080;
    let targetH = 1920;

    if (framing === 'original') {
      targetW = v.videoWidth;
      targetH = v.videoHeight;
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (framing === 'blur' && (targetW !== v.videoWidth || targetH !== v.videoHeight)) {
      ctx.save();
      ctx.filter = 'blur(28px) brightness(0.65)';
      const bgScale = Math.max(targetW / v.videoWidth, targetH / v.videoHeight);
      const bgW = v.videoWidth * bgScale;
      const bgH = v.videoHeight * bgScale;
      ctx.drawImage(v, (targetW - bgW) / 2, (targetH - bgH) / 2, bgW, bgH);
      ctx.restore();

      const fgScale = Math.min(targetW / v.videoWidth, targetH / v.videoHeight);
      const fgW = v.videoWidth * fgScale;
      const fgH = v.videoHeight * fgScale;
      ctx.drawImage(v, (targetW - fgW) / 2, (targetH - fgH) / 2, fgW, fgH);
    } else if (framing === 'letterbox') {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, targetW, targetH);
      const fgScale = Math.min(targetW / v.videoWidth, targetH / v.videoHeight);
      const fgW = v.videoWidth * fgScale;
      const fgH = v.videoHeight * fgScale;
      ctx.drawImage(v, (targetW - fgW) / 2, (targetH - fgH) / 2, fgW, fgH);
    } else {
      ctx.drawImage(v, 0, 0, targetW, targetH);
    }

    canvas.toBlob(
      (b) => {
        if (b) {
          if (keyFrameUrl) URL.revokeObjectURL(keyFrameUrl);
          const newUrl = URL.createObjectURL(b);
          setKeyFrameBlob(b);
          setKeyFrameUrl(newUrl);
        }
        URL.revokeObjectURL(tempUrl);
      },
      'image/jpeg',
      0.95
    );
  }

  // Generate 9:16 Lock Screen Motion Clip and Live Photo Bundle
  async function generateLivePhotoBundle() {
    if (!file) return;
    setBusy(true);
    setErrorMessage('');
    setStatusMessage(t('Rendering 9:16 motion wallpaper clip…'));
    setProgress(15);

    const videoUrl = URL.createObjectURL(file);
    const sourceVideo = document.createElement('video');
    sourceVideo.playsInline = true;
    sourceVideo.crossOrigin = 'anonymous';
    sourceVideo.preload = 'auto';

    try {
      await new Promise<void>((resolve, reject) => {
        sourceVideo.onloadedmetadata = () => resolve();
        sourceVideo.onerror = () => reject(new Error(t('Could not load source video.')));
        sourceVideo.src = videoUrl;
      });

      const startTime = motionStartTime;
      const endTime = Math.min(startTime + motionDuration, sourceVideo.duration);
      const clipDuration = Math.max(0.1, endTime - startTime);

      let targetW = 1080;
      let targetH = 1920;

      if (framing === 'original') {
        targetW = Math.round(sourceVideo.videoWidth / 2) * 2;
        targetH = Math.round(sourceVideo.videoHeight / 2) * 2;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error(t('Canvas rendering context unavailable.'));

      // Silent Audio Capture Setup
      let audioTrack: MediaStreamTrack | null = null;
      let audioCtx: AudioContext | null = null;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
          const sourceNode = audioCtx.createMediaElementSource(sourceVideo);
          const destNode = audioCtx.createMediaStreamDestination();
          sourceNode.connect(destNode);
          const tracks = destNode.stream.getAudioTracks();
          if (tracks && tracks.length > 0) audioTrack = tracks[0];
        }
      } catch {
        sourceVideo.muted = true;
      }

      const canvasStream = canvas.captureStream(30);
      const tracks: MediaStreamTrack[] = [canvasStream.getVideoTracks()[0]];
      if (audioTrack) tracks.push(audioTrack);
      const combinedStream = new MediaStream(tracks);

      // MediaRecorder configuration
      const recorderMime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4;codecs=avc1'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: recorderMime,
        videoBitsPerSecond: 4500000 // 4.5 Mbps crisp motion
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      // Seek to start position
      sourceVideo.currentTime = startTime;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          sourceVideo.removeEventListener('seeked', onSeeked);
          resolve();
        };
        sourceVideo.addEventListener('seeked', onSeeked);
      });

      let animId = 0;
      let isDone = false;

      function drawFrame() {
        if (isDone || !ctx) return;

        if (framing === 'blur') {
          ctx.save();
          ctx.filter = 'blur(28px) brightness(0.65)';
          const bgScale = Math.max(targetW / sourceVideo.videoWidth, targetH / sourceVideo.videoHeight);
          const bgW = sourceVideo.videoWidth * bgScale;
          const bgH = sourceVideo.videoHeight * bgScale;
          ctx.drawImage(sourceVideo, (targetW - bgW) / 2, (targetH - bgH) / 2, bgW, bgH);
          ctx.restore();

          const fgScale = Math.min(targetW / sourceVideo.videoWidth, targetH / sourceVideo.videoHeight);
          const fgW = sourceVideo.videoWidth * fgScale;
          const fgH = sourceVideo.videoHeight * fgScale;
          ctx.drawImage(sourceVideo, (targetW - fgW) / 2, (targetH - fgH) / 2, fgW, fgH);
        } else if (framing === 'letterbox') {
          ctx.fillStyle = '#050505';
          ctx.fillRect(0, 0, targetW, targetH);
          const fgScale = Math.min(targetW / sourceVideo.videoWidth, targetH / sourceVideo.videoHeight);
          const fgW = sourceVideo.videoWidth * fgScale;
          const fgH = sourceVideo.videoHeight * fgScale;
          ctx.drawImage(sourceVideo, (targetW - fgW) / 2, (targetH - fgH) / 2, fgW, fgH);
        } else {
          ctx.drawImage(sourceVideo, 0, 0, targetW, targetH);
        }

        const elapsed = sourceVideo.currentTime - startTime;
        const pct = Math.min(90, Math.round(15 + (elapsed / clipDuration) * 75));
        setProgress(pct);

        if (sourceVideo.currentTime >= endTime || sourceVideo.ended) {
          isDone = true;
          cancelAnimationFrame(animId);
          sourceVideo.pause();
          recorder.stop();
          return;
        }

        animId = requestAnimationFrame(drawFrame);
      }

      recorder.start(100);
      await sourceVideo.play().catch(() => {
        sourceVideo.muted = true;
        return sourceVideo.play();
      });

      animId = requestAnimationFrame(drawFrame);

      const motionBlob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: recorderMime });
          resolve(finalBlob);
        };
      });

      if (audioCtx && audioCtx.state !== 'closed') {
        try {
          audioCtx.close();
        } catch {}
      }

      setProgress(95);
      setStatusMessage(t('Packaging Live Photo bundle…'));

      const motionUrl = URL.createObjectURL(motionBlob);
      setMotionVideoBlob(motionBlob);
      setMotionVideoUrl(motionUrl);

      // Package into ZIP
      const zip = new JSZip();
      const ext = recorderMime.includes('mp4') ? 'mp4' : 'webm';

      if (keyFrameBlob) {
        zip.file('key-photo.jpg', keyFrameBlob);
      }
      zip.file(`motion-wallpaper.${ext}`, motionBlob);

      const instructions = `XENN FOR ALL - LIVE PHOTO & LOCK SCREEN WALLPAPER GUIDE
==============================================================

Files included:
1. key-photo.jpg        -> High-res still cover photo (1080x1920)
2. motion-wallpaper.${ext} -> 9:16 vertical motion wallpaper clip

HOW TO USE ON IPHONE (iOS 16, 17, 18):
1. Save 'motion-wallpaper.${ext}' to your iPhone Photos app.
2. In the Photos app, open the video and tap the Share button (square with arrow).
3. Scroll down and tap 'Use as Wallpaper'.
4. Ensure the Live Photo / Motion icon at the bottom-left is turned ON.
5. Tap 'Add' to set as your Lock Screen!

HOW TO USE ON ANDROID (Samsung, Xiaomi, Pixel, OnePlus):
1. Save 'motion-wallpaper.${ext}' to your Gallery.
2. Long press on your Home Screen -> 'Wallpaper & style'.
3. Tap 'Change wallpapers' -> 'Gallery' -> select 'motion-wallpaper.${ext}'.
4. Tap 'Set on Lock Screen'.

Processed 100% locally on your device with Xenn for all.`;

      zip.file('README-HOW-TO-SET-WALLPAPER.txt', instructions);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      setLivePhotoZip({ blob: zipBlob, filename: 'live-photo-wallpaper-bundle.zip' });

      setProgress(100);
      setStatusMessage(t('Live Photo & motion wallpaper ready!'));
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to generate Live Photo motion clip.'));
    } finally {
      URL.revokeObjectURL(videoUrl);
      setBusy(false);
    }
  }

  function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const hasResult = !!livePhotoZip;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace livephoto-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="livephoto-title"
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
            {t('Private & In-Browser · 9:16 Motion Wallpaper')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon violet">
            <Sparkles size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('VIDEO TO LIVE PHOTO')}
              </span>
              <span className="hd-pill">WALLPAPER</span>
            </div>
            <h2 id="livephoto-title">{t('Video to Live Photo & Motion Wallpaper')}</h2>
            <p>
              {t('Turn any video or TikTok clip into an iPhone Live Photo, 9:16 lock screen motion wallpaper, or crisp still photo.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% Client-Side')}
          </span>
        </div>

        {/* Steps */}
        <ol className="workspace-steps" aria-label={t('Tool progress')}>
          {[t('Choose video'), t('Frame & pick cover photo'), t('Download Live Wallpaper')].map((s, i) => (
            <li
              key={s}
              className={
                (hasResult ? 2 : busy ? 1 : 0) === i
                  ? 'current'
                  : (hasResult ? 2 : busy ? 1 : 0) > i
                  ? 'complete'
                  : ''
              }
            >
              <span className="step-number">{i + 1}</span>
              <span>
                <b>{s}</b>
              </span>
              {i < 2 && <span className="step-connector" />}
            </li>
          ))}
        </ol>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {hasResult ? t('LOCK SCREEN PREVIEW') : t('SOURCE VIDEO')}
              </span>
              <span>{file?.name || t('Select video')}</span>
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
                <span className="empty-file-art">
                  <span className="empty-paper back-paper" />
                  <span className="empty-paper">
                    <Sparkles size={38} />
                  </span>
                </span>
                <strong>{t('Select your video or clip')}</strong>
                <span>{t('Drop an MP4, MOV, or WebM clip here to turn it into a Live Photo.')}</span>
                <span className="empty-upload">
                  <Upload size={16} />
                  {t('Choose video')}
                </span>
                <small>{t('MP4, MOV, WebM · Up to 250 MB')}</small>
              </button>
            ) : hasResult ? (
              <div className="livephoto-result-stage">
                <div className="phone-mockup-wrapper">
                  <div className="phone-screen">
                    {motionVideoUrl ? (
                      <video src={motionVideoUrl} controls autoPlay loop playsInline />
                    ) : keyFrameUrl ? (
                      <img src={keyFrameUrl} alt={t('Key photo cover')} />
                    ) : null}
                    <div className="status-overlay-chip">
                      <span>9:16 Motion Wallpaper</span>
                      <strong>Ready for Lock Screen</strong>
                    </div>
                  </div>
                </div>

                <div className="result-actions-bar">
                  <button
                    className="primary"
                    onClick={() => downloadFile(livePhotoZip!.blob, livePhotoZip!.filename)}
                  >
                    <Archive size={17} />
                    {t('Download Live Photo Pack (.ZIP)')}
                  </button>

                  {keyFrameBlob && (
                    <button
                      className="secondary-btn"
                      onClick={() => downloadFile(keyFrameBlob, 'key-photo.jpg')}
                    >
                      <Camera size={16} />
                      {t('Download Key Photo Only')}
                    </button>
                  )}

                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setLivePhotoZip(null);
                      setMotionVideoBlob(null);
                      setMotionVideoUrl('');
                    }}
                  >
                    <RotateCw size={15} />
                    {t('Adjust timing')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="livephoto-editor-stage">
                {/* Visual Video & Key Frame Scrub Stage */}
                <div className="editor-visual-row">
                  <div className="phone-mockup-wrapper mini-mockup">
                    <div className="phone-screen">
                      {keyFrameUrl ? (
                        <img src={keyFrameUrl} alt={t('Key frame preview')} />
                      ) : (
                        <div className="mockup-placeholder">{t('Loading frame…')}</div>
                      )}
                      <div className="status-overlay-chip">
                        <span>Cover Frame</span>
                        <strong>{keyFrameTime.toFixed(1)}s</strong>
                      </div>
                    </div>
                  </div>

                  <div className="scrubber-card">
                    <div className="scrubber-header">
                      <Camera size={18} />
                      <div>
                        <strong>{t('Select Cover / Key Photo Frame')}</strong>
                        <p>{t('Drag the scrubber to pick the crisp still photo seen before the animation plays.')}</p>
                      </div>
                    </div>

                    <div className="timeline-control">
                      <input
                        type="range"
                        min="0"
                        max={videoDuration || 1}
                        step="0.05"
                        value={keyFrameTime}
                        disabled={busy}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setKeyFrameTime(val);
                          if (file) extractKeyFrameSnapshot(file, val);
                        }}
                        className="timeline-slider"
                      />
                      <div className="timeline-labels">
                        <span>0:00</span>
                        <span>{keyFrameTime.toFixed(1)}s</span>
                        <span>{videoDuration.toFixed(1)}s</span>
                      </div>
                    </div>

                    <div className="motion-range-box">
                      <Film size={16} />
                      <span>
                        Motion Range: <strong>{motionStartTime.toFixed(1)}s</strong> to{' '}
                        <strong>{(motionStartTime + motionDuration).toFixed(1)}s</strong> ({motionDuration.toFixed(1)}s loop)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lock Screen Setup Guide */}
                <div className="hd-trick-card">
                  <div className="trick-header" onClick={() => setShowGuide(!showGuide)}>
                    <div className="trick-title">
                      <Smartphone size={17} />
                      <span>{t('How to set Live Photo on iPhone & Android')}</span>
                    </div>
                    <button className="icon-button" aria-label={showGuide ? t('Collapse guide') : t('Expand guide')}>
                      {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  {showGuide && (
                    <ol className="trick-steps">
                      <li>
                        <strong>{t('iPhone')}:</strong> {t('Open the downloaded motion video in Photos, tap Share, tap "Use as Wallpaper", ensure the Motion icon is ON, and tap Set.')}
                      </li>
                      <li>
                        <strong>{t('Android')}:</strong> {t('Open Gallery, select the video, tap the 3 dots or Share, and tap "Set as Lock screen wallpaper".')}
                      </li>
                    </ol>
                  )}
                </div>
              </div>
            )}

            <div className="canvas-footer">
              <ShieldCheck size={14} />
              {t('Processing occurs locally in your browser. Zero bytes uploaded.')}
            </div>
          </div>

          {/* Controls Sidebar */}
          <aside className="workspace-controls" aria-label={t('Live Photo settings')}>
            <div className="controls-section">
              <div className="controls-heading">
                <h3>{t('Source video')}</h3>
              </div>
              <p className="controls-description">
                {file
                  ? `${file.name} (${videoDimensions.width}×${videoDimensions.height} · ${videoDuration.toFixed(1)}s)`
                  : t('Choose a video to convert.')}
              </p>
              <button
                className="dropzone workspace-upload"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={17} />
                <b>{file ? t('Choose a different video') : t('Select video')}</b>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="video/*,.mp4,.mov,.webm,.m4v"
                onChange={(e) => {
                  handleFileSelected(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="controls-section settings-section">
              <div className="controls-heading">
                <h3>{t('Wallpaper settings')}</h3>
              </div>

              <label className="field">
                {t('Screen framing')}
                <select
                  value={framing}
                  disabled={busy}
                  onChange={(e) => {
                    const next = e.target.value as any;
                    setFraming(next);
                    if (file) extractKeyFrameSnapshot(file, keyFrameTime);
                  }}
                >
                  <option value="blur">{t('9:16 Vertical with Blurred Backdrop (Recommended)')}</option>
                  <option value="letterbox">{t('9:16 Vertical with Black Letterbox')}</option>
                  <option value="original">{t('Original Video Aspect Ratio')}</option>
                </select>
                <small>{t('9:16 perfectly fits iPhone and Android lock screens without clipping.')}</small>
              </label>

              <label className="field">
                {t('Motion animation length')}
                <select
                  value={motionDuration}
                  disabled={busy}
                  onChange={(e) => setMotionDuration(parseFloat(e.target.value))}
                >
                  <option value="1.5">1.5s (Quick Live Photo)</option>
                  <option value="2.5">2.5s (Standard Live Photo)</option>
                  <option value="3.5">3.5s (Smooth Motion Loop)</option>
                  <option value="5.0">5.0s (Extended Wallpaper)</option>
                </select>
              </label>

              <label className="field">
                {t('Motion start time')}
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, videoDuration - motionDuration)}
                  step="0.5"
                  value={motionStartTime}
                  disabled={busy}
                  onChange={(e) => setMotionStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                />
                <small>{t('Where the motion loop begins in the video.')}</small>
              </label>
            </div>

            {/* Action Area */}
            <div className={`workspace-action ${hasResult ? 'action-complete' : ''}`}>
              {errorMessage && (
                <p className="error" role="alert">
                  {errorMessage}
                </p>
              )}

              {statusMessage && (
                <div className="status-progress-box">
                  <p className="status" role="status">
                    {busy ? <span className="spinner" /> : hasResult ? <Check size={16} /> : null}
                    {statusMessage}
                  </p>
                  {busy && progress > 0 && (
                    <div className="transcode-bar">
                      <div className="transcode-fill" style={{ width: `${progress}%` }} />
                      <span className="transcode-pct">{progress}%</span>
                    </div>
                  )}
                </div>
              )}

              {hasResult ? (
                <button
                  className="primary full"
                  onClick={() => downloadFile(livePhotoZip!.blob, livePhotoZip!.filename)}
                >
                  <ArrowDownToLine size={18} />
                  {t('Download Live Photo Pack (.ZIP)')}
                </button>
              ) : (
                <button
                  className="primary full"
                  disabled={!file || busy}
                  onClick={generateLivePhotoBundle}
                >
                  {busy ? t('Rendering wallpaper…') : t('Create Live Photo Wallpaper')}
                  <ArrowRight size={17} />
                </button>
              )}

              <div className="dialog-privacy">
                <ShieldCheck size={13} />
                {t('No server upload · Processed 100% on device')}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
