import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Disc,
  Download,
  Music,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  X
} from 'lucide-react';

interface AudioCutterToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function AudioCutterTool({ initialFiles = [], close }: AudioCutterToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState<number>(0);

  // Trimming State (seconds)
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(30);
  const [fadeIn, setFadeIn] = useState<number>(0); // seconds: 0, 1, 2
  const [fadeOut, setFadeOut] = useState<number>(1); // seconds: 0, 1, 2

  // Playback Preview State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackPos, setPlaybackPos] = useState<number>(0);

  // Result
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null);
  const [trimmedUrl, setTrimmedUrl] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (trimmedUrl) URL.revokeObjectURL(trimmedUrl);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [trimmedUrl]);

  // Handle initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  async function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    const valid = f.type.startsWith('audio/') || f.type.startsWith('video/') || /\.(mp3|wav|ogg|m4a|aac|flac|mp4|webm)$/i.test(f.name);
    if (!valid) {
      setErrorMessage(t('Please select a valid audio or video file (MP3, WAV, M4A, MP4).'));
      return;
    }

    stopPlayback();
    if (trimmedUrl) URL.revokeObjectURL(trimmedUrl);
    setTrimmedBlob(null);
    setTrimmedUrl('');
    setFile(f);
    setBusy(true);

    try {
      const buffer = await f.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const decoded = await audioCtx.decodeAudioData(buffer);
      setAudioBuffer(decoded);
      setDuration(decoded.duration);
      setStartTime(0);
      setEndTime(Math.min(30, decoded.duration));

      // Draw waveform
      setTimeout(() => {
        drawWaveform(decoded, 0, Math.min(30, decoded.duration), 0);
      }, 50);
    } catch {
      setErrorMessage(t('Could not decode audio from this file. It may be corrupt or use an unsupported codec.'));
    } finally {
      setBusy(false);
    }
  }

  // Draw Waveform onto Canvas with crop markers & playback head
  function drawWaveform(buffer: AudioBuffer, start: number, end: number, currentPos: number) {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    const totalSec = buffer.duration || 1;

    // Draw full background wave
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const y1 = (1 + min) * amp;
      const y2 = Math.max(1, (max - min) * amp);

      const sec = (i / width) * totalSec;
      const isSelected = sec >= start && sec <= end;

      ctx.fillStyle = isSelected ? '#6366f1' : 'rgba(148, 163, 184, 0.35)';
      ctx.fillRect(i, y1, 1, y2);
    }

    // Draw Start Marker line
    const startX = (start / totalSec) * width;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.stroke();

    // Draw End Marker line
    const endX = (end / totalSec) * width;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

    // Draw Playback Head if playing
    if (currentPos > 0) {
      const playX = (currentPos / totalSec) * width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, height);
      ctx.stroke();
    }
  }

  // Update waveform on start/end change
  useEffect(() => {
    if (audioBuffer) {
      drawWaveform(audioBuffer, startTime, endTime, playbackPos);
    }
  }, [startTime, endTime, playbackPos]);

  // Audio Preview Controller
  function togglePlayback() {
    if (!audioBuffer || !audioContextRef.current) return;

    if (isPlaying) {
      stopPlayback();
    } else {
      const audioCtx = audioContextRef.current;
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      const clipDuration = Math.max(0.1, endTime - startTime);
      source.start(0, startTime, clipDuration);
      activeSourceNodeRef.current = source;
      playbackStartTimeRef.current = audioCtx.currentTime;
      setIsPlaying(true);

      const trackLoop = () => {
        if (!activeSourceNodeRef.current) return;
        const elapsed = audioCtx.currentTime - playbackStartTimeRef.current;
        const currentSec = startTime + elapsed;

        if (currentSec >= endTime) {
          stopPlayback();
        } else {
          setPlaybackPos(currentSec);
          animFrameRef.current = requestAnimationFrame(trackLoop);
        }
      };
      animFrameRef.current = requestAnimationFrame(trackLoop);

      source.onended = () => {
        stopPlayback();
      };
    }
  }

  function stopPlayback() {
    if (activeSourceNodeRef.current) {
      try {
        activeSourceNodeRef.current.stop();
      } catch {}
      activeSourceNodeRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackPos(0);
  }

  // PCM WAV Slicer and Exporter
  function sliceAndEncodeWav(): Blob {
    if (!audioBuffer) throw new Error(t('No audio loaded.'));

    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.min(audioBuffer.length, Math.floor(endTime * sampleRate));
    const sampleCount = Math.max(0, endSample - startSample);

    // Fade parameters in samples
    const fadeInSamples = Math.floor(fadeIn * sampleRate);
    const fadeOutSamples = Math.floor(fadeOut * sampleRate);

    // Extract sliced channels with fades
    const channelData: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      const orig = audioBuffer.getChannelData(c);
      const sliced = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        let sample = orig[startSample + i];

        // Apply fade-in
        if (fadeInSamples > 0 && i < fadeInSamples) {
          sample *= i / fadeInSamples;
        }

        // Apply fade-out
        if (fadeOutSamples > 0 && i >= sampleCount - fadeOutSamples) {
          const remaining = sampleCount - i;
          sample *= remaining / fadeOutSamples;
        }

        sliced[i] = sample;
      }
      channelData.push(sliced);
    }

    // 16-bit PCM WAV packaging
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataByteCount = sampleCount * blockAlign;
    const buffer = new ArrayBuffer(44 + dataByteCount);
    const view = new DataView(buffer);

    function writeString(offset: number, str: string) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataByteCount, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataByteCount, true);

    let offset = 44;
    for (let i = 0; i < sampleCount; i++) {
      for (let c = 0; c < numChannels; c++) {
        let s = channelData[c][i];
        s = Math.max(-1, Math.min(1, s));
        const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function handleCutAndExport() {
    stopPlayback();
    try {
      const blob = sliceAndEncodeWav();
      const url = URL.createObjectURL(blob);
      setTrimmedBlob(blob);
      setTrimmedUrl(url);
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to cut audio.'));
    }
  }

  function downloadRingtone() {
    if (!trimmedBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = trimmedUrl;
    a.download = `${baseName}-ringtone.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function formatSec(s: number): string {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return `${m}:${Number(sec) < 10 ? '0' : ''}${sec}s`;
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace audiocutter-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audiocutter-title"
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
            {t('Private & Client-Side · Millisecond Studio Slicer')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon coral">
            <Scissors size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Audio tools')} <span>/</span> {t('AUDIO TRIMMER & RINGTONE CUTTER')}
              </span>
              <span className="hd-pill">RINGTONE & NOTIFICATION</span>
            </div>
            <h2 id="audiocutter-title">{t('Audio Trimmer & Ringtone Cutter')}</h2>
            <p>
              {t('Slice custom phone ringtones, alarm tones, and audio clips with interactive waveform scrubbing and smooth fades.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Zero Loss · 16-Bit Master')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Waveform Display */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {audioBuffer ? t('INTERACTIVE WAVEFORM') : t('AUDIO WORKBENCH')}
              </span>
              <span>{file ? file.name : t('Select audio or video')}</span>
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
                  <Music size={34} />
                </div>
                <h3>{t('Drop song or video file here')}</h3>
                <p>{t('Supports MP3, WAV, M4A, AAC, and MP4. Cut perfect ringtones with zero uploads.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select audio')}
                </span>
              </button>
            ) : (
              <div className="audiocutter-stage-wrap">
                <div className="audiocutter-hero-card">
                  <div className="waveform-box">
                    <canvas ref={waveformCanvasRef} width={640} height={140} className="waveform-canvas-element" />
                  </div>

                  {/* Playback Controls & Range Info */}
                  <div className="audiocutter-playback-bar">
                    <button
                      className="audio-play-round"
                      onClick={togglePlayback}
                      aria-label={isPlaying ? t('Pause') : t('Play')}
                    >
                      {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>

                    <div className="trim-range-summary">
                      <strong>
                        {formatSec(startTime)} to {formatSec(endTime)}
                      </strong>
                      <small>
                        {t('Selected Length')}: {(endTime - startTime).toFixed(1)}s (Total: {formatSec(duration)})
                      </small>
                    </div>

                    <button className="primary-action" onClick={handleCutAndExport}>
                      <Scissors size={16} />
                      {t('Cut Clip')}
                    </button>
                  </div>
                </div>

                {trimmedBlob && (
                  <div className="trimmed-success-card">
                    <Check size={18} />
                    <span>
                      {t('Ringtone ready!')} ({(trimmedBlob.size / 1024).toFixed(1)} KB)
                    </span>
                    <button className="download-btn-green" onClick={downloadRingtone}>
                      <Download size={16} />
                      {t('Download Ringtone (WAV)')}
                    </button>
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
              accept="audio/*,video/*,.mp3,.wav,.ogg,.m4a,.aac,.mp4,.webm"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {audioBuffer && (
              <>
                <div className="control-group">
                  <div className="slider-label-row">
                    <span>{t('Start Marker')}</span>
                    <span>{formatSec(startTime)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, endTime - 0.5)}
                    step="0.1"
                    value={startTime}
                    onChange={(e) => setStartTime(Number(e.target.value))}
                  />
                </div>

                <div className="control-group">
                  <div className="slider-label-row">
                    <span>{t('End Marker')}</span>
                    <span>{formatSec(endTime)}</span>
                  </div>
                  <input
                    type="range"
                    min={startTime + 0.5}
                    max={duration}
                    step="0.1"
                    value={endTime}
                    onChange={(e) => setEndTime(Number(e.target.value))}
                  />
                </div>

                <div className="control-group">
                  <label>{t('Fade In')}</label>
                  <div className="btn-toggle-group">
                    <button type="button" className={fadeIn === 0 ? 'active' : ''} onClick={() => setFadeIn(0)}>
                      Off
                    </button>
                    <button type="button" className={fadeIn === 1 ? 'active' : ''} onClick={() => setFadeIn(1)}>
                      1s
                    </button>
                    <button type="button" className={fadeIn === 2 ? 'active' : ''} onClick={() => setFadeIn(2)}>
                      2s
                    </button>
                  </div>
                </div>

                <div className="control-group">
                  <label>{t('Fade Out')}</label>
                  <div className="btn-toggle-group">
                    <button type="button" className={fadeOut === 0 ? 'active' : ''} onClick={() => setFadeOut(0)}>
                      Off
                    </button>
                    <button type="button" className={fadeOut === 1 ? 'active' : ''} onClick={() => setFadeOut(1)}>
                      1s
                    </button>
                    <button type="button" className={fadeOut === 2 ? 'active' : ''} onClick={() => setFadeOut(2)}>
                      2s
                    </button>
                  </div>
                </div>

                <button className="primary-action" onClick={handleCutAndExport}>
                  <Scissors size={17} />
                  {t('Cut & Export Ringtone')}
                </button>
              </>
            )}

            {file && (
              <button
                className="btn-change-file"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Change audio')}
              </button>
            )}

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
