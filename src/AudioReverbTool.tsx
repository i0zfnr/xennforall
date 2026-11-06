import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  Disc,
  Download,
  Eye,
  FileAudio,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
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

  // Playback state
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

  // Modal accessibility
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

  // Initial file loading
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      loadAudioFile(initialFiles[0]);
    }
  }, []);

  // Load and decode audio file
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

  // Generate synthetic algorithmic impulse response
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
      // Exponential decay envelope
      const env = Math.pow(n / length, decayFactor);
      // Stereo dispersion white noise
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }

    return impulse;
  }

  // Apply Preset
  function applyPreset(p: ReverbPreset) {
    setSelectedPreset(p.id);
    setDecay(p.decay);
    setDamping(p.damping);
    setWetMix(p.wet);

    if (isPlaying) {
      // Re-create nodes on live graph
      setupLiveGraph(pauseOffsetRef.current);
    }
  }

  // Setup Live Audio Graph
  function setupLiveGraph(offset = 0) {
    if (!audioBuffer) return;
    const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Stop current source
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (_) {}
    }

    // Nodes
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const convolver = ctx.createConvolver();
    const analyser = ctx.createAnalyser();

    filter.type = 'lowpass';
    filter.frequency.value = damping;

    // Generate impulse
    convolver.buffer = generateImpulseResponse(ctx, decay, 2.5);

    dryGain.gain.value = 1 - wetMix;
    wetGain.gain.value = wetMix;

    // Connections
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

  // Toggle Play / Pause
  function togglePlay() {
    if (!audioBuffer) return;

    if (isPlaying) {
      // Pause
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        pauseOffsetRef.current = audioCtxRef.current.currentTime - playStartTimeRef.current;
      }
      setIsPlaying(false);
    } else {
      // Play
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

  // Visualizer loop
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

  // Seek bar scrub
  function handleSeek(newTime: number) {
    pauseOffsetRef.current = newTime;
    setCurrentTime(newTime);
    if (isPlaying) {
      setupLiveGraph(newTime);
    }
  }

  // Offline rendering to WAV
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

  // AudioBuffer to 16-bit PCM WAV Blob
  function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
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

    // RIFF header
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

    // Write samples
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-reverb-title"
      ref={dialogRef as any}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md overflow-hidden animate-fade-in outline-none"
    >
      <div className="bg-surface border border-subtle rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="audio-reverb-title" className="text-lg font-bold text-main leading-tight">
                {t('Acoustic Reverb & Spatial Audio')}
              </h2>
              <p className="text-xs text-muted">
                {t('Convolver impulse acoustics for cathedral, concert hall, room, and ambient spaces')}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-2 text-muted hover:text-main rounded-xl hover:bg-surface-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t('Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Main Player & Visualizer */}
          <div className="lg:col-span-7 bg-black/20 p-5 flex flex-col items-center justify-center gap-5 overflow-y-auto">
            {!audioBuffer ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-subtle hover:border-primary/60 rounded-2xl p-8 max-w-md w-full text-center cursor-pointer transition-all hover:bg-surface/40 flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-main text-base">{t('Select audio file')}</h3>
                <p className="text-xs text-muted leading-relaxed">
                  {t('Supports MP3, WAV, AAC, OGG, and FLAC for studio acoustic impulse rendering.')}
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-2 min-h-[44px] px-5 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {t('Choose Audio File')}
                </button>
              </div>
            ) : (
              <div className="w-full max-w-lg flex flex-col items-center gap-5">
                {/* Visualizer Canvas */}
                <div className="w-full h-32 bg-surface border border-subtle rounded-2xl overflow-hidden relative shadow-sm flex items-end">
                  <canvas ref={canvasRef} width={400} height={120} className="w-full h-full" />
                </div>

                {/* Track Info */}
                <div className="text-center">
                  <p className="text-sm font-bold text-main truncate max-w-xs">{file?.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </p>
                </div>

                {/* Scrubber Range */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />

                {/* Transport Controls */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={stopPlayback}
                    className="p-3 rounded-full bg-surface-alt hover:bg-surface-hover text-muted hover:text-main min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={t('Reset')}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:brightness-110 flex items-center justify-center min-h-[44px] min-w-[44px]"
                    aria-label={isPlaying ? t('Pause') : t('Play')}
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>
                </div>

                {statusMsg && (
                  <p className="text-xs font-semibold text-primary animate-pulse">{statusMsg}</p>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  loadAudioFile(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Acoustics Controls Sidebar */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-subtle p-5 overflow-y-auto flex flex-col gap-5 bg-surface">
            <div>
              <h3 className="text-sm font-bold text-main">{t('Acoustic Environments')}</h3>
              <p className="text-xs text-muted">{t('Select a spatial impulse preset or fine-tune acoustics')}</p>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`py-2 px-3 rounded-xl border text-left transition-all min-h-[44px] flex flex-col justify-center ${
                    selectedPreset === p.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-subtle bg-surface-alt/40 text-muted hover:bg-surface-hover hover:text-main'
                  }`}
                >
                  <span className="text-xs font-bold leading-tight">{p.name}</span>
                  <span className="text-[10px] opacity-70">{p.decay}s decay</span>
                </button>
              ))}
            </div>

            {/* Acoustic Sliders */}
            <div className="border-t border-subtle pt-4 flex flex-col gap-4">
              <label className="text-xs font-semibold text-main">
                {t('Wet / Dry Mix')} ({Math.round(wetMix * 100)}% Reverb)
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
                  className="w-full accent-primary mt-1.5 cursor-pointer"
                />
              </label>

              <label className="text-xs font-semibold text-main">
                {t('Decay Duration')} ({decay.toFixed(1)}s)
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
                  className="w-full accent-primary mt-1.5 cursor-pointer"
                />
              </label>

              <label className="text-xs font-semibold text-main">
                {t('Tone Filter (Lowpass)')} ({damping} Hz)
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
                  className="w-full accent-primary mt-1.5 cursor-pointer"
                />
              </label>
            </div>

            {/* Action Buttons */}
            <div className="mt-auto pt-4 border-t border-subtle flex flex-col gap-2">
              <button
                type="button"
                onClick={exportProcessedAudio}
                disabled={!audioBuffer || isProcessing}
                className="btn btn-primary w-full py-3 min-h-[44px] font-semibold text-sm flex items-center justify-center gap-2"
              >
                <ArrowDownToLine className="w-4 h-4" />
                {isProcessing ? t('Rendering Audio…') : t('Export Studio WAV')}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary w-full py-2.5 min-h-[44px] text-xs flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {audioBuffer ? t('Change Audio File') : t('Select Audio File')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
