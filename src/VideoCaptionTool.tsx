import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Download,
  FileText,
  Film,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  X
} from 'lucide-react';

interface VideoCaptionToolProps {
  initialFiles?: File[];
  close: () => void;
}

interface SubtitleItem {
  id: string;
  start: number; // in seconds
  end: number;
  text: string;
}

export default function VideoCaptionTool({ initialFiles = [], close }: VideoCaptionToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Subtitles
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([
    { id: '1', start: 0.5, end: 3.5, text: 'Welcome to Xenn for all!' },
    { id: '2', start: 4.0, end: 7.0, text: 'Private, client-side tools running in your browser.' }
  ]);
  const [copiedSrt, setCopiedSrt] = useState<boolean>(false);

  // Styling
  const [fontSize, setFontSize] = useState<number>(18);
  const [showBg, setShowBg] = useState<boolean>(true);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
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

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      loadVideo(initialFiles[0]);
    }
  }, []);

  function loadVideo(f: File) {
    if (!f.type.startsWith('video/') && !/\.(mp4|webm|mov|mkv)$/i.test(f.name)) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(f);
    setFile(f);
    setVideoUrl(url);
    setCurrentTime(0);
    setIsPlaying(false);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
  }

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
  }

  function handleSeek(val: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val;
    setCurrentTime(val);
  }

  function addSubtitleAtPlayhead() {
    const start = Math.floor(currentTime * 10) / 10;
    const end = Math.min(duration || 100, Math.floor((start + 2.5) * 10) / 10);
    const newItem: SubtitleItem = {
      id: `${Date.now()}-${Math.random()}`,
      start,
      end,
      text: t('New caption text…')
    };
    setSubtitles((prev) => [...prev, newItem].sort((a, b) => a.start - b.start));
  }

  function updateSubtitle(id: string, field: 'start' | 'end' | 'text', val: any) {
    setSubtitles((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s)).sort((a, b) => a.start - b.start)
    );
  }

  function removeSubtitle(id: string) {
    setSubtitles((prev) => prev.filter((s) => s.id !== id));
  }

  // Active caption text for current playhead time
  const currentActiveCaption = subtitles.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  // Convert to SRT string
  function generateSrt(): string {
    return subtitles
      .map((s, idx) => {
        const startStr = formatSrtTime(s.start);
        const endStr = formatSrtTime(s.end);
        return `${idx + 1}\n${startStr} --> ${endStr}\n${s.text}\n`;
      })
      .join('\n');
  }

  // Convert to VTT string
  function generateVtt(): string {
    const body = subtitles
      .map((s) => {
        const startStr = formatVttTime(s.start);
        const endStr = formatVttTime(s.end);
        return `${startStr} --> ${endStr}\n${s.text}\n`;
      })
      .join('\n');
    return `WEBVTT\n\n${body}`;
  }

  function formatSrtTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
  }

  function formatVttTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${pad(m, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
  }

  function pad(num: number, size: number): string {
    let s = num.toString();
    while (s.length < size) s = '0' + s;
    return s;
  }

  function formatDisplayTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  async function copySrt() {
    const srt = generateSrt();
    await navigator.clipboard.writeText(srt);
    setCopiedSrt(true);
    setTimeout(() => setCopiedSrt(false), 2000);
  }

  function downloadSrtFile() {
    const srt = generateSrt();
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const baseName = file?.name.substring(0, file.name.lastIndexOf('.')) || 'subtitles';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${baseName}.srt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadVttFile() {
    const vtt = generateVtt();
    const blob = new Blob([vtt], { type: 'text/vtt;charset=utf-8' });
    const baseName = file?.name.substring(0, file.name.lastIndexOf('.')) || 'subtitles';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${baseName}.vtt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace videocaption-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="videocaption-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('Private & Client-Side · 100% In-Browser')}
          </span>
          <button className="workspace-close" onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon violet">
            <Film size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Video tools')} <span>/</span> {t('VIDEO SUBTITLE & SRT MAKER')}
              </span>
              <span className="hd-pill">SRT & VTT</span>
            </div>
            <h2 id="videocaption-title">{t('Video Subtitle & SRT Caption Studio')}</h2>
            <p>
              {t('Create, edit, and sync subtitles directly over video clips with live overlay previews and export to standard SRT or WebVTT files.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Live Overlay · SRT / VTT Export')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Video & Live Caption Overlay */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {videoUrl ? t('LIVE SUBTITLE PREVIEW') : t('VIDEO WORKBENCH')}
              </span>
              <span>{file ? file.name : t('Select video file')}</span>
            </div>

            {!videoUrl ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) loadVideo(e.dataTransfer.files[0]);
                }}
              >
                <div className="empty-circle">
                  <Film size={34} />
                </div>
                <h3>{t('Select video file to caption')}</h3>
                <p>{t('Supports MP4, WebM, MOV. Add time-synced subtitles and export ready-to-use SRT.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Video')}
                </span>
              </button>
            ) : (
              <div className="videocaption-stage-wrap">
                {/* Video Container with Subtitle Overlay */}
                <div className="videocaption-player-box">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onClick={togglePlay}
                    className="videocaption-video-element"
                  />

                  {/* Live Caption Overlay on Video */}
                  {currentActiveCaption && (
                    <div
                      className="videocaption-live-overlay"
                      style={{
                        fontSize: `${fontSize}px`,
                        background: showBg ? 'rgba(0, 0, 0, 0.75)' : 'transparent',
                        textShadow: !showBg ? '0 2px 4px rgba(0,0,0,0.9)' : 'none'
                      }}
                    >
                      {currentActiveCaption.text}
                    </div>
                  )}
                </div>

                {/* Scrubber & Controls */}
                <div className="videocaption-timeline-bar">
                  <button
                    type="button"
                    className="reverb-play-btn"
                    style={{ width: 44, height: 44 }}
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.05"
                    value={currentTime}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    className="reverb-scrubber"
                  />

                  <span className="video-time-tag">
                    {formatDisplayTime(currentTime)} / {formatDisplayTime(duration)}
                  </span>
                </div>

                {/* Subtitle Export Action Row */}
                <div className="videocaption-actions-row">
                  <button
                    type="button"
                    className="download-btn-green"
                    onClick={downloadSrtFile}
                  >
                    <Download size={15} />
                    {t('Download .SRT')}
                  </button>

                  <button
                    type="button"
                    className="primary-action"
                    onClick={downloadVttFile}
                  >
                    <Download size={15} />
                    {t('Download .VTT')}
                  </button>

                  <button
                    type="button"
                    className="btn-change-file"
                    style={{ width: 'auto', marginTop: 0 }}
                    onClick={copySrt}
                  >
                    {copiedSrt ? <Check size={15} /> : <Copy size={15} />}
                    {copiedSrt ? t('Copied SRT!') : t('Copy SRT')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls & Subtitles Editor Sidebar */}
          <div className="workspace-controls">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="video/*"
              onChange={(e) => {
                if (e.target.files?.[0]) loadVideo(e.target.files[0]);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              className="primary-action w-full"
              disabled={!videoUrl}
              onClick={addSubtitleAtPlayhead}
            >
              <Plus size={16} />
              {t('Add Caption at')} {formatDisplayTime(currentTime)}
            </button>

            {/* Subtitles List */}
            <div className="subtitles-editor-list">
              <span className="mock-card-title">{t('Subtitles Timeline')} ({subtitles.length})</span>
              <div className="subtitles-cards-scroll">
                {subtitles.map((sub, idx) => (
                  <div key={sub.id} className="subtitle-card-item">
                    <div className="subtitle-card-header">
                      <span className="sub-index-badge">#{idx + 1}</span>
                      <div className="sub-times-row">
                        <Clock size={12} />
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={sub.start}
                          onChange={(e) => updateSubtitle(sub.id, 'start', Number(e.target.value))}
                          className="sub-time-input"
                        />
                        <span>➔</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={sub.end}
                          onChange={(e) => updateSubtitle(sub.id, 'end', Number(e.target.value))}
                          className="sub-time-input"
                        />
                        <span>s</span>
                      </div>
                      <button
                        type="button"
                        className="sub-del-btn"
                        onClick={() => removeSubtitle(sub.id)}
                        aria-label={t('Delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <input
                      type="text"
                      className="tool-input-text sub-text-input"
                      value={sub.text}
                      onChange={(e) => updateSubtitle(sub.id, 'text', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Subtitle Font Size')}</span>
                <strong>{fontSize}px</strong>
              </div>
              <input
                type="range"
                min="12"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
            </div>

            <div className="control-group toggle-row-card">
              <div className="toggle-info">
                <span>{t('Dark Background Box')}</span>
              </div>
              <input
                type="checkbox"
                checked={showBg}
                onChange={(e) => setShowBg(e.target.checked)}
                className="custom-toggle-input"
              />
            </div>

            <button
              type="button"
              className="btn-change-file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              {videoUrl ? t('Change Video') : t('Select Video')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
