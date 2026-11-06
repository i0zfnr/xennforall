import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ListMusic,
  Music,
  Plus,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X
} from 'lucide-react';

interface AudioTrackItem {
  id: string;
  file: File;
  name: string;
  size: number;
}

interface AudioMergeToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function AudioMergeTool({ initialFiles = [], close }: AudioMergeToolProps) {
  const [tracks, setTracks] = useState<AudioTrackItem[]>([]);
  const [crossfadeSec, setCrossfadeSec] = useState<number>(1.0); // 0s, 1s, 2s, 3s

  // State
  const [busy, setBusy] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // DOM Refs
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

  // Cleanup URLs
  useEffect(() => {
    return () => {
      if (mergedUrl) URL.revokeObjectURL(mergedUrl);
    };
  }, [mergedUrl]);

  // Initial files
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      addFiles(initialFiles);
    }
  }, []);

  function addFiles(files: FileList | File[]) {
    const newItems: AudioTrackItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name)) {
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          name: f.name,
          size: f.size
        });
      }
    }
    if (newItems.length > 0) {
      setTracks((prev) => [...prev, ...newItems]);
      setMergedBlob(null);
    }
  }

  function moveTrack(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= tracks.length) return;
    const copy = [...tracks];
    const temp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = temp;
    setTracks(copy);
    setMergedBlob(null);
  }

  function removeTrack(id: string) {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setMergedBlob(null);
  }

  // Audio Merge with Crossfade
  async function mergeTracks() {
    if (tracks.length < 2) {
      setErrorMessage(t('Please add at least 2 audio tracks to merge.'));
      return;
    }
    setBusy(true);
    setStatusMsg(t('Decoding audio tracks…'));
    setErrorMessage('');

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffers: AudioBuffer[] = [];

      for (let i = 0; i < tracks.length; i++) {
        setStatusMsg(`${t('Decoding track')} ${i + 1} ${t('of')} ${tracks.length}…`);
        const buf = await tracks[i].file.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(buf);
        decodedBuffers.push(decoded);
      }

      setStatusMsg(t('Merging tracks with crossfade transitions…'));

      // Use highest sample rate and channel count
      const sampleRate = decodedBuffers[0].sampleRate;
      const numChannels = Math.max(...decodedBuffers.map((b) => b.numberOfChannels));

      // Calculate total merged length accounting for crossfades
      const crossfadeSamples = Math.floor(crossfadeSec * sampleRate);
      let totalLength = 0;

      for (let i = 0; i < decodedBuffers.length; i++) {
        totalLength += decodedBuffers[i].length;
        if (i > 0) {
          totalLength -= Math.min(crossfadeSamples, decodedBuffers[i].length);
        }
      }

      // Allocate merged channel arrays
      const mergedChannels: Float32Array[] = [];
      for (let c = 0; c < numChannels; c++) {
        mergedChannels.push(new Float32Array(totalLength));
      }

      let currentWritePos = 0;

      for (let i = 0; i < decodedBuffers.length; i++) {
        const buf = decodedBuffers[i];
        const len = buf.length;
        const isFirst = i === 0;
        const actualFade = isFirst ? 0 : Math.min(crossfadeSamples, len);

        for (let c = 0; c < numChannels; c++) {
          const srcData = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
          const outData = mergedChannels[c];

          for (let s = 0; s < len; s++) {
            const outIdx = currentWritePos + s;
            let sampleVal = srcData[s];

            // Apply crossfade curve on incoming start
            if (actualFade > 0 && s < actualFade) {
              const fadeInProgress = s / actualFade;
              sampleVal *= fadeInProgress;
            }

            // Apply crossfade curve on outgoing end
            if (i < decodedBuffers.length - 1 && s >= len - actualFade && actualFade > 0) {
              const fadeOutProgress = (len - s) / actualFade;
              sampleVal *= fadeOutProgress;
            }

            outData[outIdx] += sampleVal;
          }
        }

        currentWritePos += len - actualFade;
      }

      await audioCtx.close();

      // Encode merged output to 16-bit PCM WAV
      setStatusMsg(t('Packaging studio WAV master…'));
      const blockAlign = numChannels * 2;
      const dataByteCount = totalLength * blockAlign;
      const wavBuffer = new ArrayBuffer(44 + dataByteCount);
      const view = new DataView(wavBuffer);

      function writeStr(offset: number, str: string) {
        for (let j = 0; j < str.length; j++) view.setUint8(offset + j, str.charCodeAt(j));
      }

      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataByteCount, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, dataByteCount, true);

      let byteOffset = 44;
      for (let s = 0; s < totalLength; s++) {
        for (let c = 0; c < numChannels; c++) {
          let v = mergedChannels[c][s];
          v = Math.max(-1, Math.min(1, v));
          const intSample = v < 0 ? v * 0x8000 : v * 0x7fff;
          view.setInt16(byteOffset, intSample, true);
          byteOffset += 2;
        }
      }

      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setMergedBlob(blob);
      setMergedUrl(url);
      setStatusMsg('');
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to merge audio files.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadMerged() {
    if (!mergedBlob) return;
    const a = document.createElement('a');
    a.href = mergedUrl;
    a.download = `merged-audio-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace audiomerge-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audiomerge-title"
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
            {t('Private & Client-Side · Seamless Crossfade Audio Joiner')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon coral">
            <ListMusic size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Audio tools')} <span>/</span> {t('AUDIO MERGER & JOINER')}
              </span>
              <span className="hd-pill">SEAMLESS CROSSFADE</span>
            </div>
            <h2 id="audiomerge-title">{t('Audio Track Merger & Song Joiner')}</h2>
            <p>
              {t('Combine multiple songs, podcast clips, or voice notes into a continuous master track with crossfades.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Gapless · 16-Bit Master')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main List Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {tracks.length > 0 ? `${tracks.length} ${t('TRACKS QUEUED')}` : t('AUDIO PLAYLIST')}
              </span>
              <span>{t('Drag or use arrows to reorder')}</span>
            </div>

            {tracks.length === 0 ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
              >
                <div className="empty-circle">
                  <ListMusic size={34} />
                </div>
                <h3>{t('Drop audio files here to combine')}</h3>
                <p>{t('Select 2 or more MP3, WAV, or M4A tracks. Seamless crossfade transitions supported.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Add audio tracks')}
                </span>
              </button>
            ) : (
              <div className="audiomerge-stage-wrap">
                <div className="track-playlist-list">
                  {tracks.map((tr, idx) => (
                    <div key={tr.id} className="track-row-card">
                      <div className="track-order-badge">#{idx + 1}</div>
                      <div className="track-info">
                        <strong>{tr.name}</strong>
                        <small>{(tr.size / 1024 / 1024).toFixed(2)} MB</small>
                      </div>
                      <div className="track-row-actions">
                        <button
                          className="btn-order-arrow"
                          disabled={idx === 0 || busy}
                          onClick={() => moveTrack(idx, -1)}
                          aria-label={t('Move up')}
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          className="btn-order-arrow"
                          disabled={idx === tracks.length - 1 || busy}
                          onClick={() => moveTrack(idx, 1)}
                          aria-label={t('Move down')}
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          className="btn-track-delete"
                          disabled={busy}
                          onClick={() => removeTrack(tr.id)}
                          aria-label={t('Remove track')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {mergedBlob && (
                  <div className="trimmed-success-card">
                    <Check size={18} />
                    <span>
                      {t('Merged master ready!')} ({(mergedBlob.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button className="download-btn-green" onClick={downloadMerged}>
                      <Download size={16} />
                      {t('Download Merged Audio (WAV)')}
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
              multiple
              hidden
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <label>{t('Crossfade Between Tracks')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={crossfadeSec === 0 ? 'active' : ''}
                  onClick={() => setCrossfadeSec(0)}
                >
                  {t('Gapless (0s)')}
                </button>
                <button
                  type="button"
                  className={crossfadeSec === 1 ? 'active' : ''}
                  onClick={() => setCrossfadeSec(1)}
                >
                  1s
                </button>
                <button
                  type="button"
                  className={crossfadeSec === 2 ? 'active' : ''}
                  onClick={() => setCrossfadeSec(2)}
                >
                  2s
                </button>
                <button
                  type="button"
                  className={crossfadeSec === 3 ? 'active' : ''}
                  onClick={() => setCrossfadeSec(3)}
                >
                  3s
                </button>
              </div>
            </div>

            <button
              className="btn-change-file"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={16} />
              {t('Add More Tracks')}
            </button>

            <button
              className="primary-action"
              disabled={tracks.length < 2 || busy}
              onClick={mergeTracks}
            >
              {busy ? <RotateCw size={17} className="spin" /> : <Sparkles size={17} />}
              {busy ? statusMsg : t('Merge Tracks Together')}
            </button>

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
