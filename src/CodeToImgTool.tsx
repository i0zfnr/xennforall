import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  FileCode,
  Image as ImageIcon,
  Palette,
  Sliders,
  Sparkles,
  Type,
  X
} from 'lucide-react';

interface CodeToImgToolProps {
  initialFiles?: File[];
  close: () => void;
}

interface GradientTheme {
  id: string;
  name: string;
  css: string;
  canvasGrad: (ctx: CanvasRenderingContext2D, w: number, h: number) => CanvasGradient | string;
}

const GRADIENT_THEMES: GradientTheme[] = [
  {
    id: 'sunset',
    name: 'Sunset Glow',
    css: 'linear-gradient(135deg, #ff6b6b 0%, #ffe66d 100%)',
    canvasGrad: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#ff6b6b');
      g.addColorStop(1, '#ffe66d');
      return g;
    }
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    canvasGrad: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#4facfe');
      g.addColorStop(1, '#00f2fe');
      return g;
    }
  },
  {
    id: 'neon',
    name: 'Neon Cyber',
    css: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    canvasGrad: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#11998e');
      g.addColorStop(1, '#38ef7d');
      return g;
    }
  },
  {
    id: 'hyper',
    name: 'Hyper Purple',
    css: 'linear-gradient(135deg, #8a2387 0%, #e94057 50%, #f27121 100%)',
    canvasGrad: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#8a2387');
      g.addColorStop(0.5, '#e94057');
      g.addColorStop(1, '#f27121');
      return g;
    }
  },
  {
    id: 'obsidian',
    name: 'Midnight Dark',
    css: 'linear-gradient(135deg, #181924 0%, #0a0b10 100%)',
    canvasGrad: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#181924');
      g.addColorStop(1, '#0a0b10');
      return g;
    }
  },
  {
    id: 'paper',
    name: 'Paper Clean',
    css: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    canvasGrad: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#f5f7fa');
      g.addColorStop(1, '#c3cfe2');
      return g;
    }
  },
  {
    id: 'transparent',
    name: 'Transparent',
    css: 'transparent',
    canvasGrad: () => 'rgba(0,0,0,0)'
  }
];

const DEFAULT_CODE = `// Beautiful code snippets with Xenn for all
import { useState, useEffect } from 'react';

export function useAudioStudio() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    console.log("Client-side audio graph mounted");
    return () => console.log("Cleaned up");
  }, []);

  return { active };
}`;

