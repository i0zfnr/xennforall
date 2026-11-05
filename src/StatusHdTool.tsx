import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowDownToLine,
  ArrowRight,
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
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap
} from 'lucide-react';
import JSZip from 'jszip';

interface StatusPart {
  partIndex: number;
  label: string;
  blob: Blob;
  url: string;
  duration: number;
  size: number;
}

interface StatusHdToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function StatusHdTool({ initialFiles = [], close }: StatusHdToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Settings
  const [videoPreset, setVideoPreset] = useState<'720p' | '1080p' | 'original'>('720p');
  const [compressionPreset, setCompressionPreset] = useState<'sweetspot' | 'ultralight' | 'maxdetail'>('sweetspot');
  const [videoFraming, setVideoFraming] = useState<'blur' | 'letterbox' | 'fill' | 'original'>('blur');
  const [videoSplitMode, setVideoSplitMode] = useState<'split' | 'first30' | 'full'>('split');
  const [imageFraming, setImageFraming] = useState<'blur' | 'letterbox' | 'original'>('blur');
  const [imageSharpen, setImageSharpen] = useState<boolean>(true);

  // Processing state
  const [busy, setBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressDetails, setProgressDetails] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Results
  const [resultParts, setResultParts] = useState<StatusPart[]>([]);
  const [singleImageResult, setSingleImageResult] = useState<{ blob: Blob; url: string; size: number } | null>(null);
  const [activePartPreview, setActivePartPreview] = useState<number>(0);
  const [showHdTrickGuide, setShowHdTrickGuide] = useState<boolean>(true);

  // Hidden stage elements
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Track created blob URLs for cleanup
  const blobUrlsRef = useRef<string[]>([]);
  const registerUrl = (url: string) => {
    blobUrlsRef.current.push(url);
    return url;
  };

  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

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

  // Ingest initial file if provided
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(selectedFile?: File) {
    if (!selectedFile) return;
    setErrorMessage('');
    setStatusMessage('');
    setProgress(0);
    setProgressDetails('');
    setResultParts([]);
    setSingleImageResult(null);

    const isVideo = selectedFile.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(selectedFile.name);
    const isImage = selectedFile.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(selectedFile.name);

    if (!isVideo && !isImage) {
      setErrorMessage(t('Please choose a video (MP4, MOV, WebM) or photo (JPG, PNG, WebP).'));
      return;
    }

    if (selectedFile.size > 250 * 1024 * 1024) {
      setErrorMessage(t('File size exceeds 250 MB limit for in-browser processing.'));
      return;
    }

    setFile(selectedFile);

    if (isVideo) {
      setMediaType('video');
      const tempUrl = URL.createObjectURL(selectedFile);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = tempUrl;
      v.onloadedmetadata = () => {
        setVideoDuration(v.duration || 0);
        setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
        URL.revokeObjectURL(tempUrl);
      };
      v.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        setErrorMessage(t('Could not read video metadata. Please verify file format.'));
      };
    } else {
      setMediaType('image');
      const tempUrl = URL.createObjectURL(selectedFile);
      const img = new Image();
      img.src = tempUrl;
      img.onload = () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(tempUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        setErrorMessage(t('Could not load image file. Please verify file format.'));
      };
    }
  }

  // Sharpening filter using 3x3 convolution
  function applyUnsharpClarity(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number = 0.3) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const copy = new Uint8ClampedArray(data);
      const k = amount;

      for (let y = 1; y < height - 1; y++) {
        const row = y * width * 4;
        const upRow = (y - 1) * width * 4;
        const downRow = (y + 1) * width * 4;

        for (let x = 1; x < width - 1; x++) {
          const idx = row + x * 4;
          for (let c = 0; c < 3; c++) {
            const val = copy[idx + c];
            const up = copy[upRow + x * 4 + c];
            const down = copy[downRow + x * 4 + c];
            const left = copy[row + (x - 1) * 4 + c];
            const right = copy[row + (x + 1) * 4 + c];
            const laplacian = 4 * val - (up + down + left + right);
            const sharpened = val + laplacian * k;
            data[idx + c] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Ignore if canvas tainted or restricted
    }
  }

  // Optimize Image for WhatsApp Status
  async function processImage() {
    if (!file) return;
    setBusy(true);
    setErrorMessage('');
    setStatusMessage(t('Optimizing image for WhatsApp Status…'));
    setProgress(20);

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      await img.decode();
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('Canvas rendering context is unavailable.'));

      // Determine dimensions
      let targetW = 1080;
      let targetH = 1920;

      if (imageFraming === 'original') {
        // Fit within max 1080x1920 keeping aspect ratio
        const scale = Math.min(1080 / img.naturalWidth, 1920 / img.naturalHeight, 1);
        targetW = Math.round(img.naturalWidth * scale);
        targetH = Math.round(img.naturalHeight * scale);
      }

      canvas.width = targetW;
      canvas.height = targetH;

      setProgress(50);

      if (imageFraming === 'blur' && (targetW !== img.naturalWidth || targetH !== img.naturalHeight)) {
        // Pass 1: Blurred background wings
        ctx.save();
        ctx.filter = 'blur(28px) brightness(0.65)';
        const bgScale = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);
        const bgW = img.naturalWidth * bgScale;
        const bgH = img.naturalHeight * bgScale;
        const bgX = (targetW - bgW) / 2;
        const bgY = (targetH - bgH) / 2;
        ctx.drawImage(img, bgX, bgY, bgW, bgH);
        ctx.restore();

        // Pass 2: Centered crisp foreground
        const fgScale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
        const fgW = img.naturalWidth * fgScale;
        const fgH = img.naturalHeight * fgScale;
        const fgX = (targetW - fgW) / 2;
        const fgY = (targetH - fgH) / 2;
        ctx.drawImage(img, fgX, fgY, fgW, fgH);
      } else if (imageFraming === 'letterbox') {
        ctx.fillStyle = '#0a0d0b';
        ctx.fillRect(0, 0, targetW, targetH);
        const fgScale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
        const fgW = img.naturalWidth * fgScale;
        const fgH = img.naturalHeight * fgScale;
        const fgX = (targetW - fgW) / 2;
        const fgY = (targetH - fgH) / 2;
        ctx.drawImage(img, fgX, fgY, fgW, fgH);
      } else {
        ctx.drawImage(img, 0, 0, targetW, targetH);
      }

      // Edge clarity pass
      if (imageSharpen) {
        setProgress(75);
        applyUnsharpClarity(ctx, targetW, targetH, 0.28);
      }

      setProgress(90);

      // Export as high quality JPEG (WhatsApp sweet spot quality: 0.88 keeps size well under 1MB)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(t('Failed to create optimized image.')))),
          'image/jpeg',
          0.88
        );
      });

      const url = registerUrl(URL.createObjectURL(blob));
      setSingleImageResult({ blob, url, size: blob.size });
      setStatusMessage(t('Status image ready. Edge clarity preserved.'));
      setProgress(100);
    } catch (err: any) {
      setErrorMessage(err.message || t('Error optimizing image.'));
    } finally {
      setBusy(false);
    }
  }

  // Detect supported video mime type
  function getOptimalVideoMime(): { mimeType: string; ext: string } {
    const list = [
      { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
      { mimeType: 'video/mp4;codecs=avc1', ext: 'mp4' },
      { mimeType: 'video/mp4', ext: 'mp4' },
      { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
      { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
      { mimeType: 'video/webm', ext: 'webm' }
    ];

    for (const item of list) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(item.mimeType)) {
        return item;
      }
    }
    return { mimeType: '', ext: 'mp4' };
  }

  // Transcode Video slice (startTime to endTime) with 100% SILENT speaker audio routing
  async function transcodeSlice(
    videoUrl: string,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    startTime: number,
    endTime: number,
    targetW: number,
    targetH: number,
    bitrate: number,
    framing: string,
    sliceLabel: string,
    onProgressUpdate: (pct: number, elapsed: number, total: number) => void
  ): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      // Create a fresh dedicated video element for this slice
      const sourceVideo = document.createElement('video');
      sourceVideo.playsInline = true;
      sourceVideo.crossOrigin = 'anonymous';
      sourceVideo.preload = 'auto';

      let audioCtx: AudioContext | null = null;
      let audioTrack: MediaStreamTrack | null = null;
      let animFrameId = 0;
      let isFinishing = false;
      let recorder: MediaRecorder | null = null;

      function cleanupResources() {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        try {
          sourceVideo.pause();
          sourceVideo.removeAttribute('src');
          sourceVideo.load();
        } catch {}
        if (audioCtx && audioCtx.state !== 'closed') {
          try {
            audioCtx.close();
          } catch {}
        }
      }

      sourceVideo.src = videoUrl;
      sourceVideo.currentTime = startTime;

      const handleSeeked = () => {
        sourceVideo.removeEventListener('seeked', handleSeeked);

        // SILENT AUDIO ROUTING:
        // By connecting sourceVideo to Web Audio MediaStreamDestination WITHOUT connecting
        // to audioCtx.destination, zero sound plays to the speakers, but audio buffers
        // are captured cleanly into MediaRecorder!
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            const sourceNode = audioCtx.createMediaElementSource(sourceVideo);
            const destinationNode = audioCtx.createMediaStreamDestination();
            sourceNode.connect(destinationNode);
            // CRITICAL: We DO NOT call sourceNode.connect(audioCtx.destination).
            // This guarantees the computer/phone speakers remain 100% silent!
            const tracks = destinationNode.stream.getAudioTracks();
            if (tracks && tracks.length > 0) {
              audioTrack = tracks[0];
            }
          }
        } catch (e) {
          // If Web Audio is restricted or video has no audio, mute video element to keep speakers silent
          sourceVideo.muted = true;
          try {
            const videoElAny = sourceVideo as any;
            if (typeof videoElAny.captureStream === 'function') {
              const vStream = videoElAny.captureStream();
              const aTracks = vStream.getAudioTracks();
              if (aTracks && aTracks.length > 0) audioTrack = aTracks[0];
            }
          } catch {}
        }

        const canvasStream = canvas.captureStream(30);
        const combinedTracks: MediaStreamTrack[] = [canvasStream.getVideoTracks()[0]];
        if (audioTrack) combinedTracks.push(audioTrack);
        const recordStream = new MediaStream(combinedTracks);

        const chosenMime = getOptimalVideoMime();
        const recorderOptions: MediaRecorderOptions = {
          videoBitsPerSecond: bitrate
        };
        if (chosenMime.mimeType) {
          recorderOptions.mimeType = chosenMime.mimeType;
        }

        try {
          recorder = new MediaRecorder(recordStream, recorderOptions);
        } catch (e: any) {
          cleanupResources();
          reject(new Error(t('Browser media recorder initialization failed: ') + e.message));
          return;
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };

        const sliceDuration = Math.max(0.1, endTime - startTime);

        function renderFrame() {
          if (isFinishing) return;

          // Background pass (if blur)
          if (framing === 'blur') {
            ctx.save();
            ctx.filter = 'blur(24px) brightness(0.6)';
            const bgScale = Math.max(targetW / sourceVideo.videoWidth, targetH / sourceVideo.videoHeight);
            const bgW = sourceVideo.videoWidth * bgScale;
            const bgH = sourceVideo.videoHeight * bgScale;
            const bgX = (targetW - bgW) / 2;
            const bgY = (targetH - bgH) / 2;
            ctx.drawImage(sourceVideo, bgX, bgY, bgW, bgH);
            ctx.restore();

            // Centered sharp video
            const fgScale = Math.min(targetW / sourceVideo.videoWidth, targetH / sourceVideo.videoHeight);
            const fgW = sourceVideo.videoWidth * fgScale;
            const fgH = sourceVideo.videoHeight * fgScale;
            const fgX = (targetW - fgW) / 2;
            const fgY = (targetH - fgH) / 2;
            ctx.drawImage(sourceVideo, fgX, fgY, fgW, fgH);
          } else if (framing === 'letterbox') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, targetW, targetH);
            const fgScale = Math.min(targetW / sourceVideo.videoWidth, targetH / sourceVideo.videoHeight);
            const fgW = sourceVideo.videoWidth * fgScale;
            const fgH = sourceVideo.videoHeight * fgScale;
            const fgX = (targetW - fgW) / 2;
            const fgY = (targetH - fgH) / 2;
            ctx.drawImage(sourceVideo, fgX, fgY, fgW, fgH);
          } else if (framing === 'fill') {
            const fgScale = Math.max(targetW / sourceVideo.videoWidth, targetH / sourceVideo.videoHeight);
            const fgW = sourceVideo.videoWidth * fgScale;
            const fgH = sourceVideo.videoHeight * fgScale;
            const fgX = (targetW - fgW) / 2;
            const fgY = (targetH - fgH) / 2;
            ctx.drawImage(sourceVideo, fgX, fgY, fgW, fgH);
          } else {
            ctx.drawImage(sourceVideo, 0, 0, targetW, targetH);
          }

          const currentElapsed = Math.max(0, sourceVideo.currentTime - startTime);
          const progressRatio = Math.min(1, currentElapsed / sliceDuration);
          onProgressUpdate(progressRatio, currentElapsed, sliceDuration);

          if (sourceVideo.currentTime >= endTime || sourceVideo.ended) {
            finishRecording();
            return;
          }

          animFrameId = requestAnimationFrame(renderFrame);
        }

        function finishRecording() {
          if (isFinishing) return;
          isFinishing = true;
          cancelAnimationFrame(animFrameId);
          sourceVideo.pause();

          if (recorder) {
            recorder.onstop = () => {
              const outType = chosenMime.mimeType || 'video/mp4';
              const finalBlob = new Blob(chunks, { type: outType });
              cleanupResources();
              resolve(finalBlob);
            };

            try {
              if (recorder.state !== 'inactive') {
                recorder.stop();
              }
            } catch {
              const outType = chosenMime.mimeType || 'video/mp4';
              cleanupResources();
              resolve(new Blob(chunks, { type: outType }));
            }
          } else {
            cleanupResources();
            resolve(new Blob(chunks, { type: 'video/mp4' }));
          }
        }

        recorder.onerror = (ev: any) => {
          cleanupResources();
          reject(new Error(ev.error?.message || t('Video recording error.')));
        };

        recorder.start(150);

        // Resume AudioContext if suspended by browser policy
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }

        sourceVideo
          .play()
          .then(() => {
            animFrameId = requestAnimationFrame(renderFrame);
          })
          .catch(() => {
            // If browser autoplay blocks without mute, mute element and retry
            sourceVideo.muted = true;
            sourceVideo
              .play()
              .then(() => {
                animFrameId = requestAnimationFrame(renderFrame);
              })
              .catch((err) => {
                cleanupResources();
                reject(err);
              });
          });
      };

      sourceVideo.addEventListener('seeked', handleSeeked);
    });
  }

  // Main video optimization run
  async function processVideo() {
    if (!file) return;
    setBusy(true);
    setErrorMessage('');
    setResultParts([]);
    setProgress(0);
    setProgressDetails('');

    const sourceVideo = document.createElement('video');
    sourceVideo.playsInline = true;
    sourceVideo.crossOrigin = 'anonymous';
    const videoUrl = URL.createObjectURL(file);
    sourceVideo.src = videoUrl;

    try {
      await new Promise<void>((resolve, reject) => {
        sourceVideo.onloadedmetadata = () => resolve();
        sourceVideo.onerror = () => reject(new Error(t('Could not load video file.')));
      });

      const totalDuration = sourceVideo.duration || 0;
      if (totalDuration <= 0) throw new Error(t('Invalid video duration.'));

      // Determine target resolution
      let targetW = 720;
      let targetH = 1280;

      if (videoPreset === '1080p') {
        targetW = 1080;
        targetH = 1920;
      } else if (videoPreset === 'original') {
        targetW = sourceVideo.videoWidth;
        targetH = sourceVideo.videoHeight;
        if (targetW > 1080 || targetH > 1920) {
          const factor = Math.min(1080 / targetW, 1920 / targetH);
          targetW = Math.round((targetW * factor) / 2) * 2;
          targetH = Math.round((targetH * factor) / 2) * 2;
        }
      }

      // Bitrate calibration
      let bitrate = 2800000; // ~2.8 Mbps sweet spot (around 9-10 MB for 30s)
      if (compressionPreset === 'ultralight') {
        bitrate = 1600000; // ~1.6 Mbps ultra light (around 5-6 MB for 30s)
      } else if (compressionPreset === 'maxdetail') {
        bitrate = 3800000; // ~3.8 Mbps max clarity (around 14 MB for 30s)
      }

      // Ensure dimensions are even numbers (required by video encoders)
      targetW = Math.round(targetW / 2) * 2;
      targetH = Math.round(targetH / 2) * 2;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error(t('Canvas 2D context unavailable.'));

      // Define slices to transcode
      interface SlicePlan {
        index: number;
        start: number;
        end: number;
        label: string;
      }
      const slices: SlicePlan[] = [];

      if (videoSplitMode === 'first30' || totalDuration <= 30) {
        slices.push({
          index: 1,
          start: 0,
          end: Math.min(30, totalDuration),
          label: totalDuration <= 30 ? 'Status HD (0-30s)' : 'Part 1 (0-30s)'
        });
      } else if (videoSplitMode === 'split') {
        let cursor = 0;
        let part = 1;
        while (cursor < totalDuration) {
          const end = Math.min(cursor + 30, totalDuration);
          slices.push({
            index: part,
            start: cursor,
            end: end,
            label: `Part ${part} (${Math.floor(cursor)}s - ${Math.floor(end)}s)`
          });
          cursor += 30;
          part++;
        }
      } else {
        // Full length single clip
        slices.push({
          index: 1,
          start: 0,
          end: totalDuration,
          label: `Status Video (${Math.floor(totalDuration)}s)`
        });
      }

      const generatedParts: StatusPart[] = [];
      const totalSlices = slices.length;

      for (let i = 0; i < totalSlices; i++) {
        const slice = slices[i];
        setStatusMessage(
          totalSlices > 1
            ? `${t('Silently optimizing video frames…')} (${i + 1} ${t('of')} ${totalSlices})`
            : t('Silently optimizing video frames…')
        );

        const sliceBlob = await transcodeSlice(
          videoUrl,
          canvas,
          ctx,
          slice.start,
          slice.end,
          targetW,
          targetH,
          bitrate,
          videoFraming,
          slice.label,
          (pct, elapsed, total) => {
            const overall = Math.round(((i + pct) / totalSlices) * 100);
            setProgress(overall);
            setProgressDetails(
              totalSlices > 1
                ? `Clip ${i + 1}/${totalSlices} · ${elapsed.toFixed(1)}s / ${total.toFixed(1)}s`
                : `${elapsed.toFixed(1)}s / ${total.toFixed(1)}s`
            );
          }
        );

        const partUrl = registerUrl(URL.createObjectURL(sliceBlob));
        generatedParts.push({
          partIndex: slice.index,
          label: slice.label,
          blob: sliceBlob,
          url: partUrl,
          duration: slice.end - slice.start,
          size: sliceBlob.size
        });
      }

      setResultParts(generatedParts);
      setActivePartPreview(0);
      setStatusMessage(
        totalSlices > 1
          ? `${totalSlices} ${t('clips ready for WhatsApp Status!')}`
          : t('Video ready for WhatsApp Status!')
      );
      setProgress(100);
      setProgressDetails('');
    } catch (err: any) {
      setErrorMessage(err.message || t('Video processing failed.'));
    } finally {
      URL.revokeObjectURL(videoUrl);
      setBusy(false);
    }
  }

  function downloadSingle(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function downloadAllZip() {
    if (resultParts.length === 0) return;
    setStatusMessage(t('Packaging all status clips into ZIP…'));
    const zip = new JSZip();
    const ext = getOptimalVideoMime().ext;

    resultParts.forEach((part) => {
      const filename = `whatsapp-status-part-${part.partIndex}.${ext}`;
      zip.file(filename, part.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadSingle(zipBlob, 'whatsapp-status-clips.zip');
    setStatusMessage(t('ZIP download started.'));
  }

  const isVideo = mediaType === 'video';
  const hasResult = isVideo ? resultParts.length > 0 : !!singleImageResult;

  // Compute size savings
  const originalSizeMb = file ? file.size / 1024 / 1024 : 0;
  const resultSizeMb = isVideo
    ? (resultParts[activePartPreview]?.size || 0) / 1024 / 1024
    : singleImageResult
    ? singleImageResult.size / 1024 / 1024
    : 0;

  const savingsPct =
    originalSizeMb > 0 && resultSizeMb > 0
      ? Math.round(Math.max(0, (1 - resultSizeMb / originalSizeMb) * 100))
      : 0;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace status-hd-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-hd-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Workspace Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={busy} onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('Private by design · Silent in-browser transcode')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Workspace Heading */}
        <div className="workspace-heading">
          <span className="tool-icon green">
            <Smartphone size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('WHATSAPP STATUS HD')}
              </span>
              <span className="hd-pill">ANTI-BLUR</span>
            </div>
            <h2 id="status-hd-title">{t('WhatsApp Status HD Optimizer')}</h2>
            <p>
              {t('Calibrated 3.5 Mbps bitrate, vertical 9:16 framing, and 30s status splitting to prevent blurry compression.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% Client-Side')}
          </span>
        </div>

        {/* Step Indicator */}
        <ol className="workspace-steps" aria-label={t('Tool progress')}>
          {[t('Choose video or photo'), t('Status sweet spot'), t('Save & post in HD')].map((s, i) => (
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
          {/* Main Visual Stage / Preview */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {hasResult ? t('STATUS-READY PREVIEW') : t('SOURCE PREVIEW')}
              </span>
              <span>{file?.name || t('Select video or image')}</span>
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
                    <Smartphone size={38} />
                  </span>
                </span>
                <strong>{t('Select your status video or photo')}</strong>
                <span>{t('Drop your MP4, MOV, WebM video or JPG, PNG image here.')}</span>
                <span className="empty-upload">
                  <Upload size={16} />
                  {t('Choose file')}
                </span>
                <small>{t('MP4, MOV, WebM, JPG, PNG · Up to 250 MB')}</small>
              </button>
            ) : hasResult ? (
              <div className="status-result-stage">
                {/* Size Savings Badge */}
                <div className="compression-impact-pill">
                  <Zap size={15} />
                  <span>
                    <strong>{originalSizeMb.toFixed(1)} MB</strong> ➔ <strong>{resultSizeMb.toFixed(1)} MB</strong>{' '}
                    ({savingsPct}% {t('smaller · Protected from WhatsApp blur')})
                  </span>
                </div>

                {isVideo && resultParts.length > 0 ? (
                  <div className="status-video-result">
                    <div className="phone-mockup-wrapper">
                      <div className="phone-screen">
                        <video
                          key={resultParts[activePartPreview]?.url}
                          ref={previewVideoRef}
                          src={resultParts[activePartPreview]?.url}
                          controls
                          autoPlay
                          loop
                          playsInline
                        />
                        <div className="status-overlay-chip">
                          <span>WhatsApp Status 9:16</span>
                          <strong>{resultParts[activePartPreview]?.label}</strong>
                        </div>
                      </div>
                    </div>

                    {resultParts.length > 1 && (
                      <div className="status-parts-list" role="tablist" aria-label={t('Status video parts')}>
                        {resultParts.map((part, idx) => (
                          <button
                            key={part.partIndex}
                            role="tab"
                            aria-selected={activePartPreview === idx}
                            className={`part-chip ${activePartPreview === idx ? 'active' : ''}`}
                            onClick={() => setActivePartPreview(idx)}
                          >
                            <span>Part {part.partIndex}</span>
                            <small>{Math.round(part.duration)}s · {(part.size / 1024 / 1024).toFixed(1)} MB</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : singleImageResult ? (
                  <div className="status-photo-result">
                    <div className="phone-mockup-wrapper">
                      <div className="phone-screen">
                        <img src={singleImageResult.url} alt={t('Optimized status photo')} />
                        <div className="status-overlay-chip">
                          <span>WhatsApp Status 1080×1920</span>
                          <strong>{(singleImageResult.size / 1024).toFixed(0)} KB · Ready</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="result-actions-bar">
                  {isVideo && resultParts.length > 1 ? (
                    <>
                      <button className="primary" onClick={downloadAllZip}>
                        <Archive size={17} />
                        {t('Download all parts (.ZIP)')}
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() =>
                          downloadSingle(
                            resultParts[activePartPreview].blob,
                            `whatsapp-status-part-${resultParts[activePartPreview].partIndex}.${getOptimalVideoMime().ext}`
                          )
                        }
                      >
                        <Download size={16} />
                        {t('Download current part')}
                      </button>
                    </>
                  ) : isVideo && resultParts.length === 1 ? (
                    <button
                      className="primary"
                      onClick={() =>
                        downloadSingle(resultParts[0].blob, `whatsapp-status-hd.${getOptimalVideoMime().ext}`)
                      }
                    >
                      <Download size={17} />
                      {t('Download status video')}
                    </button>
                  ) : singleImageResult ? (
                    <button
                      className="primary"
                      onClick={() => downloadSingle(singleImageResult.blob, 'whatsapp-status-hd.jpg')}
                    >
                      <Download size={17} />
                      {t('Download status photo')}
                    </button>
                  ) : null}
                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setResultParts([]);
                      setSingleImageResult(null);
                    }}
                  >
                    <RotateCw size={15} />
                    {t('Adjust settings')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="status-source-stage">
                {isVideo ? (
                  <div className="source-video-info">
                    <div className="source-card">
                      <Film size={28} className="source-icon" />
                      <div>
                        <strong>{file.name}</strong>
                        <p>
                          {videoDimensions.width}×{videoDimensions.height} · {videoDuration.toFixed(1)}s ·{' '}
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    {videoDuration > 30 && (
                      <div className="duration-alert">
                        <Info size={16} />
                        <span>
                          {t('Video exceeds WhatsApp’s 30s limit. We can auto-split it into seamless sequential clips.')}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="source-photo-info">
                    <div className="source-card">
                      <ImageIcon size={28} className="source-icon" />
                      <div>
                        <strong>{file.name}</strong>
                        <p>
                          {imageDimensions.width}×{imageDimensions.height} · {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Silent Processing Guarantee Banner */}
                <div className="silent-badge-card">
                  <VolumeX size={18} className="silent-icon" />
                  <div>
                    <strong>{t('Silent Background Processing')}</strong>
                    <p>{t('Speakers silenced · Audio preserved in video')}</p>
                  </div>
                </div>

                {/* The Proven WhatsApp HD Status Trick Guide */}
                <div className="hd-trick-card">
                  <div className="trick-header" onClick={() => setShowHdTrickGuide(!showHdTrickGuide)}>
                    <div className="trick-title">
                      <Sparkles size={17} />
                      <span>{t('The Secret WhatsApp HD Status Trick')}</span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={showHdTrickGuide ? t('Collapse guide') : t('Expand guide')}
                    >
                      {showHdTrickGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  {showHdTrickGuide && (
                    <ol className="trick-steps">
                      <li>
                        <strong>{t('1. Optimize here')}:</strong>{' '}
                        {t('Download your status-calibrated video or image from this tool.')}
                      </li>
                      <li>
                        <strong>{t('2. Send to yourself')}:</strong>{' '}
                        {t('Open WhatsApp, open "Message yourself" (or any personal chat), and attach the file.')}
                      </li>
                      <li>
                        <strong>{t('3. Tap the HD button')}:</strong>{' '}
                        {t('Tap the "HD" icon at the top of the WhatsApp preview before hitting send.')}
                      </li>
                      <li>
                        <strong>{t('4. Forward to Status')}:</strong>{' '}
                        {t('Forward that sent message directly to "My Status". It bypasses the status compressor completely!')}
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

          {/* Controls & Configuration Sidebar */}
          <aside className="workspace-controls" aria-label={t('Status settings')}>
            <div className="controls-section">
              <div className="controls-heading">
                <h3>{t('Source file')}</h3>
              </div>
              <p className="controls-description">
                {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : t('Choose a file to optimize.')}
              </p>
              <button
                className="dropzone workspace-upload"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={17} />
                <b>{file ? t('Choose a different file') : t('Select video or image')}</b>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="video/*,image/*,.mp4,.mov,.webm,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  handleFileSelected(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            {isVideo ? (
              <div className="controls-section settings-section">
                <div className="controls-heading">
                  <h3>{t('Video optimization')}</h3>
                </div>

                <label className="field">
                  {t('Compression & Quality')}
                  <select
                    value={compressionPreset}
                    disabled={busy}
                    onChange={(e) => setCompressionPreset(e.target.value as any)}
                  >
                    <option value="sweetspot">{t('Balanced Sweet Spot (2.8 Mbps · Recommended)')}</option>
                    <option value="ultralight">{t('Ultra-Compressed (1.6 Mbps · Max Size Reduction)')}</option>
                    <option value="maxdetail">{t('High Clarity HD (3.8 Mbps · Maximum Detail)')}</option>
                  </select>
                  <small>
                    {compressionPreset === 'sweetspot'
                      ? t('Keeps status video under ~10 MB without triggering WhatsApp blur.')
                      : compressionPreset === 'ultralight'
                      ? t('Compresses file heavily to ~5 MB for fastest uploads.')
                      : t('Maximum visual clarity for high-end displays.')}
                  </small>
                </label>

                <label className="field">
                  {t('Status resolution preset')}
                  <select
                    value={videoPreset}
                    disabled={busy}
                    onChange={(e) => setVideoPreset(e.target.value as any)}
                  >
                    <option value="720p">{t('720×1280 (Sweet Spot - Recommended)')}</option>
                    <option value="1080p">{t('1080×1920 (Full HD)')}</option>
                    <option value="original">{t('Original dimensions (Scaled bitrate)')}</option>
                  </select>
                </label>

                <label className="field">
                  {t('Framing for 9:16 vertical')}
                  <select
                    value={videoFraming}
                    disabled={busy}
                    onChange={(e) => setVideoFraming(e.target.value as any)}
                  >
                    <option value="blur">{t('Blurred backdrop wings (Pro look)')}</option>
                    <option value="letterbox">{t('Black bars (Letterbox)')}</option>
                    <option value="fill">{t('Center fill (Crop to 9:16)')}</option>
                    <option value="original">{t('Direct fit (No padding)')}</option>
                  </select>
                </label>

                {videoDuration > 30 && (
                  <label className="field">
                    {t('Duration & 30s status limit')}
                    <select
                      value={videoSplitMode}
                      disabled={busy}
                      onChange={(e) => setVideoSplitMode(e.target.value as any)}
                    >
                      <option value="split">
                        {t('Auto-split into 30s status clips (Part 1, Part 2…)')}
                      </option>
                      <option value="first30">{t('First 30 seconds only')}</option>
                      <option value="full">{t('Full length (Single file)')}</option>
                    </select>
                    <small>
                      {videoSplitMode === 'split'
                        ? `${Math.ceil(videoDuration / 30)} ${t('sequential status slides will be generated.')}`
                        : ''}
                    </small>
                  </label>
                )}
              </div>
            ) : (
              <div className="controls-section settings-section">
                <div className="controls-heading">
                  <h3>{t('Photo optimization')}</h3>
                </div>

                <label className="field">
                  {t('Status framing')}
                  <select
                    value={imageFraming}
                    disabled={busy}
                    onChange={(e) => setImageFraming(e.target.value as any)}
                  >
                    <option value="blur">{t('Blurred backdrop (9:16 vertical)')}</option>
                    <option value="letterbox">{t('Black letterbox (9:16 vertical)')}</option>
                    <option value="original">{t('Original aspect ratio')}</option>
                  </select>
                </label>

                <label className="field-checkbox">
                  <input
                    type="checkbox"
                    checked={imageSharpen}
                    disabled={busy}
                    onChange={(e) => setImageSharpen(e.target.checked)}
                  />
                  <span>
                    <strong>{t('Edge clarity filter')}</strong>
                    <small>{t('Compensates for WhatsApp’s JPEG compression to keep text and fine lines crisp.')}</small>
                  </span>
                </label>
              </div>
            )}

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
                  {busy && progressDetails && (
                    <small className="progress-details-text">{progressDetails}</small>
                  )}
                </div>
              )}

              {hasResult ? (
                <button
                  className="primary full"
                  onClick={() => {
                    if (isVideo && resultParts.length > 1) {
                      downloadAllZip();
                    } else if (isVideo && resultParts.length === 1) {
                      downloadSingle(resultParts[0].blob, `whatsapp-status-hd.${getOptimalVideoMime().ext}`);
                    } else if (singleImageResult) {
                      downloadSingle(singleImageResult.blob, 'whatsapp-status-hd.jpg');
                    }
                  }}
                >
                  <ArrowDownToLine size={18} />
                  {isVideo && resultParts.length > 1 ? t('Download all parts (.ZIP)') : t('Download status media')}
                </button>
              ) : (
                <button
                  className="primary full"
                  disabled={!file || busy}
                  onClick={isVideo ? processVideo : processImage}
                >
                  {busy ? t('Transcoding locally…') : t('Optimize for WhatsApp Status')}
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
