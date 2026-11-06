import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Disc,
  Download,
  Gauge,
  Music,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Upload,
  Volume2,
  X
} from 'lucide-react';

interface AudioShiftToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function AudioShiftTool({ initialFiles = [], close }: AudioShiftToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState<number>(0);

  // Settings
  const [speed, setSpeed] = useState<number>(1.0); // 0.5x to 2.0x
  const [pitchSemitones, setPitchSemitones] = useState<number>(0); // -12 to +12 semitones
  const [loop, setLoop] = useState<boolean>(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackPos, setPlaybackPos] = useState<number>(0);

  // Result
  const [busy, setBusy] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [shiftedBlob, setShiftedBlob] = useState<Blob | null>(null);
  const [shiftedUrl, setShiftedUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
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
      if (shiftedUrl) URL.revokeObjectURL(shiftedUrl);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [shiftedUrl]);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  async function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    const valid = f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name);
    if (!valid) {
      setErrorMessage(t('Please select a valid audio file (MP3, WAV, M4A).'));
      return;
    }

    stopPlayback();
    if (shiftedUrl) URL.revokeObjectURL(shiftedUrl);
    setShiftedBlob(null);
    setShiftedUrl('');
    setFile(f);
    setBusy(true);

    try {
      const buffer = await f.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const decoded = await audioCtx.decodeAudioData(buffer);
      setAudioBuffer(decoded);
      setDuration(decoded.duration);
      setSpeed(1.0);
      setPitchSemitones(0);
    } catch {
      setErrorMessage(t('Could not decode audio. The file may be corrupt or in an unsupported format.'));
    } finally {
      setBusy(false);
    }
  }

  // Calculate playback rate combining speed and semitone pitch
  // semitone ratio = 2^(semitones / 12)
  const combinedRate = speed * Math.pow(2, pitchSemitones / 12);

  // Live Playback Controller
  function togglePlayback() {
    if (!audioBuffer || !audioContextRef.current) return;

    if (isPlaying) {
      stopPlayback();
    } else {
      const audioCtx = audioContextRef.current;
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = combinedRate;
      source.loop = loop;
      source.connect(audioCtx.destination);

      source.start(0, playbackPos);
      activeSourceRef.current = source;
      playbackStartTimeRef.current = audioCtx.currentTime - (playbackPos / combinedRate);
      setIsPlaying(true);

      const trackLoop = () => {
        if (!activeSourceRef.current) return;
        const elapsed = (audioCtx.currentTime - playbackStartTimeRef.current) * combinedRate;
        if (elapsed >= audioBuffer.duration && !loop) {
          stopPlayback();
        } else {
          setPlaybackPos(elapsed % audioBuffer.duration);
          animFrameRef.current = requestAnimationFrame(trackLoop);
        }
      };
      animFrameRef.current = requestAnimationFrame(trackLoop);

      source.onended = () => {
        if (!loop) stopPlayback();
      };
    }
  }

  function stopPlayback() {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch {}
      activeSourceRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
  }

  // Live parameter update while playing
  useEffect(() => {
    if (activeSourceRef.current && isPlaying) {
      activeSourceRef.current.playbackRate.value = combinedRate;
    }
  }, [combinedRate, isPlaying]);

  // Render and export shifted audio offline to 16-bit WAV
  async function renderShiftedAudio() {
    if (!audioBuffer || !file) return;
    stopPlayback();
    setBusy(true);
    setStatusMsg(t('Rendering pitch & tempo transformed master…'));
    setErrorMessage('');

    try {
      const sampleRate = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;
      const newDuration = audioBuffer.duration / combinedRate;
      const newLength = Math.floor(newDuration * sampleRate);

      const offlineCtx = new OfflineAudioContext(numChannels, newLength, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = combinedRate;
      source.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();

      // Encode to 16-bit PCM WAV
      const blockAlign = numChannels * 2;
      const dataByteCount = renderedBuffer.length * blockAlign;
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
      const channelData: Float32Array[] = [];
      for (let c = 0; c < numChannels; c++) {
        channelData.push(renderedBuffer.getChannelData(c));
      }

      for (let i = 0; i < renderedBuffer.length; i++) {
        for (let c = 0; c < numChannels; c++) {
          let s = channelData[c][i];
          s = Math.max(-1, Math.min(1, s));
          const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
          view.setInt16(offset, intSample, true);
          offset += 2;
        }
      }

      const blob = new Blob([buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setShiftedBlob(blob);
      setShiftedUrl(url);
      setStatusMsg('');
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to process audio shift.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadShiftedAudio() {
    if (!shiftedBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = shiftedUrl;
    a.download = `${baseName}-shifted.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function formatSec(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace audioshift-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audioshift-title"
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
            {t('Private & Client-Side · Studio Pitch & Tempo Engine')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon violet">
            <Gauge size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Audio tools')} <span>/</span> {t('AUDIO PITCH & SPEED SHIFTER')}
              </span>
              <span className="hd-pill">SEMITONE TRANSPOSE</span>
            </div>
            <h2 id="audioshift-title">{t('Audio Pitch & Speed Shifter')}</h2>
            <p>
              {t('Change audio playback speed or transpose musical pitch (+/- 12 semitones) for singing, study, or karaoke.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Real-Time · Studio Master')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {audioBuffer ? t('PITCH & TEMPO CONTROLLER') : t('AUDIO WORKBENCH')}
              </span>
              <span>{file ? file.name : t('Select audio file')}</span>
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
                  <Gauge size={34} />
                </div>
                <h3>{t('Drop song or podcast here')}</h3>
                <p>{t('Supports MP3, WAV, M4A, and AAC. Change pitch and tempo with live real-time preview.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select audio')}
                </span>
              </button>
            ) : (
              <div className="audioshift-stage-wrap">
                <div className="audioshift-hero-card">
                  <div className="audioshift-visual-ring">
                    <div className="ring-stat">
                      <strong>{speed}x</strong>
                      <span>{t('Playback Speed')}</span>
                    </div>
                    <div className="ring-stat">
                      <strong className={pitchSemitones !== 0 ? 'highlight-semitone' : ''}>
                        {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones}
                      </strong>
                      <span>{t('Semitones')}</span>
                    </div>
                  </div>

                  <div className="audioshift-playback-row">
                    <button
                      className="audio-play-round large"
                      onClick={togglePlayback}
                      aria-label={isPlaying ? t('Pause') : t('Play')}
                    >
                      {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>

                    <div className="playback-time-meta">
                      <strong>{file.name}</strong>
                      <small>
                        {formatSec(playbackPos)} / {formatSec(duration)} · {t('Modified Duration')}: {formatSec(duration / combinedRate)}
                      </small>
                    </div>

                    <button
                      type="button"
                      className={`btn-toggle-loop ${loop ? 'active' : ''}`}
                      onClick={() => setLoop(!loop)}
                    >
                      <RotateCcw size={15} />
                      {t('Loop')}
                    </button>
                  </div>
                </div>

                {shiftedBlob && (
                  <div className="trimmed-success-card">
                    <Check size={18} />
                    <span>
                      {t('Transformed audio ready!')} ({(shiftedBlob.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button className="download-btn-green" onClick={downloadShiftedAudio}>
                      <Download size={16} />
                      {t('Download Shifted Audio (WAV)')}
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
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {audioBuffer && (
              <>
                <div className="control-group">
                  <div className="slider-label-row">
                    <span>{t('Playback Speed')}</span>
                    <strong>{speed}x</strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  />
                  <div className="preset-speed-chips">
                    {[0.75, 1.0, 1.25, 1.5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        className={speed === val ? 'active' : ''}
                        onClick={() => setSpeed(val)}
                      >
                        {val}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-group">
                  <div className="slider-label-row">
                    <span>{t('Musical Pitch Transpose')}</span>
                    <strong>{pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} {t('semitones')}</strong>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={pitchSemitones}
                    onChange={(e) => setPitchSemitones(Number(e.target.value))}
                  />
                  <div className="preset-speed-chips">
                    {[-3, -2, -1, 0, 1, 2, 3].map((semi) => (
                      <button
                        key={semi}
                        type="button"
                        className={pitchSemitones === semi ? 'active' : ''}
                        onClick={() => setPitchSemitones(semi)}
                      >
                        {semi > 0 ? `+${semi}` : semi}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="primary-action"
                  disabled={busy}
                  onClick={renderShiftedAudio}
                >
                  {busy ? <RotateCw size={17} className="spin" /> : <Sparkles size={17} />}
                  {busy ? statusMsg : t('Render & Export Master')}
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
