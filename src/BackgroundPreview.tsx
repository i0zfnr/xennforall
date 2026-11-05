import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';

function useBlobUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) { setUrl(''); return; }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

export function BackgroundPreview({ file, result, busy }: { file: File; result?: Blob; busy: boolean }) {
  const originalUrl = useBlobUrl(file);
  const resultUrl = useBlobUrl(result);
  const [split, setSplit] = useState(100);
  const [ready, setReady] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    setReady(false);
    setSplit(100);
    setRevealing(false);
  }, [result]);

  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      setRevealing(true);
      setSplit(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  return <section className="background-preview" aria-label="Background removal preview" aria-busy={busy}>
    <div className="preview-heading"><span><Sparkles size={14}/> {busy ? 'A little magic in progress' : ready ? 'Meet your background-free image' : 'Your image, ready for a little magic'}</span>{ready && <Check size={16}/>}</div>
    <div className={`preview-stage ${busy ? 'is-processing' : ''} ${ready ? 'is-complete' : ''} ${revealing ? 'is-revealing' : ''}`}>
      {originalUrl && <img className="preview-original" src={originalUrl} alt="Original image before background removal"/>}
      {resultUrl && <img className="preview-cutout" src={resultUrl} alt="Image with its background removed" onLoad={() => setReady(true)}/>}
      {ready && <div className="preview-before" style={{clipPath:`inset(0 ${100-split}% 0 0)`}}><img src={originalUrl} alt=""/></div>}
      {busy && <><div className="preview-scan" aria-hidden="true"/><div className="preview-processing"><span className="spinner"/> Finding your subject…</div></>}
      {ready && split > 0 && split < 100 && <div className="preview-divider" style={{left:`${split}%`}} aria-hidden="true"><span>↔</span></div>}
      <div className="preview-label">{busy ? 'Processing on your device' : ready ? 'Transparent background' : 'Original image'}</div>
    </div>
    {ready ? <label className="preview-comparison"><span><b>Original</b><span>Drag to compare</span><b>Background removed</b></span><input type="range" min="0" max="100" value={split} aria-label="Compare original and background removed image" onChange={event => {setRevealing(false);setSplit(Number(event.target.value));}}/></label> : <p className="preview-caption">{busy ? 'The scan shows activity while AI works. Your finished cutout will appear here.' : 'Watch the preview while your background is removed.'}</p>}
  </section>;
}
