import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { ArrowRight, ShieldCheck, Upload, X } from 'lucide-react';
import { t } from './i18n';

export default function BatchImages({ close }: { close: () => void }) {
  const [files, setFiles] = useState<File[]>([]), [operation, setOperation] = useState('compress'), [format, setFormat] = useState('image/jpeg'), [quality, setQuality] = useState(75), [width, setWidth] = useState(1200), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState(''), [result, setResult] = useState<Blob | null>(null);
  const picker = useRef<HTMLInputElement>(null), dialog = useRef<HTMLElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.current?.focus(); return () => { document.body.style.overflow = overflow; previous?.focus(); }; }, []);
  useEffect(() => { setResult(null); setStatus(''); }, [files, operation, format, quality, width]);
  function add(incoming: File[]) {
    if (incoming.some(f => !['image/jpeg','image/png','image/webp'].includes(f.type) || f.size > 100 * 1024 * 1024)) { setError('Choose JPG, PNG, or WebP images under 100 MB each.'); return; }
    setFiles(old => [...old, ...incoming]); setError('');
  }
  async function run() {
    if (operation === 'resize' && (!Number.isInteger(width) || width < 1 || width > 16000)) { setError('Enter a width between 1 and 16000 pixels.'); return; }
    setBusy(true); setError(''); setResult(null);
    const zip = new JSZip(), failures: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setStatus(`${t('Processing image')} ${i + 1} / ${files.length}`);
      try {
        const bitmap = await createImageBitmap(files[i]);
        try {
          const canvas = document.createElement('canvas'); canvas.width = operation === 'resize' ? width : bitmap.width; canvas.height = Math.max(1, Math.round(bitmap.height * canvas.width / bitmap.width));
          if (canvas.height > 16000 || canvas.width * canvas.height > 100000000) throw new Error('Image too large');
          const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
          if (format === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b && b.type === format ? resolve(b) : reject(new Error('Unsupported format')), format, quality / 100));
          const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp';
          zip.file(`${String(i + 1).padStart(3, '0')}-${files[i].name.replace(/\.[^.]+$/, '')}.${ext}`, blob);
          canvas.width = 0; canvas.height = 0;
        } finally { bitmap.close(); }
      } catch { failures.push(files[i].name); }
    }
    try { if (failures.length < files.length) setResult(await zip.generateAsync({type: 'blob'})); setStatus(failures.length ? `${t('Could not process')}: ${failures.join(', ')}` : t('All done! Your file is ready.')); } catch { setError('Could not create the ZIP file.'); setStatus(''); }
    setBusy(false);
  }
  function download() { if (!result) return; const url = URL.createObjectURL(result), a = document.createElement('a'); a.href = url; a.download = 'xenn-batch-images.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
  return <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="batch-title" className="tool-workspace" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape' && !busy) close(); if (e.key === 'Tab') { const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not([type="hidden"]):not(:disabled),select:not(:disabled)')).filter(el => el.getClientRects().length); if (e.shiftKey && (document.activeElement === els[0] || document.activeElement === e.currentTarget)) {e.preventDefault(); els.at(-1)?.focus();} else if (!e.shiftKey && (document.activeElement === els.at(-1) || document.activeElement === e.currentTarget)) {e.preventDefault(); els[0]?.focus();} } }}>
    <div className="workspace-topbar"><button className="workspace-back" disabled={busy} onClick={close}>{t('All tools')}</button><span className="workspace-private"><ShieldCheck size={14}/>{t('Private by design')}</span><button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}><X size={19}/></button></div>
    <div className="workspace-heading"><div><span className="workspace-category">{t('Image tools')}</span><h2 id="batch-title">{t('Batch images')}</h2><p>{t('Compress, resize, or convert multiple images at once.')}</p></div></div>
    <div className="workspace-grid"><div className="workspace-canvas"><div className="canvas-heading"><span>{t('Your files')}</span><span>{files.length}</span></div><div className="batch-list">{files.length ? files.map((file, i) => <div className="batch-row" key={`${file.name}-${i}`}><span>{file.name}</span><button disabled={busy} onClick={() => setFiles(old => old.filter((_, n) => n !== i))} aria-label={t(`Remove ${file.name}`)}><X size={17}/></button></div>) : <p>{t('Choose images to get started.')}</p>}</div><div className="canvas-footer"><ShieldCheck size={14}/>{t('Your files stay on your device.')}</div></div>
    <aside className="workspace-controls"><div className="controls-section"><button className="dropzone workspace-upload" disabled={busy} onClick={() => picker.current?.click()}><Upload size={17}/>{t('Add images')}</button><input ref={picker} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => {add(Array.from(e.target.files || [])); e.target.value = '';}}/></div><div className="controls-section settings-section"><label className="field">{t('Action')}<select value={operation} disabled={busy} onChange={e => {setOperation(e.target.value); if (e.target.value === 'compress') setFormat('image/jpeg');}}><option value="compress">{t('Compress images')}</option><option value="resize">{t('Resize images')}</option><option value="convert">{t('Convert images')}</option></select></label>{operation === 'resize' && <label className="field">{t('Width in pixels')}<input type="number" min="1" max="16000" value={width} disabled={busy} onChange={e => setWidth(Number(e.target.value))}/><small>{t('Aspect ratio is preserved.')}</small></label>}<label className="field">{t('Output format')}<select value={format} disabled={busy} onChange={e => setFormat(e.target.value)}><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option>{operation !== 'compress' && <option value="image/png">PNG</option>}</select></label>{format !== 'image/png' && <label className="field">{t('Image quality')}: {quality}%<input type="range" min="10" max="100" value={quality} disabled={busy} onChange={e => setQuality(Number(e.target.value))}/></label>}{format === 'image/jpeg' && <p className="workspace-tip">{t('Transparent areas become white in JPG files.')}</p>}<p className="workspace-tip">{t('Output files are bundled into a ZIP. Compression may not make every file smaller.')}</p></div><div className="workspace-action">{error && <p className="error" role="alert">{t(error)}</p>}{status && <p className="status" role="status">{status}</p>}{result ? <button className="primary full" onClick={download}>{t('Download ZIP')}</button> : <button className="primary full" disabled={!files.length || busy} onClick={run}>{busy ? t('Processing…') : t('Process images')}<ArrowRight size={17}/></button>}<div className="dialog-privacy"><ShieldCheck size={13}/>{t('No account. No uploads. No payment.')}</div></div></aside></div></section></div>;
}