export default function CodeToImgTool({ initialFiles = [], close }: CodeToImgToolProps) {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [title, setTitle] = useState<string>('AudioGraph.tsx');
  const [themeId, setThemeId] = useState<string>('sunset');
  const [editorDark, setEditorDark] = useState<boolean>(true);
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(true);
  const [padding, setPadding] = useState<number>(36);
  const [fontSize, setFontSize] = useState<number>(14);
  const [copiedImg, setCopiedImg] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Refs
  const dialogRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Modal accessibility
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

  // Check if initialFiles has a text or code file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      const f = initialFiles[0];
      setTitle(f.name);
      f.text().then((txt) => {
        if (txt) setCode(txt);
      }).catch((e) => console.error(e));
    }
  }, []);

  // Update canvas rendering whenever code or visual settings change
  useEffect(() => {
    renderCardToCanvas();
  }, [code, title, themeId, editorDark, showLineNumbers, padding, fontSize]);

  // Syntax tokenizer and line renderer
  function tokenizeLine(line: string): { text: string; color: string }[] {
    const tokens: { text: string; color: string }[] = [];
    
    // Quick regex tokenizer for keywords, strings, comments, numbers
    const parts = line.split(/(\/\/.+$|"[^"]*"|'[^']*'|`[^`]*`|\b(?:import|export|from|return|function|const|let|var|if|else|switch|case|default|async|await|class|interface|type)\b|\b(?:true|false|null|undefined|\d+)\b|[{}()[\].,;:])/g);

    const isLight = !editorDark;
    const colorKeyword = isLight ? '#d73a49' : '#ff7b72';
    const colorString = isLight ? '#032f62' : '#a5d6ff';
    const colorComment = isLight ? '#6a737d' : '#8b949e';
    const colorNumber = isLight ? '#005cc5' : '#79c0ff';
    const colorPunct = isLight ? '#24292e' : '#c9d1d9';
    const colorNormal = isLight ? '#24292e' : '#f0f6fc';

    for (const p of parts) {
      if (!p) continue;
      if (p.startsWith('//')) {
        tokens.push({ text: p, color: colorComment });
      } else if (p.startsWith('"') || p.startsWith("'") || p.startsWith('`')) {
        tokens.push({ text: p, color: colorString });
      } else if (/^(?:import|export|from|return|function|const|let|var|if|else|switch|case|default|async|await|class|interface|type)$/.test(p)) {
        tokens.push({ text: p, color: colorKeyword });
      } else if (/^(?:true|false|null|undefined|\d+)$/.test(p)) {
        tokens.push({ text: p, color: colorNumber });
      } else if (/^[{}()[\].,;:]$/.test(p)) {
        tokens.push({ text: p, color: colorPunct });
      } else {
        tokens.push({ text: p, color: colorNormal });
      }
    }
    return tokens;
  }

  // Draw code card on 2x Retina canvas
  function renderCardToCanvas(): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const lines = code.split('\n');
    const lineHeight = fontSize * 1.55;
    const windowHeaderHeight = 42;
    const editorInnerPad = 24;

    // Calculate max line width
    ctx.font = `${fontSize}px "SF Mono", Menlo, Consolas, "Courier New", monospace`;
    let maxTextWidth = 300;
    lines.forEach((l) => {
      const w = ctx.measureText(l).width;
      if (w > maxTextWidth) maxTextWidth = w;
    });

    const gutterWidth = showLineNumbers ? 44 : 0;
    const editorWidth = Math.max(480, maxTextWidth + gutterWidth + editorInnerPad * 2);
    const editorHeight = windowHeaderHeight + lines.length * lineHeight + editorInnerPad * 1.5;

    const scale = 2; // 2x Retina
    const totalWidth = editorWidth + padding * 2;
    const totalHeight = editorHeight + padding * 2;

    canvas.width = totalWidth * scale;
    canvas.height = totalHeight * scale;

    ctx.save();
    ctx.scale(scale, scale);

    // 1. Draw Background Gradient
    const theme = GRADIENT_THEMES.find((g) => g.id === themeId) || GRADIENT_THEMES[0];
    if (theme.id !== 'transparent') {
      ctx.fillStyle = theme.canvasGrad(ctx, totalWidth, totalHeight);
      ctx.fillRect(0, 0, totalWidth, totalHeight);
    } else {
      ctx.clearRect(0, 0, totalWidth, totalHeight);
    }

    // 2. Draw Code Window with Shadow
    const winX = padding;
    const winY = padding;
    const winRadius = 14;

    ctx.save();
    if (theme.id !== 'transparent') {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 15;
    }

    ctx.fillStyle = editorDark ? '#0d1117' : '#ffffff';
    ctx.beginPath();
    ctx.roundRect(winX, winY, editorWidth, editorHeight, winRadius);
    ctx.fill();
    ctx.restore();

    // Border around editor window
    ctx.strokeStyle = editorDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(winX, winY, editorWidth, editorHeight, winRadius);
    ctx.stroke();

    // 3. Window Header (Traffic Lights & Title)
    // Red, Yellow, Green macOS dots
    const dotY = winY + windowHeaderHeight / 2;
    const dotRadius = 6;
    const dotStartX = winX + 18;
    const dotSpacing = 18;

    ctx.fillStyle = '#ff5f56';
    ctx.beginPath();
    ctx.arc(dotStartX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffbd2e';
    ctx.beginPath();
    ctx.arc(dotStartX + dotSpacing, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#27c93f';
    ctx.beginPath();
    ctx.arc(dotStartX + dotSpacing * 2, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Window Title
    if (title.trim()) {
      ctx.font = '500 12px sans-serif';
      ctx.fillStyle = editorDark ? '#8b949e' : '#57606a';
      ctx.textAlign = 'center';
      ctx.fillText(title, winX + editorWidth / 2, dotY + 4);
    }

    // Header divider line
    ctx.strokeStyle = editorDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    ctx.beginPath();
    ctx.moveTo(winX, winY + windowHeaderHeight);
    ctx.lineTo(winX + editorWidth, winY + windowHeaderHeight);
    ctx.stroke();

    // 4. Code & Line Numbers
    ctx.textAlign = 'left';
    ctx.font = `${fontSize}px "SF Mono", Menlo, Consolas, "Courier New", monospace`;

    const codeStartX = winX + editorInnerPad + gutterWidth;
    let curY = winY + windowHeaderHeight + editorInnerPad + fontSize * 0.4;

    lines.forEach((lineText, idx) => {
      // Line numbers
      if (showLineNumbers) {
        ctx.fillStyle = editorDark ? '#484f58' : '#8c959f';
        ctx.textAlign = 'right';
        ctx.fillText(`${idx + 1}`, winX + editorInnerPad + gutterWidth - 14, curY);
        ctx.textAlign = 'left';
      }

      // Syntax tokens
      let tokX = codeStartX;
      const tokens = tokenizeLine(lineText);
      tokens.forEach((tok) => {
        ctx.fillStyle = tok.color;
        ctx.fillText(tok.text, tokX, curY);
        tokX += ctx.measureText(tok.text).width;
      });

      curY += lineHeight;
    });

    ctx.restore();

    setPreviewUrl(canvas.toDataURL('image/png'));
    return canvas;
  }

  // Export as high-res PNG download
  function downloadImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'code-snippet';
      link.download = `${safeTitle}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  }

  // Copy Image to Clipboard
  async function copyImageToClipboard() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setCopiedImg(true);
        setTimeout(() => setCopiedImg(false), 2200);
      }, 'image/png');
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="code-to-img-title"
      ref={dialogRef as any}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md overflow-hidden animate-fade-in outline-none"
    >
      <div className="bg-surface border border-subtle rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="code-to-img-title" className="text-lg font-bold text-main leading-tight">
                {t('Code Screenshot & Snippet Studio')}
              </h2>
              <p className="text-xs text-muted">
                {t('Create syntax-highlighted code cards with gradients and traffic light window chrome')}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-2 text-muted hover:text-main rounded-xl hover:bg-surface-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t('Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Main Visual Preview Canvas */}
          <div className="lg:col-span-7 bg-black/30 p-5 flex flex-col items-center justify-center overflow-auto relative">
            <canvas ref={canvasRef} className="hidden" />

            <div className="relative max-h-[66vh] max-w-full flex items-center justify-center rounded-xl overflow-hidden border border-subtle bg-checkerboard shadow-inner p-2">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Code Card Preview"
                  className="max-h-[62vh] max-w-full object-contain rounded-lg shadow-xl"
                />
              ) : (
                <div className="p-12 text-xs text-muted">{t('Rendering preview…')}</div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={downloadImage}
                className="btn btn-primary px-5 py-2.5 text-xs font-semibold flex items-center gap-2 min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                {t('Download 2x PNG')}
              </button>

              <button
                type="button"
                onClick={copyImageToClipboard}
                className="btn btn-secondary px-4 py-2.5 text-xs font-semibold flex items-center gap-2 min-h-[44px]"
              >
                {copiedImg ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copiedImg ? t('Image Copied!') : t('Copy Image')}
              </button>
            </div>
          </div>

          {/* Controls & Code Editor Sidebar */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-subtle p-5 overflow-y-auto flex flex-col gap-4 bg-surface">
            {/* Window title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-main">{t('Window Title / File Name')}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="index.ts"
                className="input w-full text-xs"
              />
            </div>

            {/* Code Input */}
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-main">{t('Code Snippet')}</label>
                <span className="text-[10px] text-muted">{code.split('\n').length} {t('lines')}</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={9}
                className="w-full p-3 rounded-xl bg-surface-alt border border-subtle font-mono text-xs text-main leading-relaxed resize-y focus:outline-none focus:border-primary"
                placeholder="// Type or paste code here..."
              />
            </div>

            {/* Gradient Background Presets */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-main flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary" />
                {t('Background Gradient')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {GRADIENT_THEMES.map((gt) => (
                  <button
                    key={gt.id}
                    type="button"
                    onClick={() => setThemeId(gt.id)}
                    className={`h-9 rounded-lg border flex items-center justify-center transition-all ${
                      themeId === gt.id
                        ? 'border-primary ring-2 ring-primary/40 scale-105'
                        : 'border-subtle hover:opacity-90'
                    }`}
                    style={{ background: gt.css }}
                    title={gt.name}
                    aria-label={gt.name}
                  >
                    {gt.id === 'transparent' && (
                      <span className="text-[10px] text-muted font-mono">None</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles and Sliders */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-subtle">
              <label className="text-xs font-semibold text-main">
                {t('Padding')} ({padding}px)
                <input
                  type="range"
                  min="16"
                  max="64"
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                  className="w-full accent-primary mt-1.5 cursor-pointer"
                />
              </label>

              <label className="text-xs font-semibold text-main">
                {t('Font Size')} ({fontSize}px)
                <input
                  type="range"
                  min="11"
                  max="22"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-primary mt-1.5 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-subtle">
              <span className="text-xs font-medium text-main">{t('Dark Editor Theme')}</span>
              <input
                type="checkbox"
                checked={editorDark}
                onChange={(e) => setEditorDark(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-medium text-main">{t('Line Numbers')}</span>
              <input
                type="checkbox"
                checked={showLineNumbers}
                onChange={(e) => setShowLineNumbers(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
