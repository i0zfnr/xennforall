import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Film,
  FlipHorizontal,
  Maximize2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  StopCircle,
  Video,
  VideoOff,
  Volume2,
  X
} from 'lucide-react';

interface CinematicStudioToolProps {
  close: () => void;
  onSendToStatusHd?: (file: File) => void;
}

export default function CinematicStudioTool({ close, onSendToStatusHd }: CinematicStudioToolProps) {
  // Camera & Stream State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');

  // Cinematic Blur Settings
  const [blurMode, setBlurMode] = useState<'none' | 'subtle' | 'cinematic' | 'studio'>('cinematic');
  const [blurRadius, setBlurRadius] = useState<number>(14);
  const [focusZoneWidth, setFocusZoneWidth] = useState<number>(48); // % width of presenter focus zone

  // Teleprompter State
  const [prompterText, setPrompterText] = useState<string>(
    `Welcome everyone! In this presentation, I am excited to walk you through our latest updates and key results.\n\nEverything you see here is running 100% privately in your browser without any server uploads.\n\nKeep your eyes focused near the top of the screen to maintain direct, confident eye contact with your audience.\n\nThank you for watching, and let's dive into the details!`
  );
  const [prompterVisible, setPrompterVisible] = useState<boolean>(true);
  const [prompterScrolling, setPrompterScrolling] = useState<boolean>(false);
  const [prompterSpeed, setPrompterSpeed] = useState<number>(3); // 1 to 10
  const [prompterFontSize, setPrompterFontSize] = useState<number>(22);
  const [prompterMirror, setPrompterMirror] = useState<boolean>(false);
  const [prompterOpacity, setPrompterOpacity] = useState<number>(85);

  // Recording State
  const [recordingState, setRecordingState] = useState<'idle' | 'countdown' | 'recording' | 'finished'>('idle');
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Hardware capabilities
  const [hasNativeBlur, setHasNativeBlur] = useState<boolean>(false);

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const videoInputRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prompterBoxRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const prompterIntervalRef = useRef<number | null>(null);

  // Modal Lock & Accessibility
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

  // Initialize Camera
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Cleanup recorded url
  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  async function startCamera() {
    setCameraError('');
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCameraActive(true);

      if (videoInputRef.current) {
        videoInputRef.current.srcObject = mediaStream;
        await videoInputRef.current.play();
      }

      // Check native blur support
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack as any).getCapabilities ? (videoTrack as any).getCapabilities() : {};
        if (capabilities.backgroundBlur) {
          setHasNativeBlur(true);
        }
      }

      // Audio visualizer setup
      setupAudioMeter(mediaStream);

      // Start render loop
      startRenderPipeline();
    } catch {
      setCameraError(t('Unable to access camera or microphone. Please verify browser permissions.'));
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (prompterIntervalRef.current) {
      clearInterval(prompterIntervalRef.current);
      prompterIntervalRef.current = null;
    }
    setCameraActive(false);
  }

  // Live Audio Level Analyser
  function setupAudioMeter(mediaStream: MediaStream) {
    try {
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (!audioTrack) return;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(mediaStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkAudio = () => {
        if (!micAnalyserRef.current) return;
        micAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        requestAnimationFrame(checkAudio);
      };
      checkAudio();
    } catch {
      // Audio meter not critical
    }
  }

  // Real-Time Cinematic Bokeh Pipeline
  function startRenderPipeline() {
    const render = () => {
      const video = videoInputRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;

          if (blurMode === 'none') {
            // Crisp standard video
            ctx.filter = 'none';
            ctx.drawImage(video, 0, 0, w, h);
          } else {
            const radius = blurMode === 'subtle' ? 8 : blurMode === 'cinematic' ? 16 : 26;

            // 1. Draw blurred full background
            ctx.save();
            ctx.filter = `blur(${radius}px)`;
            // Slight overscale to prevent border bleed
            ctx.drawImage(video, -radius * 1.5, -radius * 1.5, w + radius * 3, h + radius * 3);
            ctx.restore();

            // 2. Composite sharp presenter focus zone in center foreground with cinematic feathered vignette
            ctx.save();
            const centerX = w / 2;
            const centerY = h * 0.52;
            const radiusX = (w * (focusZoneWidth / 100)) / 1.5;
            const radiusY = h * 0.56;

            const gradient = ctx.createRadialGradient(
              centerX,
              centerY,
              radiusX * 0.45,
              centerX,
              centerY,
              radiusX
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.95)');
            gradient.addColorStop(0.9, 'rgba(0, 0, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            // Masking canvas
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.clip();

            ctx.filter = 'none';
            ctx.drawImage(video, 0, 0, w, h);
            ctx.restore();
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
  }

  // Teleprompter Auto-Scroll Loop
  useEffect(() => {
    if (prompterScrolling) {
      prompterIntervalRef.current = window.setInterval(() => {
        if (prompterBoxRef.current) {
          const scrollAmount = prompterSpeed * 0.9;
          prompterBoxRef.current.scrollTop += scrollAmount;

          // Auto stop when reached end
          if (
            prompterBoxRef.current.scrollTop + prompterBoxRef.current.clientHeight >=
            prompterBoxRef.current.scrollHeight - 5
          ) {
            setPrompterScrolling(false);
          }
        }
      }, 40);
    } else {
      if (prompterIntervalRef.current) {
        clearInterval(prompterIntervalRef.current);
        prompterIntervalRef.current = null;
      }
    }

    return () => {
      if (prompterIntervalRef.current) clearInterval(prompterIntervalRef.current);
    };
  }, [prompterScrolling, prompterSpeed]);

  function resetPrompter() {
    setPrompterScrolling(false);
    if (prompterBoxRef.current) {
      prompterBoxRef.current.scrollTop = 0;
    }
  }

  // Recording Execution
  function startCountdown() {
    setRecordingState('countdown');
    setCountdownNum(3);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNum(count);
      } else {
        clearInterval(interval);
        beginRecording();
      }
    }, 1000);
  }

  function beginRecording() {
    if (!canvasRef.current || !stream) return;
    setRecordingState('recording');
    setRecordDuration(0);
    recordedChunksRef.current = [];

    // Capture processed cinematic canvas video stream
    const canvasStream = canvasRef.current.captureStream(30);

    // Merge mic audio track
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }

    const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
      ? 'video/mp4;codecs=avc1'
      : MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : 'video/webm;codecs=vp9';

    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 8000000 // 8 Mbps high clarity
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const finalBlob = new Blob(recordedChunksRef.current, { type: mimeType.split(';')[0] });
      const url = URL.createObjectURL(finalBlob);
      setRecordedBlob(finalBlob);
      setRecordedUrl(url);
      setRecordingState('finished');
      setPrompterScrolling(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(200);

    // Auto-scroll prompter with recording
    setPrompterScrolling(true);
  }

  // Recording timer
  useEffect(() => {
    let timer: number | null = null;
    if (recordingState === 'recording') {
      timer = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recordingState]);

  function stopRecording() {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  function downloadRecording() {
    if (!recordedBlob) return;
    const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `cinematic-presentation-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleRecordAgain() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl('');
    setRecordingState('idle');
    setRecordDuration(0);
    resetPrompter();
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
        className="tool-workspace cinematic-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cinematic-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && recordingState !== 'recording') {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Hidden Source Video Element */}
        <video ref={videoInputRef} playsInline muted style={{ display: 'none' }} />

        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={recordingState === 'recording'} onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('100% In-Browser · Zero Video Uploads')}
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
            <Camera size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Video tools')} <span>/</span> {t('CINEMATIC STUDIO & TELEPROMPTER')}
              </span>
              <span className="hd-pill">PORTRAIT BOKEH</span>
            </div>
            <h2 id="cinematic-title">{t('Cinematic Studio Recorder & Teleprompter')}</h2>
            <p>
              {t('Record professional presentations with creamy cinematic background blur and a floating teleprompter directly in your browser.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Studio Quality · Direct Eye Contact')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas cinematic-stage-column">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {recordingState === 'recording'
                  ? `${t('RECORDING')} (${formatTime(recordDuration)})`
                  : recordingState === 'finished'
                  ? t('RECORDING COMPLETE')
                  : t('CAMERA LIVE PREVIEW')}
              </span>
              <span>
                {recordingState === 'recording' && <span className="rec-dot-pulse" />}
                {blurMode !== 'none' ? `${t('Cinematic Blur Active')} (${blurMode})` : t('Standard Camera')}
              </span>
            </div>

            {/* Video & Canvas Stage */}
            <div className="cinematic-stage-wrap">
              {recordingState === 'finished' ? (
                <div className="finished-video-preview">
                  <video src={recordedUrl} controls autoPlay className="cinematic-result-video" />
                </div>
              ) : (
                <div className="live-camera-container">
                  <canvas ref={canvasRef} className="cinematic-canvas-viewport" />

                  {/* 3-2-1 Countdown Overlay */}
                  {recordingState === 'countdown' && (
                    <div className="countdown-overlay">
                      <div className="countdown-circle">{countdownNum}</div>
                    </div>
                  )}

                  {/* Floating Eye-Level Teleprompter */}
                  {prompterVisible && (
                    <div
                      className={`floating-prompter-glass ${prompterMirror ? 'mirrored' : ''}`}
                      style={{
                        backgroundColor: `rgba(15, 23, 42, ${prompterOpacity / 100})`
                      }}
                    >
                      <div className="prompter-top-indicator">
                        <span>{t('LOOK HERE FOR DIRECT EYE CONTACT')}</span>
                      </div>
                      <div
                        ref={prompterBoxRef}
                        className="prompter-scroll-body"
                        style={{ fontSize: `${prompterFontSize}px` }}
                      >
                        {prompterText}
                      </div>
                    </div>
                  )}

                  {/* Recording Timer & Audio Indicator HUD */}
                  {recordingState === 'recording' && (
                    <div className="recording-hud-bar">
                      <div className="hud-rec-badge">
                        <span className="rec-pulse-circle" />
                        <span>REC {formatTime(recordDuration)}</span>
                      </div>
                      <div className="hud-audio-meter">
                        <Mic size={14} />
                        <div className="meter-track">
                          <div className="meter-fill" style={{ width: `${audioLevel}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Camera Error Banner */}
              {cameraError && (
                <div className="camera-error-wrap">
                  <VideoOff size={32} />
                  <p>{cameraError}</p>
                  <button className="primary-action small" onClick={startCamera}>
                    <RotateCw size={15} />
                    {t('Retry Camera Access')}
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="stage-action-bar">
              {recordingState === 'idle' && (
                <button className="record-btn-action" disabled={!cameraActive} onClick={startCountdown}>
                  <div className="record-inner-circle" />
                  <span>{t('Start Recording')}</span>
                </button>
              )}

              {recordingState === 'recording' && (
                <button className="record-btn-stop" onClick={stopRecording}>
                  <StopCircle size={22} />
                  <span>{t('Finish Recording')}</span>
                </button>
              )}

              {recordingState === 'finished' && (
                <div className="finished-actions-row">
                  <button className="download-btn-green" onClick={downloadRecording}>
                    <Download size={18} />
                    {t('Download Video')}
                  </button>
                  {onSendToStatusHd && recordedBlob && (
                    <button
                      className="primary-action"
                      onClick={() => {
                        const file = new File([recordedBlob], 'presentation.mp4', { type: recordedBlob.type });
                        onSendToStatusHd(file);
                      }}
                    >
                      <Sparkles size={16} />
                      {t('Optimize for WhatsApp HD')}
                    </button>
                  )}
                  <button className="btn-change-file" onClick={handleRecordAgain}>
                    <RotateCcw size={16} />
                    {t('Record Another Take')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="workspace-controls">
            {/* Cinematic Background Blur Mode */}
            <div className="control-group">
              <label>{t('Cinematic Background Blur')}</label>
              <div className="blur-selector-grid">
                <button
                  type="button"
                  className={blurMode === 'none' ? 'active' : ''}
                  onClick={() => setBlurMode('none')}
                >
                  <strong>{t('Off')}</strong>
                  <small>{t('Sharp room')}</small>
                </button>
                <button
                  type="button"
                  className={blurMode === 'subtle' ? 'active' : ''}
                  onClick={() => setBlurMode('subtle')}
                >
                  <strong>{t('Subtle')}</strong>
                  <small>{t('f/2.8 Look')}</small>
                </button>
                <button
                  type="button"
                  className={blurMode === 'cinematic' ? 'active' : ''}
                  onClick={() => setBlurMode('cinematic')}
                >
                  <strong>{t('Cinematic')}</strong>
                  <small>{t('f/1.8 Bokeh')}</small>
                </button>
                <button
                  type="button"
                  className={blurMode === 'studio' ? 'active' : ''}
                  onClick={() => setBlurMode('studio')}
                >
                  <strong>{t('Studio')}</strong>
                  <small>{t('Deep defocus')}</small>
                </button>
              </div>
            </div>

            {blurMode !== 'none' && (
              <div className="control-group">
                <div className="slider-label-row">
                  <span>{t('Presenter Focus Area')}</span>
                  <span>{focusZoneWidth}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="70"
                  value={focusZoneWidth}
                  onChange={(e) => setFocusZoneWidth(Number(e.target.value))}
                />
              </div>
            )}

            {/* Teleprompter Script Controller */}
            <div className="control-group prompter-settings-card">
              <div className="prompter-header-row">
                <div className="prompter-title">
                  <FileText size={16} />
                  <strong>{t('Teleprompter Script')}</strong>
                </div>
                <button
                  type="button"
                  className="icon-toggle-btn"
                  onClick={() => setPrompterVisible(!prompterVisible)}
                  aria-label={t('Toggle Prompter')}
                >
                  <Eye size={16} />
                  <span>{prompterVisible ? t('Visible') : t('Hidden')}</span>
                </button>
              </div>

              {prompterVisible && (
                <>
                  <textarea
                    rows={4}
                    value={prompterText}
                    onChange={(e) => setPrompterText(e.target.value)}
                    placeholder={t('Type or paste your presentation speech here…')}
                    className="prompter-textarea"
                  />

                  {/* Prompter Controls */}
                  <div className="prompter-btn-row">
                    <button
                      type="button"
                      className="btn-prompter-action"
                      onClick={() => setPrompterScrolling(!prompterScrolling)}
                    >
                      {prompterScrolling ? <Pause size={15} /> : <Play size={15} />}
                      <span>{prompterScrolling ? t('Pause Scroll') : t('Auto Scroll')}</span>
                    </button>
                    <button type="button" className="btn-prompter-action" onClick={resetPrompter}>
                      <RotateCcw size={15} />
                      <span>{t('Reset')}</span>
                    </button>
                    <button
                      type="button"
                      className={`btn-prompter-action ${prompterMirror ? 'active' : ''}`}
                      onClick={() => setPrompterMirror(!prompterMirror)}
                    >
                      <FlipHorizontal size={15} />
                      <span>{t('Mirror')}</span>
                    </button>
                  </div>

                  <div className="slider-label-row">
                    <span>{t('Scroll Speed')}</span>
                    <span>{prompterSpeed}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="0.5"
                    value={prompterSpeed}
                    onChange={(e) => setPrompterSpeed(Number(e.target.value))}
                  />

                  <div className="slider-label-row">
                    <span>{t('Text Font Size')}</span>
                    <span>{prompterFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="36"
                    value={prompterFontSize}
                    onChange={(e) => setPrompterFontSize(Number(e.target.value))}
                  />
                </>
              )}
            </div>

            {/* Microphone Audio Meter */}
            <div className="control-group">
              <label>{t('Microphone Level')}</label>
              <div className="mic-status-card">
                <Mic size={18} className={audioLevel > 5 ? 'mic-active' : ''} />
                <div className="mic-bar-track">
                  <div className="mic-bar-fill" style={{ width: `${audioLevel}%` }} />
                </div>
                <span>{audioLevel}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
