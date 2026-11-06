import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Camera,
  Check,
  Circle,
  Download,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  StopCircle,
  Video,
  Volume2,
  X
} from 'lucide-react';

interface ScreenRecordToolProps {
  close: () => void;
  onSendToStatusHd?: (file: File) => void;
}

export default function ScreenRecordTool({ close, onSendToStatusHd }: ScreenRecordToolProps) {
  // State
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'finished'>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [includeWebcam, setIncludeWebcam] = useState<boolean>(true);
  const [includeMic, setIncludeMic] = useState<boolean>(true);
  const [webcamPosition, setWebcamPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right'>('bottom-right');

  // Media Streams
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  // Result
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
      stopAllStreams();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  function stopAllStreams() {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      setWebcamStream(null);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

  // Start Screen & Webcam Recording Session
  async function startScreenRecording() {
    setErrorMessage('');
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl('');
    recordedChunksRef.current = [];

    try {
      // 1. Get Screen Capture
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', frameRate: 30 },
        audio: true
      });
      setScreenStream(displayStream);

      // Handle user clicking "Stop Sharing" on browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = displayStream;
        await screenVideoRef.current.play();
      }

      // 2. Get Optional Webcam and Microphone
      let userMediaStream: MediaStream | null = null;
      if (includeWebcam || includeMic) {
        try {
          userMediaStream = await navigator.mediaDevices.getUserMedia({
            video: includeWebcam ? { width: 360, height: 360, frameRate: 30 } : false,
            audio: includeMic ? { echoCancellation: true, noiseSuppression: true } : false
          });
          setWebcamStream(userMediaStream);

          if (includeWebcam && webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = userMediaStream;
            await webcamVideoRef.current.play();
          }
        } catch {
          // Continue with screen recording even if camera/mic is denied
        }
      }

      // 3. Audio Mixing Pipeline via Web Audio API
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();

      // Screen audio track (if system shared audio)
      const screenAudioTracks = displayStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        const screenAudioSrc = audioCtx.createMediaStreamSource(new MediaStream(screenAudioTracks));
        screenAudioSrc.connect(destination);
      }

      // Microphone track
      if (userMediaStream && userMediaStream.getAudioTracks().length > 0) {
        const micAudioSrc = audioCtx.createMediaStreamSource(new MediaStream(userMediaStream.getAudioTracks()));
        micAudioSrc.connect(destination);
      }

      // 4. Canvas Video Compositor Loop
      const canvas = compositeCanvasRef.current;
      if (!canvas) throw new Error(t('Canvas processing failed.'));
      const sVideo = screenVideoRef.current!;
      const wVideo = webcamVideoRef.current;

      canvas.width = sVideo.videoWidth || 1920;
      canvas.height = sVideo.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('Canvas processing failed.'));

      const compositeLoop = () => {
        if (sVideo.readyState >= 2) {
          const w = canvas.width;
          const h = canvas.height;

          // Draw Screen
          ctx.drawImage(sVideo, 0, 0, w, h);

          // Draw Circular Webcam Pip if enabled
          if (includeWebcam && wVideo && wVideo.readyState >= 2) {
            const pipDiameter = Math.round(w * 0.16); // 16% of screen width
            const margin = 28;
            let px = w - pipDiameter - margin;
            let py = h - pipDiameter - margin;

            if (webcamPosition === 'bottom-left') {
              px = margin;
              py = h - pipDiameter - margin;
            } else if (webcamPosition === 'top-right') {
              px = w - pipDiameter - margin;
              py = margin;
            }

            ctx.save();
            // Drop shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 6;

            // Circular clipping path
            ctx.beginPath();
            ctx.arc(px + pipDiameter / 2, py + pipDiameter / 2, pipDiameter / 2, 0, Math.PI * 2);
            ctx.clip();

            // Draw webcam frame centered
            ctx.drawImage(wVideo, px, py, pipDiameter, pipDiameter);

            // Ring border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
          }
        }
        animationFrameRef.current = requestAnimationFrame(compositeLoop);
      };

      animationFrameRef.current = requestAnimationFrame(compositeLoop);

      // 5. MediaRecorder Stream Setup
      const canvasStream = canvas.captureStream(30);
      const mixedAudioTracks = destination.stream.getAudioTracks();
      if (mixedAudioTracks.length > 0) {
        canvasStream.addTrack(mixedAudioTracks[0]);
      }

      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4;codecs=avc1'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : 'video/webm;codecs=vp9';

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 8000000
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
        stopAllStreams();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecordingState('recording');
      setDuration(0);
    } catch {
      setErrorMessage(t('Screen capture cancelled or permission was denied.'));
      stopAllStreams();
      setRecordingState('idle');
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
    a.download = `screen-recording-${Date.now()}.${ext}`;
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
        className="tool-workspace screenrecord-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="screenrecord-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && recordingState !== 'recording') {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Hidden video elements for stream composting */}
        <video ref={screenVideoRef} playsInline muted style={{ display: 'none' }} />
        <video ref={webcamVideoRef} playsInline muted style={{ display: 'none' }} />

        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={recordingState === 'recording'} onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('Private & Client-Side · Unlimited Screen Recording')}
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
          <span className="tool-icon blue">
            <Monitor size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Video tools')} <span>/</span> {t('SCREEN & WEBCAM RECORDER')}
              </span>
              <span className="hd-pill">NO WATERMARK · NO LIMIT</span>
            </div>
            <h2 id="screenrecord-title">{t('Screen & Webcam Studio Recorder')}</h2>
            <p>
              {t('Record full screens, application windows, or browser tabs with a circular face-cam overlay and microphone audio.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Zero Watermarks · High FPS')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Screen Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {recordingState === 'recording'
                  ? `${t('RECORDING')} (${formatTime(duration)})`
                  : recordingState === 'finished'
                  ? t('RECORDING COMPLETE')
                  : t('SCREEN RECORDER WORKBENCH')}
              </span>
              <span>{recordingState === 'recording' && <span className="rec-dot-pulse" />} 1080p HD</span>
            </div>

            <div className="screenrecord-stage-wrap">
              {recordingState === 'finished' ? (
                <div className="finished-video-preview">
                  <video src={recordedUrl} controls autoPlay className="cinematic-result-video" />
                </div>
              ) : recordingState === 'recording' ? (
                <div className="live-composite-wrap">
                  <canvas ref={compositeCanvasRef} className="screen-composite-canvas" />
                  <div className="screen-recording-hud">
                    <span className="rec-dot-pulse" />
                    <strong>REC {formatTime(duration)}</strong>
                    <span>{includeWebcam ? t('Face-Cam On') : t('Screen Only')}</span>
                  </div>
                </div>
              ) : (
                <div className="screen-idle-prompt">
                  <Monitor size={48} />
                  <h3>{t('Ready to record your screen & presentation')}</h3>
                  <p>{t('Choose whether to include your circular webcam bubble and microphone below, then click Start Recording.')}</p>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="stage-action-bar">
              {recordingState === 'idle' && (
                <button className="record-btn-action" onClick={startScreenRecording}>
                  <div className="record-inner-circle" />
                  <span>{t('Start Screen Recording')}</span>
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
                    {t('Download Screen Video')}
                  </button>
                  {onSendToStatusHd && recordedBlob && (
                    <button
                      className="primary-action"
                      onClick={() => {
                        const file = new File([recordedBlob], 'screen-recording.mp4', { type: recordedBlob.type });
                        onSendToStatusHd(file);
                      }}
                    >
                      <Sparkles size={16} />
                      {t('Optimize for WhatsApp HD')}
                    </button>
                  )}
                  <button className="btn-change-file" onClick={handleRecordAgain}>
                    <RotateCcw size={16} />
                    {t('Record Another Session')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="workspace-controls">
            <div className="control-group">
              <label>{t('Recording Options')}</label>

              <div className="filter-card-option" style={{ marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  id="include-cam-toggle"
                  checked={includeWebcam}
                  disabled={recordingState === 'recording'}
                  onChange={(e) => setIncludeWebcam(e.target.checked)}
                />
                <label htmlFor="include-cam-toggle">
                  <strong>{t('Circular Webcam Face-Cam')}</strong>
                  <p>{t('Shows a clean circular video bubble of your face over the presentation.')}</p>
                </label>
              </div>

              <div className="filter-card-option">
                <input
                  type="checkbox"
                  id="include-mic-toggle"
                  checked={includeMic}
                  disabled={recordingState === 'recording'}
                  onChange={(e) => setIncludeMic(e.target.checked)}
                />
                <label htmlFor="include-mic-toggle">
                  <strong>{t('Microphone Narration')}</strong>
                  <p>{t('Mixes your voice commentary with the computer screen audio.')}</p>
                </label>
              </div>
            </div>

            {includeWebcam && (
              <div className="control-group">
                <label>{t('Webcam Bubble Position')}</label>
                <div className="btn-toggle-group">
                  <button
                    type="button"
                    className={webcamPosition === 'bottom-right' ? 'active' : ''}
                    disabled={recordingState === 'recording'}
                    onClick={() => setWebcamPosition('bottom-right')}
                  >
                    Bottom Right
                  </button>
                  <button
                    type="button"
                    className={webcamPosition === 'bottom-left' ? 'active' : ''}
                    disabled={recordingState === 'recording'}
                    onClick={() => setWebcamPosition('bottom-left')}
                  >
                    Bottom Left
                  </button>
                  <button
                    type="button"
                    className={webcamPosition === 'top-right' ? 'active' : ''}
                    disabled={recordingState === 'recording'}
                    onClick={() => setWebcamPosition('top-right')}
                  >
                    Top Right
                  </button>
                </div>
              </div>
            )}

            <div className="control-group">
              <label>{t('Features')}</label>
              <div className="spec-card">
                <div className="spec-row">
                  <span>{t('Watermarks')}</span>
                  <strong className="badge-green">{t('Zero')}</strong>
                </div>
                <div className="spec-row">
                  <span>{t('Time Limits')}</span>
                  <strong className="badge-green">{t('Unlimited')}</strong>
                </div>
                <div className="spec-row">
                  <span>{t('Server Upload')}</span>
                  <strong>{t('None (100% In-Browser)')}</strong>
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
