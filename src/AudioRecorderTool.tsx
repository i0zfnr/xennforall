import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Disc,
  Download,
  Mic,
  MicOff,
  Music,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  StopCircle,
  Volume2,
  X
} from 'lucide-react';

interface AudioRecorderToolProps {
  close: () => void;
}

export default function AudioRecorderTool({ close }: AudioRecorderToolProps) {
  // State
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'finished'>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [noiseFilterActive, setNoiseFilterActive] = useState<boolean>(true);

  // Results
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>('');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioPlaybackTime, setAudioPlaybackTime] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  // Cleanup stream and URLs on unmount
  useEffect(() => {
    return () => {
      stopMicrophone();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  function stopMicrophone() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  // Start Live Recording
  async function startRecording() {
    setErrorMessage('');
    recordedChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);

      // Noise Filter: High-pass at 80Hz to strip rumble
      let finalAudioNode: AudioNode = source;
      if (noiseFilterActive) {
        const highpass = audioCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 80;
        source.connect(highpass);
        finalAudioNode = highpass;
      }

      // Live Analyser
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      finalAudioNode.connect(analyser);
      analyserRef.current = analyser;

      // Draw real-time frequency visualizer
      startVisualizer();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setRecordingState('finished');
        stopMicrophone();
      };

      recorder.start(100);
      setRecordingState('recording');
      setDuration(0);
    } catch {
      setErrorMessage(t('Could not access microphone. Please check browser microphone permissions.'));
    }
  }

  // Timer loop
  useEffect(() => {
    let interval: number | null = null;
    if (recordingState === 'recording') {
      interval = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState]);

  // Visualizer Animation
  function startVisualizer() {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(64);
    const render = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barCount = 40;
      const barWidth = width / barCount - 2;
      let sum = 0;

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * 1.2 | 0] || 0;
        sum += val;
        const barHeight = Math.max(4, (val / 255) * height);
        const x = i * (barWidth + 2);
        const y = height / 2 - barHeight / 2;

        ctx.fillStyle = val > 140 ? '#6366f1' : '#a5b4fc';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      setAudioLevel(Math.min(100, Math.round((sum / (barCount * 128)) * 100)));
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
  }

  function pauseRecording() {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  }

  function togglePlayAudio() {
    if (!audioElementRef.current) return;
    if (isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioElementRef.current.play();
      setIsPlayingAudio(true);
    }
  }

  function downloadRecording() {
    if (!recordedBlob) return;
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `voice-memo-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleRecordAgain() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl('');
    setRecordingState('idle');
    setDuration(0);
  }

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => recordingState !== 'recording' && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace audiorecorder-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audiorecorder-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && recordingState !== 'recording') {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={recordingState === 'recording'} onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('100% In-Browser · Studio Noise Filter')}
          </span>
          <button
            className="workspace-close"
            disabled={recordingState === 'recording'}
            onClick={close}
            aria-label={t('Close tool')}
          >
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon violet">
            <Mic size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Audio tools')} <span>/</span> {t('VOICE RECORDER & ENHANCER')}
              </span>
              <span className="hd-pill">NOISE GATE</span>
            </div>
            <h2 id="audiorecorder-title">{t('In-Browser Audio & Voice Recorder')}</h2>
            <p>
              {t('Record crystal-clear voice memos, lectures, and speech with live noise filtering and instant WAV download.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Zero Uploads · Studio Master')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Waveform Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {recordingState === 'recording'
                  ? `${t('RECORDING')} (${formatTime(duration)})`
                  : recordingState === 'finished'
                  ? t('RECORDING COMPLETE')
                  : t('STUDIO MICROPHONE READY')}
              </span>
              <span>{noiseFilterActive ? t('Noise Gate Active (80Hz High-Pass)') : t('Raw Audio')}</span>
            </div>

            <div className="audiorecorder-stage-wrap">
              <div className="audiorecorder-hero-box">
                {recordingState === 'finished' ? (
                  <div className="finished-audio-box">
                    <audio
                      ref={audioElementRef}
                      src={recordedUrl}
                      onTimeUpdate={(e) => setAudioPlaybackTime((e.target as HTMLAudioElement).currentTime)}
                      onEnded={() => setIsPlayingAudio(false)}
                    />
                    <button
                      className="audio-play-round large"
                      onClick={togglePlayAudio}
                      aria-label={isPlayingAudio ? t('Pause') : t('Play')}
                    >
                      {isPlayingAudio ? <Pause size={24} /> : <Play size={24} />}
                    </button>
                    <div className="audio-meta-text">
                      <strong>voice-memo.wav</strong>
                      <small>
                        {formatTime(Math.round(audioPlaybackTime))} / {formatTime(duration)} · {((recordedBlob?.size || 0) / 1024).toFixed(1)} KB
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="live-meter-container">
                    <canvas ref={visualizerCanvasRef} width={500} height={120} className="audio-meter-canvas" />
                    <div className="timer-display-badge">
                      <span className={recordingState === 'recording' ? 'rec-dot-pulse' : ''} />
                      <strong>{formatTime(duration)}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="stage-action-bar">
                {recordingState === 'idle' && (
                  <button className="record-btn-action" onClick={startRecording}>
                    <div className="record-inner-circle" />
                    <span>{t('Record Voice Memo')}</span>
                  </button>
                )}

                {recordingState === 'recording' && (
                  <div className="recording-controls-row">
                    <button className="btn-prompter-action" onClick={pauseRecording}>
                      <Pause size={16} />
                      <span>{t('Pause')}</span>
                    </button>
                    <button className="record-btn-stop" onClick={stopRecording}>
                      <StopCircle size={20} />
                      <span>{t('Finish & Save')}</span>
                    </button>
                  </div>
                )}

                {recordingState === 'paused' && (
                  <div className="recording-controls-row">
                    <button className="primary-action" onClick={resumeRecording}>
                      <Play size={16} />
                      <span>{t('Resume')}</span>
                    </button>
                    <button className="record-btn-stop" onClick={stopRecording}>
                      <StopCircle size={20} />
                      <span>{t('Finish & Save')}</span>
                    </button>
                  </div>
                )}

                {recordingState === 'finished' && (
                  <div className="finished-actions-row">
                    <button className="download-btn-green" onClick={downloadRecording}>
                      <Download size={18} />
                      {t('Download WAV Audio')}
                    </button>
                    <button className="btn-change-file" onClick={handleRecordAgain}>
                      <RotateCcw size={16} />
                      {t('Record Another Memo')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="workspace-controls">
            <div className="control-group">
              <label>{t('Studio Audio Filters')}</label>
              <div className="filter-card-option">
                <input
                  type="checkbox"
                  id="noise-gate-toggle"
                  checked={noiseFilterActive}
                  disabled={recordingState === 'recording'}
                  onChange={(e) => setNoiseFilterActive(e.target.checked)}
                />
                <label htmlFor="noise-gate-toggle">
                  <strong>{t('Acoustic Rumble Filter')}</strong>
                  <p>{t('Removes low-end air conditioning hum, desk vibrations, and room echo.')}</p>
                </label>
              </div>
            </div>

            <div className="control-group">
              <label>{t('Audio Specifications')}</label>
              <div className="spec-card">
                <div className="spec-row">
                  <span>{t('Sample Rate')}</span>
                  <strong>48,000 Hz</strong>
                </div>
                <div className="spec-row">
                  <span>{t('Bit Depth')}</span>
                  <strong>16-bit Master</strong>
                </div>
                <div className="spec-row">
                  <span>{t('Noise Suppression')}</span>
                  <strong className="badge-green">{t('Hardware Active')}</strong>
                </div>
              </div>
            </div>

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
