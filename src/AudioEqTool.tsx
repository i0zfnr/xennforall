import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Upload,
  Volume2,
  X
} from 'lucide-react';

interface AudioEqToolProps {
  initialFiles?: File[];
  close: () => void;
}

interface EqBand {
  freq: number;
  label: string;
  type: BiquadFilterType;
  gain: number; // dB (-12 to +12)
}

const DEFAULT_BANDS: EqBand[] = [
  { freq: 60, label: '60 Hz (Sub)', type: 'lowshelf', gain: 0 },
  { freq: 170, label: '170 Hz (Bass)', type: 'peaking', gain: 0 },
  { freq: 350, label: '350 Hz (Warmth)', type: 'peaking', gain: 0 },
  { freq: 1000, label: '1 kHz (Mids)', type: 'peaking', gain: 0 },
  { freq: 3000, label: '3 kHz (Presence)', type: 'peaking', gain: 0 },
  { freq: 6000, label: '6 kHz (Brilliance)', type: 'peaking', gain: 0 },
  { freq: 12000, label: '12 kHz (Air)', type: 'highshelf', gain: 0 }
];

interface EqPreset {
  id: string;
  name: string;
  gains: number[];
}

const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', name: 'Flat Reference', gains: [0, 0, 0, 0, 0, 0, 0] },
  { id: 'bass', name: 'Bass Booster', gains: [6, 5, 2, 0, -1, 0, 1] },
  { id: 'vocal', name: 'Vocal Clarity', gains: [-3, -2, 1, 3, 5, 3, 2] },
  { id: 'podcast', name: 'Podcast De-Mud', gains: [-5, -3, -2, 2, 4, 2, 0] },
  { id: 'bright', name: 'Bright Shimmer', gains: [-2, -1, 0, 1, 3, 5, 6] },
  { id: 'warm', name: 'Acoustic Warmth', gains: [3, 4, 3, 1, -1, -2, -3] }
];

