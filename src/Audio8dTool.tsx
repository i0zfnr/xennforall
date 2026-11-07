import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Disc,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Upload,
  Volume2,
  X
} from 'lucide-react';

interface Audio8dToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function Audio8dTool({ initialFiles = [], close }: Audio8dToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  // 8D Parameters
  const [speed, setSpeed] = useState<number>(6.0); // seconds per full rotation
  const [orbitRadius, setOrbitRadius] = useState<number>(0.85); // 0.2 to 1.0
  const [reverbMix, setReverbMix] = useState<number>(0.25); // subtle space

  // Playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [orbitAngle, setOrbitAngle] = useState<number>(0);

  // Audio contexts
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);

  // Tracking
  const playStartTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
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

    // Stereo Panner
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0;

    // Reverb / Room Ambience
    const convolver = ctx.createConvolver();
    convolver.buffer = createRoomImpulse(ctx, 1.4);
    const wetGain = ctx.createGain();
    wetGain.gain.value = reverbMix;

    source.connect(panner);
    panner.connect(ctx.destination);

    source.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(ctx.destination);

    sourceNodeRef.current = source;
    pannerNodeRef.current = panner;
    wetGainRef.current = wetGain;

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
    startOrbitLoop();
  }

  function createRoomImpulse(ctx: BaseAudioContext, dur: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * dur);
    const buf = ctx.createBuffer(2, len, rate);
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, 3);
      L[i] = (Math.random() * 2 - 1) * env;
      R[i] = (Math.random() * 2 - 1) * env;
    }
    return buf;
  }

  function startOrbitLoop() {
    function animate() {
      if (!isPlaying || !audioCtxRef.current) return;

      const elapsed = audioCtxRef.current.currentTime - playStartTimeRef.current;
      setCurrentTime(Math.min(duration, elapsed));

      // Calculate pan position: -1 (left) to +1 (right)
      const angle = ((elapsed % speed) / speed) * Math.PI * 2;
      setOrbitAngle(angle);

      const panVal = Math.sin(angle) * orbitRadius;
      if (pannerNodeRef.current) {
        pannerNodeRef.current.pan.value = Math.max(-1, Math.min(1, panVal));
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);
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

  function handleSeek(newTime: number) {
    pauseOffsetRef.current = newTime;
    setCurrentTime(newTime);
    if (isPlaying) {
      setupLiveGraph(newTime);
    }
  }

  async function export8dAudio() {
    if (!audioBuffer) return;
    stopPlayback();
    setIsRendering(true);
    setStatusMsg(t('Rendering 8D spatial audio…'));

    try {
      const sampleRate = audioBuffer.sampleRate;
      const totalLen = Math.floor(sampleRate * audioBuffer.duration);
      const offlineCtx = new OfflineAudioContext(2, totalLen, sampleRate);

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;

      const panner = offlineCtx.createStereoPanner();
      // Automation curve for pan
      const steps = 200;
      const timeStep = audioBuffer.duration / steps;
      for (let i = 0; i < steps; i++) {
        const tVal = i * timeStep;
        const ang = ((tVal % speed) / speed) * Math.PI * 2;
        const pan = Math.sin(ang) * orbitRadius;
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), tVal);
      }

      const convolver = offlineCtx.createConvolver();
      convolver.buffer = createRoomImpulse(offlineCtx, 1.4);
      const wetGain = offlineCtx.createGain();
      wetGain.gain.value = reverbMix;

      source.connect(panner);
      panner.connect(offlineCtx.destination);

      source.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(offlineCtx.destination);

      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);

      const baseName = file?.name.substring(0, file.name.lastIndexOf('.')) || '8d-spatial';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(wavBlob);
      link.download = `${baseName}-8D.wav`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMsg('');
    } catch (err) {
      console.error(err);
      setStatusMsg(t('Failed to render 8D audio.'));
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

  // Visual orbit coordinates
  const orbitX = Math.cos(orbitAngle) * 70;
  const orbitY = Math.sin(orbitAngle) * 45;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace audio8d-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio8d-title"
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
          <span className="tool-icon blue">
            <Headphones size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Audio tools')} <span>/</span> {t('8D SPATIAL AUDIO')}
              </span>
              <span className="hd-pill">BINAURAL ORBIT</span>
            </div>
            <h2 id="audio8d-title">{t('8D Spatial Audio & Headphone Studio')}</h2>
            <p>
              {t('Simulate dynamic 360-degree rotating binaural audio that orbits around your head. Wear headphones for best experience.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Headphone Optimized · 360° Sound')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main 8D Radar Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {audioBuffer ? t('360° ORBIT RADAR') : t('AUDIO WORKBENCH')}
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
                  <Headphones size={34} />
                </div>
                <h3>{t('Select audio file for 8D spatialization')}</h3>
                <p>{t('Supports MP3, WAV, AAC, and FLAC. Creates binaural 360° revolving headphone sound.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Audio File')}
                </span>
              </button>
            ) : (
              <div className="audio8d-stage-wrap">
                {/* 8D Orbit Radar Visualizer */}
                <div className="audio8d-radar-box">
                  <div className="radar-head-center">
                    <Headphones size={32} className="headphone-icon" />
                    <span>YOU</span>
                  </div>

                  {/* Elliptical Orbit Track */}
                  <div className="radar-track-ellipse" />

                  {/* Orbiting Sound Source Satellite */}
                  <div
                    className="radar-satellite-node"
                    style={{
                      transform: `translate(${orbitX}px, ${orbitY}px)`
                    }}
                  >
                    <Disc size={18} className="spin text-blue-400" />
                  </div>
                </div>

                {/* Track Scrubber & Controls */}
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
                    onClick={export8dAudio}
                  >
                    <ArrowDownToLine size={16} />
                    {isRendering ? t('Rendering 8D Audio…') : t('Export 8D Studio WAV')}
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
                <span>{t('Orbit Rotation Speed')}</span>
                <strong>{speed}s / {t('turn')}</strong>
              </div>
              <input
                type="range"
                min="2.0"
                max="16.0"
                step="0.5"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <div className="preset-speed-chips">
                {[3.0, 6.0, 9.0, 12.0].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={speed === s ? 'active' : ''}
                    onClick={() => setSpeed(s)}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Spatial Width / Distance')}</span>
                <strong>{Math.round(orbitRadius * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={orbitRadius}
                onChange={(e) => setOrbitRadius(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Room Ambiance Mix')}</span>
                <strong>{Math.round(reverbMix * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.6"
                step="0.05"
                value={reverbMix}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setReverbMix(val);
                  if (wetGainRef.current) wetGainRef.current.gain.value = val;
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
