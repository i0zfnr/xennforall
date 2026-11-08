import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Mic,
  Pause,
  Play,
  Scissors,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  X
} from 'lucide-react';

interface AudioGateToolProps {
  initialFiles?: File[];
  close: () => void;
}

interface AudioSegment {
  start: number;
  end: number;
  isSilence: boolean;
}

export default function AudioGateTool({ initialFiles = [], close }: AudioGateToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  // Gate Settings
  const [thresholdDb, setThresholdDb] = useState<number>(-42); // dB
  const [minSilenceDuration, setMinSilenceDuration] = useState<number>(0.4); // seconds
  const [paddingMs, setPaddingMs] = useState<number>(50); // ms audio head/tail margin

  // Analysis result
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [trimmedDuration, setTrimmedDuration] = useState<number>(0);
  const [timeSaved, setTimeSaved] = useState<number>(0);

  // Playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Audio contexts
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Cleanup
  useEffect(() => {
    return () => {
      stopPlayback();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      loadAudioFile(initialFiles[0]);
    }
  }, []);

  async function loadAudioFile(f: File) {
    if (!f.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name)) {
      return;
    }
    stopPlayback();
    setFile(f);
    setStatusMsg(t('Decoding audio file…'));

    try {
      const arrayBuf = await f.arrayBuffer();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const decoded = await ctx.decodeAudioData(arrayBuf);
      setAudioBuffer(decoded);
      setCurrentTime(0);
      pauseOffsetRef.current = 0;
      setStatusMsg('');
      analyzeSilence(decoded, thresholdDb, minSilenceDuration);
    } catch (err) {
      console.error(err);
      setStatusMsg(t('Failed to decode audio. Please try another file.'));
    }
  }

  // Detect silence frames using RMS energy
  function analyzeSilence(buf: AudioBuffer, threshold: number, minDuration: number) {
    const rawData = buf.getChannelData(0);
    const sampleRate = buf.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
    const linearThreshold = Math.pow(10, threshold / 20);

    const rawSegments: AudioSegment[] = [];
    let currentIsSilence = false;
    let segStart = 0;

    for (let i = 0; i < rawData.length; i += windowSize) {
      let sum = 0;
      const end = Math.min(i + windowSize, rawData.length);
      for (let j = i; j < end; j++) {
        sum += rawData[j] * rawData[j];
      }
      const rms = Math.sqrt(sum / (end - i));
      const isSilentNow = rms < linearThreshold;

      if (i === 0) {
        currentIsSilence = isSilentNow;
        segStart = 0;
      } else if (isSilentNow !== currentIsSilence) {
        rawSegments.push({
          start: segStart / sampleRate,
          end: i / sampleRate,
          isSilence: currentIsSilence
        });
        currentIsSilence = isSilentNow;
        segStart = i;
      }
    }

    rawSegments.push({
      start: segStart / sampleRate,
      end: rawData.length / sampleRate,
      isSilence: currentIsSilence
    });

    // Merge short silences that do not exceed minDuration into speech
    const merged: AudioSegment[] = [];
    rawSegments.forEach((seg) => {
      if (seg.isSilence && seg.end - seg.start < minDuration) {
        // treat as speech
        if (merged.length > 0 && !merged[merged.length - 1].isSilence) {
          merged[merged.length - 1].end = seg.end;
        } else {
          merged.push({ ...seg, isSilence: false });
        }
      } else {
        if (merged.length > 0 && merged[merged.length - 1].isSilence === seg.isSilence) {
          merged[merged.length - 1].end = seg.end;
        } else {
          merged.push(seg);
        }
      }
    });

    setSegments(merged);

    // Calculate kept speech duration
    const speechTime = merged.filter((s) => !s.isSilence).reduce((acc, s) => acc + (s.end - s.start), 0);
    setTrimmedDuration(speechTime);
    setTimeSaved(buf.duration - speechTime);
  }

  // Recalculate when sliders change
  useEffect(() => {
    if (audioBuffer) {
      analyzeSilence(audioBuffer, thresholdDb, minSilenceDuration);
    }
  }, [thresholdDb, minSilenceDuration]);

  function setupLivePlayback(offset = 0) {
    if (!audioBuffer) return;
    const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;

    if (ctx.state === 'suspended') ctx.resume();

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (_) {}
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    sourceNodeRef.current = source;

    source.onended = () => {
      if (isPlaying) {
        setIsPlaying(false);
        setCurrentTime(0);
        pauseOffsetRef.current = 0;
      }
    };

    source.start(0, offset);
    playStartTimeRef.current = ctx.currentTime - offset;
    setIsPlaying(true);
    startTracking();
  }

  function startTracking() {
    function track() {
      if (!isPlaying || !audioCtxRef.current || !audioBuffer) return;
      const elapsed = audioCtxRef.current.currentTime - playStartTimeRef.current;
      setCurrentTime(Math.min(audioBuffer.duration, elapsed));
      animFrameRef.current = requestAnimationFrame(track);
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(track);
  }

  function togglePlay() {
    if (!audioBuffer) return;
    if (isPlaying) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        pauseOffsetRef.current = audioCtxRef.current.currentTime - playStartTimeRef.current;
      }
      setIsPlaying(false);
    } else {
      if (pauseOffsetRef.current >= audioBuffer.duration) {
        pauseOffsetRef.current = 0;
      }
      setupLivePlayback(pauseOffsetRef.current);
    }
  }

  function stopPlayback() {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (_) {}
    }
    setIsPlaying(false);
    pauseOffsetRef.current = 0;
    setCurrentTime(0);
  }

  // Render and stitch together speech segments into a new AudioBuffer
  async function exportTrimmedAudio() {
    if (!audioBuffer) return;
    stopPlayback();
    setIsProcessing(true);
    setStatusMsg(t('Trimming silent gaps & stitching speech…'));

    try {
      const speechSegs = segments.filter((s) => !s.isSilence);
      if (speechSegs.length === 0) {
        throw new Error(t('No speech segments found at this threshold.'));
      }

      const sampleRate = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;
      const padSamples = Math.floor((paddingMs / 1000) * sampleRate);

      // Compute total sample length
      let totalSamples = 0;
      speechSegs.forEach((seg) => {
        const startSamp = Math.max(0, Math.floor(seg.start * sampleRate) - padSamples);
        const endSamp = Math.min(audioBuffer.length, Math.floor(seg.end * sampleRate) + padSamples);
        totalSamples += endSamp - startSamp;
      });

      const outBuffer = new AudioBuffer({
        numberOfChannels: numChannels,
        length: totalSamples,
        sampleRate: sampleRate
      });

      for (let ch = 0; ch < numChannels; ch++) {
        const srcData = audioBuffer.getChannelData(ch);
        const outData = outBuffer.getChannelData(ch);
        let writeOffset = 0;

        speechSegs.forEach((seg) => {
          const startSamp = Math.max(0, Math.floor(seg.start * sampleRate) - padSamples);
          const endSamp = Math.min(audioBuffer.length, Math.floor(seg.end * sampleRate) + padSamples);
          const len = endSamp - startSamp;
          for (let i = 0; i < len; i++) {
            outData[writeOffset + i] = srcData[startSamp + i];
          }
          writeOffset += len;
        });
      }

      const wavBlob = audioBufferToWav(outBuffer);
      const baseName = file?.name.substring(0, file.name.lastIndexOf('.')) || 'trimmed-voice';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(wavBlob);
      link.download = `${baseName}-silence-stripped.wav`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMsg('');
    } catch (err: any) {
      console.error(err);
      setStatusMsg(err.message || t('Error rendering trimmed audio.'));
    } finally {
      setIsProcessing(false);
    }
  }

  function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    function writeString(offset: number, str: string) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    const channels = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(buffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  const durationSec = audioBuffer ? audioBuffer.duration : 1;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace audiogate-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audiogate-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !isProcessing) {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={isProcessing} onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('Private & Client-Side · 100% In-Browser')}
          </span>
          <button className="workspace-close" disabled={isProcessing} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon orange">
            <Scissors size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Audio tools')} <span>/</span> {t('VOICE GATE & SILENCE STRIPPER')}
              </span>
              <span className="hd-pill">AUTO TRIM</span>
            </div>
            <h2 id="audiogate-title">{t('Audio Silence Trimmer & Voice Gate')}</h2>
            <p>
              {t('Automatically detect and strip dead silence and background room hiss from podcasts, lectures, and voice memos.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Auto Cut · Lossless Export')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {audioBuffer ? t('WAVEFORM SPEECH TIMELINE') : t('AUDIO WORKBENCH')}
              </span>
              <span>{file ? file.name : t('Select audio file')}</span>
            </div>

            {!audioBuffer ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) loadAudioFile(e.dataTransfer.files[0]);
                }}
              >
                <div className="empty-circle">
                  <Scissors size={34} />
                </div>
                <h3>{t('Select audio file to trim silence')}</h3>
                <p>{t('Supports MP3, WAV, M4A, and FLAC. Automatically cuts awkward pauses and room noise.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Audio File')}
                </span>
              </button>
            ) : (
              <div className="audiogate-stage-wrap">
                {/* Visual Timeline of Segments */}
                <div className="audiogate-timeline-card">
                  <div className="timeline-track-bar">
                    {segments.map((seg, idx) => {
                      const leftPct = (seg.start / durationSec) * 100;
                      const widthPct = ((seg.end - seg.start) / durationSec) * 100;
                      return (
                        <div
                          key={idx}
                          className={`timeline-seg ${seg.isSilence ? 'silence' : 'speech'}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`
                          }}
                          title={seg.isSilence ? `Silence: ${(seg.end - seg.start).toFixed(2)}s` : `Speech: ${(seg.end - seg.start).toFixed(2)}s`}
                        />
                      );
                    })}

                    {/* Playhead */}
                    <div
                      className="timeline-playhead"
                      style={{ left: `${(currentTime / durationSec) * 100}%` }}
                    />
                  </div>

                  <div className="timeline-legend-row">
                    <span className="legend-chip speech">
                      <span className="dot" /> {t('Active Speech (Kept)')}
                    </span>
                    <span className="legend-chip silence">
                      <span className="dot" /> {t('Dead Silence (Stripped)')}
                    </span>
                  </div>
                </div>

                {/* Savings Pill */}
                {timeSaved > 0 && (
                  <div className="savings-pill-badge large">
                    <Sparkles size={16} />
                    <span>
                      {formatTime(audioBuffer.duration)} <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px' }} /> <strong>{formatTime(trimmedDuration)}</strong> (-{timeSaved.toFixed(1)}s {t('trimmed')})
                    </span>
                  </div>
                )}

                {/* Transport */}
                <div className="reverb-transport-row">
                  <button
                    type="button"
                    className="reverb-play-btn"
                    onClick={togglePlay}
                    aria-label={isPlaying ? t('Pause') : t('Play')}
                  >
                    {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
                  </button>
                </div>

                <div className="reverb-export-action">
                  <button
                    type="button"
                    className="download-btn-green"
                    disabled={isProcessing}
                    onClick={exportTrimmedAudio}
                  >
                    <ArrowDownToLine size={16} />
                    {isProcessing ? t('Rendering Trimmed Audio…') : t('Download Silence-Stripped Audio')}
                  </button>
                </div>

                {statusMsg && <div className="reverb-status-hint">{statusMsg}</div>}
              </div>
            )}
          </div>

          {/* Controls Sidebar */}
          <div className="workspace-controls">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="audio/*"
              onChange={(e) => {
                if (e.target.files?.[0]) loadAudioFile(e.target.files[0]);
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Silence Threshold')}</span>
                <strong>{thresholdDb} dB</strong>
              </div>
              <input
                type="range"
                min="-60"
                max="-24"
                step="1"
                value={thresholdDb}
                onChange={(e) => setThresholdDb(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Min Silence Duration')}</span>
                <strong>{minSilenceDuration}s</strong>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={minSilenceDuration}
                onChange={(e) => setMinSilenceDuration(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Padding Margin')}</span>
                <strong>{paddingMs} ms</strong>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={paddingMs}
                onChange={(e) => setPaddingMs(Number(e.target.value))}
              />
            </div>

            {audioBuffer && (
              <div className="control-group">
                <div className="spec-card">
                  <div className="spec-row">
                    <span>{t('Original Length')}</span>
                    <strong>{formatTime(audioBuffer.duration)}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('New Length')}</span>
                    <strong className="badge-green">{formatTime(trimmedDuration)}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('Time Trimmed')}</span>
                    <strong>{timeSaved.toFixed(1)}s</strong>
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
              {audioBuffer ? t('Change Audio File') : t('Select Audio File')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
