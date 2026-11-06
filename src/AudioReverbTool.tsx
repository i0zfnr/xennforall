import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Upload,
  Volume2,
  X
} from 'lucide-react';

interface AudioReverbToolProps {
  initialFiles?: File[];
  close: () => void;
}

interface ReverbPreset {
  id: string;
  name: string;
  decay: number;
  damping: number;
  wet: number;
}

const PRESETS: ReverbPreset[] = [
  { id: 'cathedral', name: 'Cathedral', decay: 4.8, damping: 2400, wet: 0.65 },
  { id: 'hall', name: 'Concert Hall', decay: 2.6, damping: 3600, wet: 0.45 },
  { id: 'room', name: 'Acoustic Room', decay: 1.2, damping: 5500, wet: 0.35 },
  { id: 'plate', name: 'Shimmer Plate', decay: 2.2, damping: 7500, wet: 0.5 },
  { id: 'space', name: 'Cosmic Ambient', decay: 7.5, damping: 1800, wet: 0.8 },
  { id: 'lofi', name: 'Lo-Fi Garage', decay: 0.7, damping: 1400, wet: 0.4 }
];

export default function AudioReverbTool({ initialFiles = [], close }: AudioReverbToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  // Settings
  const [selectedPreset, setSelectedPreset] = useState<string>('hall');
  const [decay, setDecay] = useState<number>(2.6);
  const [damping, setDamping] = useState<number>(3600);
  const [wetMix, setWetMix] = useState<number>(0.45);

  // Playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Audio nodes & contexts
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const convolverNodeRef = useRef<ConvolverNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Tracking
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

  // Cleanup on unmount
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
      setDuration(decoded.duration);
      setCurrentTime(0);
      pauseOffsetRef.current = 0;
      setStatusMsg('');
    } catch (err) {
      console.error('Audio decode error:', err);
      setStatusMsg(t('Failed to decode audio. Please try another file.'));
    }
  }

  function generateImpulseResponse(
    ctx: BaseAudioContext,
    durationSeconds: number,
    decayFactor: number
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSeconds);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      const env = Math.pow(n / length, decayFactor);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }

    return impulse;
  }

  function applyPreset(p: ReverbPreset) {
    setSelectedPreset(p.id);
    setDecay(p.decay);
    setDamping(p.damping);
    setWetMix(p.wet);

    if (isPlaying) {
      setupLiveGraph(pauseOffsetRef.current);
    }
  }

  function setupLiveGraph(offset = 0) {
    if (!audioBuffer) return;
    const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (_) {}
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const convolver = ctx.createConvolver();
    const analyser = ctx.createAnalyser();

    filter.type = 'lowpass';
    filter.frequency.value = damping;
    convolver.buffer = generateImpulseResponse(ctx, decay, 2.5);

    dryGain.gain.value = 1 - wetMix;
    wetGain.gain.value = wetMix;

    source.connect(dryGain);
    dryGain.connect(analyser);

    source.connect(convolver);
    convolver.connect(filter);
    filter.connect(wetGain);
    wetGain.connect(analyser);

    analyser.connect(ctx.destination);
    analyser.fftSize = 64;

    sourceNodeRef.current = source;
    convolverNodeRef.current = convolver;
    filterNodeRef.current = filter;
    dryGainRef.current = dryGain;
    wetGainRef.current = wetGain;
    analyserRef.current = analyser;

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
    startVisualizer();
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
      if (pauseOffsetRef.current >= duration) {
        pauseOffsetRef.current = 0;
      }
      setupLiveGraph(pauseOffsetRef.current);
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

  function startVisualizer() {
    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (!isPlaying || !analyserRef.current) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(59, 130, 246, ${Math.max(0.3, dataArray[i] / 255)})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }

      if (audioCtxRef.current) {
        const cur = audioCtxRef.current.currentTime - playStartTimeRef.current;
        setCurrentTime(Math.min(duration, cur));
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  }

  function handleSeek(newTime: number) {
    pauseOffsetRef.current = newTime;
    setCurrentTime(newTime);
    if (isPlaying) {
      setupLiveGraph(newTime);
    }
  }

  async function exportProcessedAudio() {
    if (!audioBuffer) return;
    stopPlayback();
    setIsProcessing(true);
    setStatusMsg(t('Rendering reverb spatial audio…'));

    try {
      const sampleRate = audioBuffer.sampleRate;
      const totalLen = Math.floor(sampleRate * (audioBuffer.duration + decay));
      const offlineCtx = new OfflineAudioContext(2, totalLen, sampleRate);

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;

      const dryGain = offlineCtx.createGain();
      const wetGain = offlineCtx.createGain();
      const filter = offlineCtx.createBiquadFilter();
      const convolver = offlineCtx.createConvolver();

      filter.type = 'lowpass';
      filter.frequency.value = damping;
      convolver.buffer = generateImpulseResponse(offlineCtx, decay, 2.5);

      dryGain.gain.value = 1 - wetMix;
      wetGain.gain.value = wetMix;

      source.connect(dryGain);
      dryGain.connect(offlineCtx.destination);

      source.connect(convolver);
      convolver.connect(filter);
      filter.connect(wetGain);
      wetGain.connect(offlineCtx.destination);

      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);

      const baseName = file?.name.substring(0, file.name.lastIndexOf('.')) || 'reverb-audio';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(wavBlob);
      link.download = `${baseName}-${selectedPreset}.wav`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMsg('');
    } catch (err) {
      console.error('Offline rendering error:', err);
      setStatusMsg(t('Error rendering spatial audio.'));
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

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace audioreverb-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audioreverb-title"
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
          <span className="tool-icon emerald">
            <Volume2 size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Audio tools')} <span>/</span> {t('ACOUSTIC REVERB & SPATIAL AUDIO')}
              </span>
              <span className="hd-pill">CONVOLUTION REVERB</span>
            </div>
            <h2 id="audioreverb-title">{t('Acoustic Reverb & Spatial Audio')}</h2>
            <p>
              {t('Immerse audio in cathedral, concert hall, room, or cosmic space acoustics using impulse convolution.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Web Audio · Studio WAV')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visualizer & Transport */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {audioBuffer ? t('SPATIAL ACOUSTIC STAGE') : t('AUDIO WORKBENCH')}
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
                  <Volume2 size={34} />
                </div>
                <h3>{t('Select audio file')}</h3>
                <p>{t('Supports MP3, WAV, AAC, OGG, and FLAC for studio acoustic impulse rendering.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Audio File')}
                </span>
              </button>
            ) : (
              <div className="audioreverb-stage-wrap">
                {/* Visualizer Canvas */}
                <div className="reverb-visualizer-box">
                  <canvas ref={canvasRef} width={420} height={140} className="reverb-canvas" />
                </div>

                {/* Track Info */}
                <div className="reverb-track-meta">
                  <strong className="truncate max-w-[260px]">{file?.name}</strong>
                  <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>

                {/* Scrubber */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="reverb-scrubber"
                />

                {/* Transport Buttons */}
                <div className="reverb-transport-row">
                  <button
                    type="button"
                    className="reverb-reset-btn"
                    onClick={stopPlayback}
                    aria-label={t('Reset')}
                  >
                    <RotateCcw size={16} />
                  </button>

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
                    onClick={exportProcessedAudio}
                  >
                    <ArrowDownToLine size={16} />
                    {isProcessing ? t('Rendering Audio…') : t('Export Studio WAV')}
                  </button>
                </div>

                {statusMsg && <div className="reverb-status-hint">{statusMsg}</div>}
              </div>
            )}
          </div>

          {/* Acoustics Controls */}
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
              <label>{t('Acoustic Environments')}</label>
              <div className="reverb-presets-grid">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`reverb-preset-chip ${selectedPreset === p.id ? 'active' : ''}`}
                    onClick={() => applyPreset(p)}
                  >
                    <strong>{p.name}</strong>
                    <small>{p.decay}s decay</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Wet / Dry Mix')}</span>
                <strong>{Math.round(wetMix * 100)}% Reverb</strong>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={wetMix}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setWetMix(val);
                  if (wetGainRef.current) wetGainRef.current.gain.value = val;
                  if (dryGainRef.current) dryGainRef.current.gain.value = 1 - val;
                }}
              />
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Decay Duration')}</span>
                <strong>{decay.toFixed(1)}s</strong>
              </div>
              <input
                type="range"
                min="0.3"
                max="8.0"
                step="0.1"
                value={decay}
                onChange={(e) => {
                  setDecay(Number(e.target.value));
                  if (isPlaying) setupLiveGraph(pauseOffsetRef.current);
                }}
              />
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Tone Filter (Lowpass)')}</span>
                <strong>{damping} Hz</strong>
              </div>
              <input
                type="range"
                min="800"
                max="12000"
                step="100"
                value={damping}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDamping(val);
                  if (filterNodeRef.current) filterNodeRef.current.frequency.value = val;
                }}
              />
            </div>

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
