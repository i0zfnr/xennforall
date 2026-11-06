import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Disc,
  Download,
  FileAudio,
  Film,
  Music,
  Play,
  Pause,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';

interface AudioExtractToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function AudioExtractTool({ initialFiles = [], close }: AudioExtractToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [mode, setMode] = useState<'extract' | 'mute'>('extract');
  const [audioFormat, setAudioFormat] = useState<'wav' | 'webm'>('wav');
  const [videoDuration, setVideoDuration] = useState<number>(0);

  // Audio extraction state
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [extractedAudioBlob, setExtractedAudioBlob] = useState<Blob | null>(null);
  const [extractedAudioUrl, setExtractedAudioUrl] = useState<string>('');
  const [extractedSize, setExtractedSize] = useState<number>(0);

  // Muted video state
  const [mutedVideoBlob, setMutedVideoBlob] = useState<Blob | null>(null);
  const [mutedVideoUrl, setMutedVideoUrl] = useState<string>('');
  const [mutedSize, setMutedSize] = useState<number>(0);

  // Processing state
  const [busy, setBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Audio Playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (extractedAudioUrl) URL.revokeObjectURL(extractedAudioUrl);
      if (mutedVideoUrl) URL.revokeObjectURL(mutedVideoUrl);
    };
  }, [extractedAudioUrl, mutedVideoUrl]);

  // Handle initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    const valid = f.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f.name);
    if (!valid) {
      setErrorMessage(t('Please select a valid video file (MP4, MOV, WebM).'));
      return;
    }

    setFile(f);
    setAudioBuffer(null);
    setExtractedAudioBlob(null);
    if (extractedAudioUrl) URL.revokeObjectURL(extractedAudioUrl);
    setExtractedAudioUrl('');
    setMutedVideoBlob(null);
    if (mutedVideoUrl) URL.revokeObjectURL(mutedVideoUrl);
    setMutedVideoUrl('');
    setIsPlayingAudio(false);

    // Load duration from video
    const video = document.createElement('video');
    video.preload = 'metadata';
    const tempUrl = URL.createObjectURL(f);
    video.src = tempUrl;
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      URL.revokeObjectURL(tempUrl);
    };
  }

  // Convert AudioBuffer to 16-bit PCM WAV Blob
  function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const samplesCount = buffer.length;
    const dataByteCount = samplesCount * blockAlign;
    const bufferLength = 44 + dataByteCount;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    function writeString(offset: number, str: string) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataByteCount, true);
    writeString(8, 'WAVE');

    // "fmt " sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, format, true); // AudioFormat
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitDepth, true); // BitsPerSample

    // "data" sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataByteCount, true);

    // Write interleaved samples
    let offset = 44;
    const channelData: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }

    for (let i = 0; i < samplesCount; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channelData[ch][i];
        // Clip sample between -1 and 1
        sample = Math.max(-1, Math.min(1, sample));
        // Scale to 16-bit signed integer
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  // Draw visual waveform
  function drawWaveform(buffer: AudioBuffer) {
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

    ctx.fillStyle = '#6366f1';
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
      ctx.fillRect(i, y1, 1, y2);
    }
  }

  // Extract Audio Pipeline
  async function handleExtractAudio() {
    if (!file) return;
    setBusy(true);
    setProgress(10);
    setProgressMsg(t('Reading video audio track…'));
    setErrorMessage('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(40);
      setProgressMsg(t('Decoding audio stream into studio PCM samples…'));

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      setProgress(75);
      setProgressMsg(t('Encoding lossless master audio…'));

      const wavBlob = audioBufferToWav(decodedBuffer);
      const url = URL.createObjectURL(wavBlob);
      setExtractedAudioBlob(wavBlob);
      setExtractedAudioUrl(url);
      setExtractedSize(wavBlob.size);
      setProgress(100);
      setProgressMsg(t('Audio extraction complete!'));

      // Draw waveform preview
      setTimeout(() => {
        drawWaveform(decodedBuffer);
      }, 50);

      await audioCtx.close();
    } catch {
      setErrorMessage(t('Could not decode audio from this video. The file may have no audio or use an unsupported codec.'));
    } finally {
      setBusy(false);
    }
  }

  // Mute Video Pipeline: strip audio track completely
  async function handleMuteVideo() {
    if (!file) return;
    setBusy(true);
    setProgress(5);
    setProgressMsg(t('Preparing video stream for silent export…'));
    setErrorMessage('');

    try {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      const fileUrl = URL.createObjectURL(file);
      video.src = fileUrl;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error(t('Failed to load video metadata.')));
      });

      const stream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
      if (!stream) throw new Error(t('Browser does not support capture stream for video rendering.'));

      // Extract only video tracks (leave audio out)
      const videoOnlyTracks = stream.getVideoTracks();
      if (videoOnlyTracks.length === 0) throw new Error(t('No video track found.'));
      const silentStream = new MediaStream(videoOnlyTracks);

      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4;codecs=avc1'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : 'video/webm;codecs=vp9';

      const recorder = new MediaRecorder(silentStream, {
        mimeType,
        videoBitsPerSecond: 6000000
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const recordPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mimeType.split(';')[0] });
          resolve(finalBlob);
        };
      });

      recorder.start(100);
      video.currentTime = 0;
      await video.play();

      const totalDuration = video.duration || 1;
      const updateInterval = setInterval(() => {
        const pct = Math.min(95, Math.round((video.currentTime / totalDuration) * 90) + 5);
        setProgress(pct);
        setProgressMsg(`${t('Muting video')} (${pct}%)…`);
      }, 200);

      await new Promise<void>((resolve) => {
        video.onended = () => resolve();
      });

      clearInterval(updateInterval);
      recorder.stop();
      video.pause();
      URL.revokeObjectURL(fileUrl);

      const resultBlob = await recordPromise;
      const url = URL.createObjectURL(resultBlob);
      setMutedVideoBlob(resultBlob);
      setMutedVideoUrl(url);
      setMutedSize(resultBlob.size);
      setProgress(100);
      setProgressMsg(t('Silent video created successfully!'));
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to generate muted video.'));
    } finally {
      setBusy(false);
    }
  }

  // Audio Playback Controller
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

  function downloadExtractedAudio() {
    if (!extractedAudioBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = extractedAudioUrl;
    a.download = `${baseName}-audio.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadMutedVideo() {
    if (!mutedVideoBlob || !file) return;
    const ext = mutedVideoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = mutedVideoUrl;
    a.download = `${baseName}-muted.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace audioextract-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audioextract-title"
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
            {t('Private & Client-Side · In-Browser Web Audio')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon violet">
            <Volume2 size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Video tools')} <span>/</span> {t('AUDIO EXTRACTOR & MUTER')}
              </span>
              <span className="hd-pill">LOSSLESS MASTER</span>
            </div>
            <h2 id="audioextract-title">{t('Video to Audio & Video Muter')}</h2>
            <p>
              {t('Extract lossless studio WAV or music audio tracks from video clips, or strip all sound to export silent video.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% In-Browser · Studio Quality')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {mode === 'extract' ? t('AUDIO WORKBENCH') : t('SILENT VIDEO WORKBENCH')}
              </span>
              <span>{file ? file.name : t('Select a video clip')}</span>
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
                  <Film size={34} />
                </div>
                <h3>{t('Drop video file here')}</h3>
                <p>{t('Supports MP4, MOV, WebM, and MKV. Your files never leave your device.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select video')}
                </span>
              </button>
            ) : mode === 'extract' ? (
              <div className="audio-workbench-view">
                <div className="audio-hero-card">
                  <div className="audio-waveform-container">
                    <canvas ref={waveformCanvasRef} width={640} height={120} className="waveform-canvas" />
                    {!extractedAudioBlob && (
                      <div className="waveform-overlay-prompt">
                        <Disc size={28} className={busy ? 'spin' : ''} />
                        <span>{busy ? progressMsg : t('Click "Extract Lossless Audio" below to generate waveform')}</span>
                      </div>
                    )}
                  </div>

                  {extractedAudioBlob && (
                    <div className="audio-player-bar">
                      <audio
                        ref={audioElementRef}
                        src={extractedAudioUrl}
                        onTimeUpdate={(e) => setAudioCurrentTime((e.target as HTMLAudioElement).currentTime)}
                        onEnded={() => setIsPlayingAudio(false)}
                      />
                      <button
                        className="audio-play-round"
                        onClick={togglePlayAudio}
                        aria-label={isPlayingAudio ? t('Pause') : t('Play')}
                      >
                        {isPlayingAudio ? <Pause size={20} /> : <Play size={20} />}
                      </button>
                      <div className="audio-player-meta">
                        <strong>{file.name.replace(/\.[^/.]+$/, '')}.wav</strong>
                        <small>
                          {audioCurrentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s · {(extractedSize / 1024 / 1024).toFixed(2)} MB (16-bit PCM Master)
                        </small>
                      </div>
                      <button className="primary-action small" onClick={downloadExtractedAudio}>
                        <Download size={15} />
                        {t('Download WAV')}
                      </button>
                    </div>
                  )}
                </div>

                <div className="video-source-info">
                  <Film size={18} />
                  <span>
                    {t('Source Video')}: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB, {videoDuration.toFixed(1)}s)
                  </span>
                </div>
              </div>
            ) : (
              <div className="muted-workbench-view">
                <div className="muted-preview-container">
                  {mutedVideoUrl ? (
                    <video
                      src={mutedVideoUrl}
                      controls
                      autoPlay
                      loop
                      muted
                      className="preview-video-element"
                    />
                  ) : (
                    <video
                      ref={videoPreviewRef}
                      src={URL.createObjectURL(file)}
                      controls
                      muted
                      className="preview-video-element"
                    />
                  )}
                </div>
                {mutedVideoBlob && (
                  <div className="muted-success-pill">
                    <Check size={18} />
                    <span>
                      {t('Audio track stripped! File size')}: {(mutedSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button className="primary-action small" onClick={downloadMutedVideo}>
                      <Download size={15} />
                      {t('Download Silent Video')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings Sidebar */}
          <div className="workspace-controls">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="video/*,.mp4,.mov,.webm,.mkv,.m4v"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {/* Mode Selector */}
            <div className="control-group">
              <label>{t('Choose Action')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={mode === 'extract' ? 'active' : ''}
                  onClick={() => setMode('extract')}
                >
                  <Music size={16} />
                  {t('Extract Audio')}
                </button>
                <button
                  type="button"
                  className={mode === 'mute' ? 'active' : ''}
                  onClick={() => setMode('mute')}
                >
                  <VolumeX size={16} />
                  {t('Mute Video')}
                </button>
              </div>
            </div>

            {mode === 'extract' ? (
              <>
                <div className="control-group">
                  <label>{t('Output Audio Quality')}</label>
                  <div className="quality-radio-list">
                    <label className="radio-tile active">
                      <input type="radio" checked readOnly />
                      <div>
                        <strong>{t('Lossless WAV (16-bit 48kHz)')}</strong>
                        <p>{t('Uncompressed studio quality master. Perfect for editing, mixing, or ringtones.')}</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="control-group">
                  <label>{t('Source Details')}</label>
                  <div className="spec-card">
                    <div className="spec-row">
                      <span>{t('File Name')}</span>
                      <strong>{file ? file.name : '-'}</strong>
                    </div>
                    <div className="spec-row">
                      <span>{t('Duration')}</span>
                      <strong>{videoDuration > 0 ? `${videoDuration.toFixed(1)}s` : '-'}</strong>
                    </div>
                    <div className="spec-row">
                      <span>{t('Processing')}</span>
                      <strong>Web Audio API (Local)</strong>
                    </div>
                  </div>
                </div>

                <button
                  className="primary-action"
                  disabled={!file || busy}
                  onClick={handleExtractAudio}
                >
                  {busy ? <RotateCw size={17} className="spin" /> : <Music size={17} />}
                  {busy ? progressMsg : t('Extract Lossless Audio')}
                </button>

                {extractedAudioBlob && (
                  <button className="download-btn-green" onClick={downloadExtractedAudio}>
                    <Download size={18} />
                    {t('Download WAV Audio')}
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="control-group">
                  <label>{t('Mute Configuration')}</label>
                  <div className="quality-radio-list">
                    <label className="radio-tile active">
                      <input type="radio" checked readOnly />
                      <div>
                        <strong>{t('Strip Audio Track (Silent Video)')}</strong>
                        <p>{t('Removes all sound, microphone noise, and audio streams completely from the video.')}</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="control-group">
                  <label>{t('Video Stream')}</label>
                  <div className="spec-card">
                    <div className="spec-row">
                      <span>{t('Audio Track')}</span>
                      <strong className="badge-red">{t('Removed')}</strong>
                    </div>
                    <div className="spec-row">
                      <span>{t('Video Track')}</span>
                      <strong>{t('Preserved')}</strong>
                    </div>
                  </div>
                </div>

                <button
                  className="primary-action"
                  disabled={!file || busy}
                  onClick={handleMuteVideo}
                >
                  {busy ? <RotateCw size={17} className="spin" /> : <VolumeX size={17} />}
                  {busy ? progressMsg : t('Generate Silent Video')}
                </button>

                {mutedVideoBlob && (
                  <button className="download-btn-green" onClick={downloadMutedVideo}>
                    <Download size={18} />
                    {t('Download Silent Video')}
                  </button>
                )}
              </>
            )}

            {file && (
              <button
                className="btn-change-file"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Change video')}
              </button>
            )}

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
