import { lazy, Suspense, useEffect, useState } from 'react';
import { Check, Files, Sparkles } from 'lucide-react';
import { BackgroundPreview, useBlobUrl } from './BackgroundPreview';
const PdfPages = lazy(() => import('./PdfPages'));

function ImageTile({file, index}: {file:File; index:number}) {
  const url = useBlobUrl(file);
  return <figure className="image-tile"><img src={url || undefined} alt={`Page ${index+1}: ${file.name}`}/><figcaption><b>{index+1}</b> {file.name}</figcaption></figure>;
}

const processingLabels: Record<string,string> = {merge:'Bringing your PDFs together…',split:'Extracting your selected pages…',rotate:'Turning your pages…',imagepdf:'Creating your PDF…'};
export function FilePreview({files, result, busy, toolId, toolName}: {files:File[];result?:Blob;busy:boolean;toolId:string;toolName:string}) {
  const [showResult, setShowResult] = useState(false);
  const [sourceIndex,setSourceIndex] = useState(0);
  useEffect(() => {setShowResult(!!result);}, [result]);
  useEffect(() => {setSourceIndex(0);}, [files]);
  if (!files.length) return null;
  if (['background','compress','convert','resize'].includes(toolId)) return <BackgroundPreview key={files[0].name+files[0].lastModified} file={files[0]} result={result} busy={busy} mode={toolId}/>;
  const isResult = showResult && !!result;
  const blob = isResult ? result : files[sourceIndex] || files[0];
  const imageSource = toolId === 'imagepdf' && !isResult;
  return <section className="background-preview document-preview" aria-label={`${toolName} preview`} aria-busy={busy}>
    <div className="preview-heading"><span>{result ? <Check size={14}/> : <Files size={14}/>} {busy ? processingLabels[toolId] : result ? 'Your PDF is ready to explore' : imageSource ? 'Your images, in page order' : 'Take a look before you begin'}</span></div>
    {result && <div className="preview-tabs" role="group" aria-label="Preview version"><button className={!isResult?'active':''} onClick={()=>setShowResult(false)}>Original{files.length>1?' files':''}</button><button className={isResult?'active':''} onClick={()=>setShowResult(true)}><Sparkles size={13}/> Result PDF</button></div>}
    {!isResult && !imageSource && files.length>1 && <label className="preview-file-picker">Preview file<select disabled={busy} value={sourceIndex} onChange={e=>setSourceIndex(Number(e.target.value))}>{files.map((file,index)=><option key={index} value={index}>{index+1}. {file.name}</option>)}</select></label>}
    <div className={`document-stage ${busy?'is-processing':''} ${isResult?'document-reveal':''}`} key={isResult?'result':'original'}>
      {imageSource ? <div className="image-page-grid">{files.map((file,index)=><ImageTile key={file.name+index} file={file} index={index}/>)}</div> : <Suspense fallback={<div className="pdf-loading" role="status"><span className="spinner"/> Loading PDF preview…</div>}><PdfPages blob={blob}/></Suspense>}
      {busy && <div className="document-processing" aria-hidden="true"><div className="preview-scan"/><span><Sparkles size={16}/> {processingLabels[toolId]}</span></div>}
    </div>
    <p className="preview-caption">{busy ? 'Working privately on your device.' : isResult ? 'Browse the finished pages, then download your PDF below.' : toolId==='merge' ? 'Preview each file above. Use the arrows in the file list to change the merge order.' : toolId==='imagepdf' ? 'Each image becomes a page. Use the arrows in the file list to change the order.' : toolId==='split' ? 'Browse your pages, then enter the page numbers to keep below.' : 'Browse your original pages. Choose an angle below to rotate every page.'}</p>
  </section>;
}

