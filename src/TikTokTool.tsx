import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Clipboard,
  Download,
  Film,
  Music,
  Play,
  RotateCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Video,
  X
} from 'lucide-react';

interface TikTokVideoData {
  title: string;
  cover: string;
  play: string;
  hdplay?: string;
  music: string;
  music_info?: {
    title: string;
    author: string;
  };
  author: {
    nickname: string;
    unique_id: string;
    avatar: string;
  };
  duration: number;
}

interface TikTokToolProps {
  close: () => void;
  onSendToStatusHd?: (file: File) => void;
  onSendToLivePhoto?: (file: File) => void;
}

export default function TikTokTool({ close, onSendToStatusHd, onSendToLivePhoto }: TikTokToolProps) {
  const [urlInput, setUrlInput] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [videoData, setVideoData] = useState<TikTokVideoData | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<File | null>(null);

  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard accessibility and modal lock
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

  async function handlePaste() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrlInput(text.trim());
          fetchTikTokVideo(text.trim());
        }
      } else {
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  }

  // Extract clean TikTok URL from text that might contain share captions
  function extractTikTokUrl(text: string): string {
    const match = text.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?tiktok\.com\/[^\s]+/i);
    return match ? match[0] : text;
  }

  async function fetchTikTokVideo(rawUrl?: string) {
    const targetUrl = extractTikTokUrl(rawUrl || urlInput).trim();
    if (!targetUrl) {
      setErrorMessage(t('Please paste a TikTok video link.'));
      return;
    }

    if (!targetUrl.includes('tiktok.com')) {
      setErrorMessage(t('Invalid link. Please paste a valid TikTok link (e.g. https://vt.tiktok.com/...)'));
      return;
    }

    setBusy(true);
    setErrorMessage('');
    setVideoData(null);
    setDownloadedFile(null);

    try {
      // Primary API endpoint: TikWM with native CORS support
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(apiUrl);
      if (!res.ok) {
        throw new Error(t('Could not reach TikTok resolver service.'));
      }

      const json = await res.json();
      if (json.code !== 0 || !json.data) {
        throw new Error(json.msg || t('Could not find video. Please verify the link is public.'));
      }

      const d = json.data;
      setVideoData({
        title: d.title || t('TikTok Video'),
        cover: d.cover,
        play: d.play,
        hdplay: d.hdplay,
        music: d.music,
        music_info: d.music_info,
        author: {
          nickname: d.author?.nickname || 'TikTok Creator',
          unique_id: d.author?.unique_id || 'creator',
          avatar: d.author?.avatar || ''
        },
        duration: d.duration || 0
      });
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to resolve TikTok video without watermark.'));
    } finally {
      setBusy(false);
    }
  }

  // Download media directly to user's device
  async function downloadMedia(url: string, filename: string, type: string) {
    if (!url) return;
    setDownloading(true);
    setDownloadProgress(t('Fetching clean media file…'));

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(t('Media download failed.'));
      const blob = await response.blob();
      
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      // Keep file in memory for 1-click bridge actions
      if (type.startsWith('video/')) {
        const file = new File([blob], filename, { type });
        setDownloadedFile(file);
      }
      setDownloadProgress(t('Download completed!'));
    } catch (err: any) {
      // Fallback: direct window download if fetch restricted
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadProgress('');
    } finally {
      setDownloading(false);
    }
  }

  // Pre-fetch video as File object for direct passing to other tools
  async function getOrFetchVideoFile(): Promise<File | null> {
    if (downloadedFile) return downloadedFile;
    if (!videoData) return null;

    setDownloading(true);
    setDownloadProgress(t('Loading clean video…'));
    try {
      const videoSrc = videoData.hdplay || videoData.play;
      const res = await fetch(videoSrc);
      const blob = await res.blob();
      const safeTitle = (videoData.title.slice(0, 30) || 'tiktok-video').replace(/[^a-zA-Z0-9_-]/g, '_');
      const file = new File([blob], `${safeTitle}.mp4`, { type: 'video/mp4' });
      setDownloadedFile(file);
      return file;
    } catch {
      return null;
    } finally {
      setDownloading(false);
      setDownloadProgress('');
    }
  }

  async function handleBridgeToStatusHd() {
    const file = await getOrFetchVideoFile();
    if (file && onSendToStatusHd) {
      onSendToStatusHd(file);
    }
  }

  async function handleBridgeToLivePhoto() {
    const file = await getOrFetchVideoFile();
    if (file && onSendToLivePhoto) {
      onSendToLivePhoto(file);
    }
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace tiktok-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tiktok-title"
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
            {t('Private & Direct · Zero Watermark')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon rose">
            <Video size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('TIKTOK CLEAN SAVER')}
              </span>
              <span className="hd-pill">NO WATERMARK</span>
            </div>
            <h2 id="tiktok-title">{t('TikTok Video Downloader Without Watermark')}</h2>
            <p>
              {t('Download clean HD MP4 videos and MP3 audio tracks directly from TikTok links.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% Free · No App Required')}
          </span>
        </div>

        {/* Workspace Body */}
        <div className="tiktok-content-container">
          {/* Link Input Bar */}
          <div className="tiktok-input-card">
            <div className="tiktok-input-group">
              <input
                ref={inputRef}
                type="url"
                className="tiktok-url-input"
                placeholder={t('Paste TikTok link here (e.g. https://vt.tiktok.com/... or https://www.tiktok.com/@...)')}
                value={urlInput}
                disabled={busy}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchTikTokVideo();
                  }
                }}
              />
              <button
                type="button"
                className="secondary-btn paste-btn"
                disabled={busy}
                onClick={handlePaste}
                title={t('Paste from clipboard')}
              >
                <Clipboard size={16} />
                {t('Paste')}
              </button>
              <button
                type="button"
                className="primary search-btn"
                disabled={busy || !urlInput.trim()}
                onClick={() => fetchTikTokVideo()}
              >
                {busy ? <span className="spinner" /> : <ArrowRight size={18} />}
                {busy ? t('Resolving…') : t('Get Video')}
              </button>
            </div>

            {errorMessage && (
              <p className="error tiktok-error" role="alert">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Video Result Card */}
          {videoData && (
            <div className="tiktok-result-grid">
              {/* Clean Video Preview */}
              <div className="tiktok-preview-col">
                <div className="tiktok-video-wrapper">
                  <video
                    src={videoData.play}
                    poster={videoData.cover}
                    controls
                    playsInline
                    loop
                    className="tiktok-video-player"
                  />
                  <div className="watermark-free-badge">
                    <Check size={14} />
                    <span>{t('Watermark Removed')}</span>
                  </div>
                </div>
              </div>

              {/* Media Details & Download Actions */}
              <div className="tiktok-actions-col">
                <div className="tiktok-creator-info">
                  {videoData.author.avatar && (
                    <img
                      src={videoData.author.avatar}
                      alt={videoData.author.nickname}
                      className="creator-avatar"
                    />
                  )}
                  <div>
                    <strong>{videoData.author.nickname}</strong>
                    <small>@{videoData.author.unique_id}</small>
                  </div>
                </div>

                <p className="tiktok-caption">{videoData.title}</p>

                {videoData.music_info && (
                  <div className="tiktok-music-pill">
                    <Music size={14} />
                    <span>
                      {videoData.music_info.title} - {videoData.music_info.author}
                    </span>
                  </div>
                )}

                {downloadProgress && (
                  <p className="tiktok-status" role="status">
                    <Check size={15} />
                    {downloadProgress}
                  </p>
                )}

                {/* Primary Download Buttons */}
                <div className="tiktok-download-buttons">
                  <button
                    className="primary download-action-btn"
                    disabled={downloading}
                    onClick={() => {
                      const safeName = (videoData.title.slice(0, 30) || 'tiktok-video').replace(/[^a-zA-Z0-9_-]/g, '_');
                      downloadMedia(videoData.play, `${safeName}-clean.mp4`, 'video/mp4');
                    }}
                  >
                    <Download size={18} />
                    <span>
                      <strong>{t('Download Clean Video (MP4)')}</strong>
                      <small>{t('Original HD · Zero Watermark')}</small>
                    </span>
                  </button>

                  {videoData.hdplay && (
                    <button
                      className="secondary-btn download-action-btn"
                      disabled={downloading}
                      onClick={() => {
                        const safeName = (videoData.title.slice(0, 30) || 'tiktok-video').replace(/[^a-zA-Z0-9_-]/g, '_');
                        downloadMedia(videoData.hdplay!, `${safeName}-hd.mp4`, 'video/mp4');
                      }}
                    >
                      <Film size={18} />
                      <span>
                        <strong>{t('Download Ultra HD (Clean MP4)')}</strong>
                        <small>{t('Highest bitrate available')}</small>
                      </span>
                    </button>
                  )}

                  {videoData.music && (
                    <button
                      className="secondary-btn download-action-btn"
                      disabled={downloading}
                      onClick={() => {
                        const safeName = (videoData.music_info?.title || 'tiktok-audio').replace(/[^a-zA-Z0-9_-]/g, '_');
                        downloadMedia(videoData.music, `${safeName}.mp3`, 'audio/mpeg');
                      }}
                    >
                      <Music size={18} />
                      <span>
                        <strong>{t('Download Audio (Clean MP3)')}</strong>
                        <small>{t('Soundtrack & voice track')}</small>
                      </span>
                    </button>
                  )}
                </div>

                {/* One-Click Bridges to Other Tools */}
                <div className="tiktok-bridges-card">
                  <span className="bridge-title">{t('Next steps in Xenn for all')}:</span>
                  <div className="bridge-buttons">
                    {onSendToStatusHd && (
                      <button className="bridge-btn" onClick={handleBridgeToStatusHd}>
                        <Smartphone size={16} />
                        <span>{t('Optimize for WhatsApp Status HD')}</span>
                      </button>
                    )}
                    {onSendToLivePhoto && (
                      <button className="bridge-btn" onClick={handleBridgeToLivePhoto}>
                        <Sparkles size={16} />
                        <span>{t('Convert to Live Photo Wallpaper')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Guide Card */}
          {!videoData && !busy && (
            <div className="tiktok-guide-card">
              <h3>{t('How to download TikTok videos without watermark')}:</h3>
              <ol className="tiktok-guide-steps">
                <li>
                  <strong>{t('1. Copy Link')}:</strong> {t('Open TikTok, tap "Share" on any video, and choose "Copy link".')}
                </li>
                <li>
                  <strong>{t('2. Paste & Resolve')}:</strong> {t('Paste the link above and click "Get Video".')}
                </li>
                <li>
                  <strong>{t('3. Download Clean HD')}:</strong> {t('Download the MP4 without any watermark or grab the MP3 soundtrack.')}
                </li>
              </ol>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