export default function AudioEqTool({ initialFiles = [], close }: AudioEqToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [bands, setBands] = useState<EqBand[]>(DEFAULT_BANDS);
  const [activePreset, setActivePreset] = useState<string>('flat');

  // Playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Audio nodes & contexts
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const filterNodesRef = useRef<BiquadFilterNode[]>([]);
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
      setDuration(decoded.duration);
      setCurrentTime(0);
      pauseOffsetRef.current = 0;
      setStatusMsg('');
    } catch (err) {
      console.error(err);
      setStatusMsg(t('Failed to decode audio. Please try another file.'));
    }
  }

  function applyPreset(p: EqPreset) {
    setActivePreset(p.id);
    const updated = bands.map((b, i) => ({ ...b, gain: p.gains[i] ?? 0 }));
    setBands(updated);

    // Apply live to running filters
    if (filterNodesRef.current.length > 0) {
      filterNodesRef.current.forEach((node, i) => {
        if (node && updated[i]) {
          node.gain.value = updated[i].gain;
        }
      });
    }
  }

  function handleBandChange(index: number, newGain: number) {
    setActivePreset('custom');
    const updated = [...bands];
    updated[index].gain = newGain;
    setBands(updated);

    if (filterNodesRef.current[index]) {
      filterNodesRef.current[index].gain.value = newGain;
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

    // Create 7 biquad filter nodes chained in series
    const createdFilters: BiquadFilterNode[] = bands.map((b) => {
      const f = ctx.createBiquadFilter();
      f.type = b.type;
      f.frequency.value = b.freq;
      f.gain.value = b.gain;
      return f;
    });

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    // Chain: source -> filter0 -> filter1 -> ... -> filter6 -> analyser -> destination
    let lastNode: AudioNode = source;
    createdFilters.forEach((f) => {
      lastNode.connect(f);
      lastNode = f;
    });
    lastNode.connect(analyser);
    analyser.connect(ctx.destination);

    filterNodesRef.current = createdFilters;
    analyserRef.current = analyser;
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
        ctx.fillStyle = `rgba(99, 102, 241, ${Math.max(0.3, dataArray[i] / 255)})`;
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

  async function exportEqAudio() {
    if (!audioBuffer) return;
    stopPlayback();
    setIsRendering(true);
    setStatusMsg(t('Rendering equalized master audio…'));

    try {
      const sampleRate = audioBuffer.sampleRate;
      const totalLen = Math.floor(sampleRate * audioBuffer.duration);
      const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, totalLen, sampleRate);

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;

      let lastNode: AudioNode = source;
      bands.forEach((b) => {
        const f = offlineCtx.createBiquadFilter();
        f.type = b.type;
        f.frequency.value = b.freq;
        f.gain.value = b.gain;
        lastNode.connect(f);
        lastNode = f;
      });

      lastNode.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);

      const baseName = file?.name.substring(0, file.name.lastIndexOf('.')) || 'equalized-audio';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(wavBlob);
      link.download = `${baseName}-${activePreset}-eq.wav`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMsg('');
    } catch (err) {
      console.error(err);
      setStatusMsg(t('Failed to render audio.'));
    } finally {
      setIsRendering(false);
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
        className="tool-workspace audioeq-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audioeq-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !isRendering) {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={isRendering} onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('Private & Client-Side · 100% In-Browser')}
          </span>
          <button className="workspace-close" disabled={isRendering} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon violet">
            <Sliders size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Audio tools')} <span>/</span> {t('PARAMETRIC EQUALIZER & BASS BOOSTER')}
              </span>
              <span className="hd-pill">7-BAND EQ</span>
            </div>
            <h2 id="audioeq-title">{t('Vocal Equalizer & Bass Booster')}</h2>
            <p>
              {t('Fine-tune acoustic frequencies, boost deep bass, and sculpt vocal warmth with real-time spectrum feedback.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Lossless WAV · Studio Precision')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main EQ Sliders & Spectrum Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {audioBuffer ? t('PARAMETRIC FREQUENCY STAGE') : t('AUDIO WORKBENCH')}
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
                  <Sliders size={34} />
                </div>
                <h3>{t('Select audio file to equalize')}</h3>
                <p>{t('Supports MP3, WAV, AAC, OGG, and FLAC for studio parametric equalization.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Audio File')}
                </span>
              </button>
            ) : (
              <div className="audioeq-stage-wrap">
                {/* Visualizer Canvas */}
                <div className="reverb-visualizer-box">
                  <canvas ref={canvasRef} width={420} height={130} className="reverb-canvas" />
                </div>

                {/* Vertical Graphic EQ Sliders Strip */}
                <div className="audioeq-sliders-strip">
                  {bands.map((band, idx) => (
                    <div key={band.freq} className="eq-band-col">
                      <span className="eq-gain-val">
                        {band.gain > 0 ? `+${band.gain}` : band.gain} dB
                      </span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={band.gain}
                        onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                        className="eq-vertical-slider"
                      />
                      <span className="eq-band-label">{band.label.split(' ')[0]}</span>
                      <small className="eq-sub-freq">{band.freq >= 1000 ? `${band.freq / 1000}k` : `${band.freq}`}Hz</small>
                    </div>
                  ))}
                </div>

                {/* Track Scrubber & Transport */}
                <div className="reverb-track-meta">
                  <strong className="truncate max-w-[260px]">{file?.name}</strong>
                  <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="reverb-scrubber"
                />

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
                    disabled={isRendering}
                    onClick={exportEqAudio}
                  >
                    <ArrowDownToLine size={16} />
                    {isRendering ? t('Rendering Equalized Master…') : t('Export Studio WAV')}
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
              <label>{t('Acoustic EQ Presets')}</label>
              <div className="reverb-presets-grid">
                {EQ_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`reverb-preset-chip ${activePreset === p.id ? 'active' : ''}`}
                    onClick={() => applyPreset(p)}
                  >
                    <strong>{p.name}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <button
                type="button"
                className="btn-change-file"
                onClick={() => applyPreset(EQ_PRESETS[0])}
              >
                <RotateCcw size={14} />
                {t('Reset to Flat Reference')}
              </button>
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
