import { getLanguage, subscribeLanguage, setLanguage, t } from './i18n';
import { StrictMode, Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine,
  ArrowRight,
  Binary,
  Braces,
  Camera,
  Check,
  ChevronDown,
  Code,
  Code2,
  Columns,
  Cpu,
  EyeOff,
  FileImage,
  Files,
  FileText,
  Film,
  FolderArchive,
  Gauge,
  Globe,
  Headphones,
  Image,
  KeyRound,
  Layers,
  ListMusic,
  Lock,
  LockKeyhole,
  Maximize,
  Maximize2,
  Menu,
  Merge,
  Mic,
  Monitor,
  Moon,
  Palette,
  PenTool,
  Plus,
  Printer,
  QrCode,
  RotateCw,
  Scan,
  Scissors,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Smile,
  Sparkles,
  Star,
  Sun,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './style.css';
import brandIcon from './assets/icon.png';
import { FilePreview } from './FilePreview';
import CommandPalette from './CommandPalette';
const NewTools = lazy(() => import('./NewTools'));
const BatchImages = lazy(() => import('./BatchImages'));
const StatusHdTool = lazy(() => import('./StatusHdTool'));
const TikTokTool = lazy(() => import('./TikTokTool'));
const LivePhotoTool = lazy(() => import('./LivePhotoTool'));
const PassportPhotoTool = lazy(() => import('./PassportPhotoTool'));
const SignPdfTool = lazy(() => import('./SignPdfTool'));
const ScanDocTool = lazy(() => import('./ScanDocTool'));
const RedactPdfTool = lazy(() => import('./RedactPdfTool'));
const AudioExtractTool = lazy(() => import('./AudioExtractTool'));
const ExifCleanerTool = lazy(() => import('./ExifCleanerTool'));
const CinematicStudioTool = lazy(() => import('./CinematicStudioTool'));
const FaceBlurTool = lazy(() => import('./FaceBlurTool'));
const QrStudioTool = lazy(() => import('./QrStudioTool'));
const AudioRecorderTool = lazy(() => import('./AudioRecorderTool'));
const VideoToGifTool = lazy(() => import('./VideoToGifTool'));
const ScreenRecordTool = lazy(() => import('./ScreenRecordTool'));
const AudioCutterTool = lazy(() => import('./AudioCutterTool'));
const GridSplitTool = lazy(() => import('./GridSplitTool'));
const EncryptTool = lazy(() => import('./EncryptTool'));
const PdfGrayscaleTool = lazy(() => import('./PdfGrayscaleTool'));
const AudioShiftTool = lazy(() => import('./AudioShiftTool'));
const PaletteTool = lazy(() => import('./PaletteTool'));
const AudioMergeTool = lazy(() => import('./AudioMergeTool'));
const SvgOptimizeTool = lazy(() => import('./SvgOptimizeTool'));
const ModernConvertTool = lazy(() => import('./ModernConvertTool'));
const OcrReaderTool = lazy(() => import('./OcrReaderTool'));
const WatermarkImageTool = lazy(() => import('./WatermarkImageTool'));
const FaviconGenTool = lazy(() => import('./FaviconGenTool'));
const Base64StudioTool = lazy(() => import('./Base64StudioTool'));
const CodeToImgTool = lazy(() => import('./CodeToImgTool'));
const AudioReverbTool = lazy(() => import('./AudioReverbTool'));
const AudioEqTool = lazy(() => import('./AudioEqTool'));
const Audio8dTool = lazy(() => import('./Audio8dTool'));
const AudioGateTool = lazy(() => import('./AudioGateTool'));
const AspectFitTool = lazy(() => import('./AspectFitTool'));
const VideoCaptionTool = lazy(() => import('./VideoCaptionTool'));
const MemeGenTool = lazy(() => import('./MemeGenTool'));
const BatchRenamerTool = lazy(() => import('./BatchRenamerTool'));
const PdfMetadataTool = lazy(() => import('./PdfMetadataTool'));
const HashVerifierTool = lazy(() => import('./HashVerifierTool'));
const JsonStudioTool = lazy(() => import('./JsonStudioTool'));
const MarkdownStudioTool = lazy(() => import('./MarkdownStudioTool'));

type Tool = {
  id: string;
  name: string;
  description: string;
  category: 'PDF tools' | 'Image tools';
  icon: LucideIcon;
  color: string;
  tag?: string;
  formats: string;
};

const tools: Tool[] = [
  { id: 'merge', name: 'Merge PDF', description: 'Bring your PDFs together. One file, perfectly in order.', category: 'PDF tools', icon: Merge, color: 'coral', tag: 'POPULAR', formats: 'PDF' },
  { id: 'split', name: 'Split PDF', description: 'Keep the pages you need. Leave the rest behind.', category: 'PDF tools', icon: Scissors, color: 'orange', formats: 'PDF' },
  { id: 'background', name: 'Remove background', description: 'Make your subject the star. Clean cutouts in a click.', category: 'Image tools', icon: Scissors, color: 'violet', tag: 'POPULAR', formats: 'PNG, JPG, WebP' },
  { id: 'batch', name: 'Batch images', description: 'Compress, resize, or convert multiple images at once.', category: 'Image tools', icon: Files, color: 'blue', tag: 'NEW', formats: 'JPG, PNG, WebP' },
  { id: 'number', name: 'Add page numbers', description: 'Add numbered pages to your PDF.', category: 'PDF tools', icon: FileImage, color: 'coral', tag: 'NEW', formats: 'PDF' },
  { id: 'compress', name: 'Compress image', description: 'Smaller files. Same big impression.', category: 'Image tools', icon: ArrowDownToLine, color: 'blue', formats: 'JPG, PNG, WebP' },
  { id: 'imagepdf', name: 'Image to PDF', description: 'Turn your JPGs and PNGs into a tidy PDF.', category: 'PDF tools', icon: FileImage, color: 'amber', formats: 'JPG, PNG, WebP' },
  { id: 'convert', name: 'Convert image', description: 'A fresh format. Convert to JPG, PNG, or WebP.', category: 'Image tools', icon: Image, color: 'teal', formats: 'PNG, JPG, WebP' },
  { id: 'rotate', name: 'Rotate PDF', description: 'Give your pages a turn in the right direction.', category: 'PDF tools', icon: RotateCw, color: 'rose', formats: 'PDF' },
  { id: 'pdfimage', name: 'PDF to image', description: 'Turn PDF pages into JPG or PNG images.', category: 'PDF tools', icon: FileImage, color: 'blue', tag: 'NEW', formats: 'PDF' },
  { id: 'organize', name: 'Organize PDF', description: 'Reorder, rotate, and remove pages visually.', category: 'PDF tools', icon: Layers, color: 'rose', tag: 'NEW', formats: 'PDF' },
  { id: 'crop', name: 'Crop image', description: 'Find the perfect frame for any image.', category: 'Image tools', icon: Scissors, color: 'teal', tag: 'NEW', formats: 'PNG, JPG, WebP' },
  { id: 'resize', name: 'Resize image', description: 'The perfect fit, wherever your image is going.', category: 'Image tools', icon: Maximize, color: 'green', formats: 'JPG, PNG, WebP' },
  { id: 'status_hd', name: 'WhatsApp Status HD', description: 'Prevent blurry status videos and photos with calibrated bitrate, 9:16 framing, and 30s clips.', category: 'Image tools', icon: Smartphone, color: 'green', tag: 'HOT', formats: 'MP4, MOV, JPG, PNG' },
  { id: 'tiktok', name: 'TikTok Saver', description: 'Download TikTok videos without watermark in HD, or extract audio MP3.', category: 'Image tools', icon: Video, color: 'rose', tag: 'HOT', formats: 'Link, MP4, MP3' },
  { id: 'livephoto', name: 'Video to Live Photo', description: 'Turn any video into an iPhone Live Photo, 9:16 motion wallpaper, or crisp cover frame.', category: 'Image tools', icon: Sparkles, color: 'violet', tag: 'NEW', formats: 'MP4, MOV, WebM' },
  { id: 'passport', name: 'Passport & IC Photo', description: 'Create official passport, IC, and visa photos with custom background and printable 4×6 sheet.', category: 'Image tools', icon: Camera, color: 'amber', tag: 'HOT', formats: 'JPG, PNG, WebP' },
  { id: 'signpdf', name: 'Sign & Watermark PDF', description: 'Sign agreements with digital signatures or stamp protective anti-fraud watermarks onto IC and document copies.', category: 'PDF tools', icon: PenTool, color: 'teal', tag: 'POPULAR', formats: 'PDF' },
  { id: 'scandoc', name: 'Scan & Clean Document', description: 'Straighten angled paper photos, remove yellow shadows, and generate clean PDF scans.', category: 'Image tools', icon: Scan, color: 'violet', tag: 'NEW', formats: 'JPG, PNG, PDF' },
  { id: 'redact', name: 'PDF Redactor', description: 'Permanently blackout confidential text, IC numbers, and private data.', category: 'PDF tools', icon: EyeOff, color: 'rose', tag: 'SECURITY', formats: 'PDF' },
  { id: 'audioextract', name: 'Video to Audio & Mute', description: 'Extract lossless master audio (WAV) from video clips or remove audio to export silent video.', category: 'Image tools', icon: Volume2, color: 'violet', tag: 'NEW', formats: 'MP4, MOV, WebM' },
  { id: 'exifcleaner', name: 'EXIF & Geotag Eraser', description: 'Inspect and wipe hidden GPS coordinates, device models, and timestamps from photos.', category: 'Image tools', icon: ShieldAlert, color: 'amber', tag: 'HOT', formats: 'JPG, PNG, WebP' },
  { id: 'cinematic', name: 'Cinematic Video Studio', description: 'Record video presentations with cinematic background blur and a floating teleprompter.', category: 'Image tools', icon: Camera, color: 'violet', tag: 'HOT', formats: 'Camera, MP4' },
  { id: 'faceblur', name: 'Face & Plate Blur', description: 'Pixelate or blur human faces, vehicle plates, and confidential details on photos.', category: 'Image tools', icon: EyeOff, color: 'rose', tag: 'PRIVACY', formats: 'JPG, PNG, WebP' },
  { id: 'qrstudio', name: 'Smart QR & Barcode Studio', description: 'Generate styled QR codes for Wi-Fi, WhatsApp, links, or scan barcodes via camera.', category: 'Image tools', icon: QrCode, color: 'coral', tag: 'NEW', formats: 'PNG, SVG, Camera' },
  { id: 'audiorecorder', name: 'Voice Memo & Audio Recorder', description: 'Record clean voice memos and speech with live acoustic rumble noise filtering.', category: 'Image tools', icon: Mic, color: 'teal', tag: 'NEW', formats: 'Mic, WAV' },
  { id: 'videotogif', name: 'Video to Animated GIF', description: 'Convert video clips into animated GIFs and meme stickers with captions.', category: 'Image tools', icon: Film, color: 'orange', tag: 'POPULAR', formats: 'MP4, MOV, WebM' },
  { id: 'screenrecord', name: 'Screen & Webcam Recorder', description: 'Record full screen, windows, and tabs with a circular face-cam and microphone narration.', category: 'Image tools', icon: Monitor, color: 'blue', tag: 'HOT', formats: 'Screen, MP4' },
  { id: 'audiocutter', name: 'Audio Trimmer & Ringtone', description: 'Cut custom phone ringtones, alarm tones, and audio clips with interactive waveform scrubbing.', category: 'Image tools', icon: Scissors, color: 'coral', tag: 'NEW', formats: 'MP3, WAV, M4A' },
  { id: 'gridsplit', name: 'Carousel & Grid Splitter', description: 'Slice panoramic photos into seamless swipeable Instagram carousel slides or 3x3 grids.', category: 'Image tools', icon: Columns, color: 'violet', tag: 'NEW', formats: 'JPG, PNG, WebP' },
  { id: 'encrypt', name: 'Encrypted File Vault', description: 'Lock any document, photo, or archive with military-grade 256-bit password encryption.', category: 'PDF tools', icon: Lock, color: 'green', tag: 'SECURITY', formats: 'Any file, .xenn' },
  { id: 'pdfgrayscale', name: 'PDF Ink Saver & Grayscale', description: 'Convert color PDFs into ink-saving black and white or grayscale to save printer cartridge ink.', category: 'PDF tools', icon: Printer, color: 'teal', tag: 'NEW', formats: 'PDF' },
  { id: 'audioshift', name: 'Audio Pitch & Speed', description: 'Change audio playback speed or transpose musical pitch (+/- 12 semitones) for singing or study.', category: 'Image tools', icon: Gauge, color: 'violet', tag: 'NEW', formats: 'MP3, WAV, M4A' },
  { id: 'palette', name: 'Color Palette & Eyedropper', description: 'Extract dominant color palettes from photos, inspect WCAG contrast, and click any pixel to sample colors.', category: 'Image tools', icon: Palette, color: 'emerald', tag: 'NEW', formats: 'JPG, PNG, WebP' },
  { id: 'audiomerge', name: 'Audio Track Merger', description: 'Combine multiple songs, podcast clips, or voice notes into a continuous master track with crossfades.', category: 'Image tools', icon: ListMusic, color: 'coral', tag: 'NEW', formats: 'MP3, WAV, M4A' },
  { id: 'svgoptimize', name: 'SVG Cleaner & Minifier', description: 'Strip editor bloat, metadata, and excess decimal precision from Figma, Canva, and Illustrator SVGs.', category: 'Image tools', icon: Code, color: 'orange', tag: 'DEV', formats: 'SVG' },
  { id: 'modernconvert', name: 'WebP & AVIF Optimizer', description: 'Convert photos to next-generation WebP and AVIF formats for lightning-fast websites.', category: 'Image tools', icon: Zap, color: 'teal', tag: 'HOT', formats: 'JPG, PNG, WebP, AVIF' },
  { id: 'ocr_reader', name: 'OCR Photo & Doc Scanner', description: 'Extract editable text from receipts, documents, and screenshots directly in browser memory.', category: 'PDF tools', icon: FileText, color: 'violet', tag: 'AI OCR', formats: 'PNG, JPG, WebP' },
  { id: 'watermark_img', name: 'Photo Watermark & Copyright', description: 'Stamp custom text, logo graphics, or tiled protection grids on single or batch photos.', category: 'Image tools', icon: Layers, color: 'coral', tag: 'BATCH', formats: 'JPG, PNG, WebP' },
  { id: 'favicongen', name: 'Favicon & App Icon Generator', description: 'Generate all browser tab icons, Apple Touch, Android PWA icons, HTML tags, and manifest in a ZIP.', category: 'Image tools', icon: Globe, color: 'blue', tag: 'DEV', formats: 'PNG, SVG, JPG' },
  { id: 'base64_studio', name: 'Base64 Data URI & Asset Studio', description: 'Encode files to inline Base64/Data URI strings, HTML/CSS tags, or decode Base64 back to files.', category: 'Image tools', icon: Binary, color: 'teal', tag: 'STUDIO', formats: 'Any file' },
  { id: 'code_to_img', name: 'Code Screenshot & Card Studio', description: 'Render syntax-highlighted code snippets into beautiful cards with traffic lights and gradients.', category: 'Image tools', icon: Code2, color: 'orange', tag: 'HOT', formats: 'Code, Text' },
  { id: 'audioreverb', name: 'Acoustic Reverb & Spatial Audio', description: 'Immerse audio in cathedral, concert hall, room, or cosmic space acoustics using impulse convolution.', category: 'Image tools', icon: Volume2, color: 'emerald', tag: 'AUDIO', formats: 'MP3, WAV, M4A' },
  { id: 'audio_eq', name: 'Vocal Equalizer & Bass Booster', description: 'Fine-tune acoustic frequencies, boost deep bass, and sculpt vocal warmth with real-time spectrum feedback.', category: 'Image tools', icon: Sliders, color: 'violet', tag: '7-BAND EQ', formats: 'MP3, WAV, M4A' },
  { id: 'audio_8d', name: '8D Spatial Audio & Binaural Orbit', description: 'Simulate dynamic 360-degree rotating binaural audio that orbits around your head for headphones.', category: 'Image tools', icon: Headphones, color: 'blue', tag: '8D AUDIO', formats: 'MP3, WAV, M4A' },
  { id: 'audio_gate', name: 'Audio Silence Trimmer & Voice Gate', description: 'Automatically detect and strip dead silence and background room hiss from podcasts and voice memos.', category: 'Image tools', icon: Scissors, color: 'orange', tag: 'AUTO TRIM', formats: 'MP3, WAV, M4A' },
  { id: 'aspect_fit', name: 'Aspect Ratio Fit & Blur Background', description: 'Fit photos into Instagram, TikTok, Reels, or YouTube ratios without cropping using frosted borders.', category: 'Image tools', icon: Maximize2, color: 'coral', tag: 'NO CROP', formats: 'JPG, PNG, WebP' },
  { id: 'video_captions', name: 'Video Subtitle & SRT Caption Studio', description: 'Create, edit, and sync subtitles directly over video clips with live overlay previews and SRT export.', category: 'Image tools', icon: Film, color: 'violet', tag: 'SRT & VTT', formats: 'MP4, WebM, MOV' },
  { id: 'meme_gen', name: 'Meme Generator & Text Overlay', description: 'Create classic Impact memes or modern card-style posts with high-contrast outlines and image copying.', category: 'Image tools', icon: Smile, color: 'orange', tag: 'MEME', formats: 'JPG, PNG, WebP' },
  { id: 'batch_renamer', name: 'Batch File Renamer & Pattern Stamper', description: 'Rename dozens of files at once using smart prefixes, find and replace, date stamps, and index counters.', category: 'PDF tools', icon: FolderArchive, color: 'teal', tag: 'BATCH', formats: 'Any file, ZIP' },
  { id: 'pdf_metadata', name: 'PDF Metadata Cleaner & Inspector', description: 'Inspect and eradicate hidden author names, software producer tags, and creation timestamps from PDFs.', category: 'PDF tools', icon: ShieldAlert, color: 'coral', tag: 'PRIVACY', formats: 'PDF' },
  { id: 'hash_verifier', name: 'Checksum & Hash Verifier', description: 'Compute authentic SHA-256, SHA-512, and SHA-1 cryptographic hashes to verify file integrity.', category: 'PDF tools', icon: KeyRound, color: 'blue', tag: 'SECURITY', formats: 'Any file' },
  { id: 'json_studio', name: 'JSON Studio & Syntax Formatter', description: 'Beautify, validate, minify, and inspect JSON data in browser memory with instant error location.', category: 'Image tools', icon: Braces, color: 'teal', tag: 'DEV', formats: 'JSON, Text' },
  { id: 'markdown_studio', name: 'Markdown Document Studio', description: 'Write and preview rich formatted documents with GitHub-flavored Markdown. Export clean HTML or print to PDF.', category: 'PDF tools', icon: FileText, color: 'orange', tag: 'DOCS', formats: 'MD, HTML, PDF' }
];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function App() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  useEffect(() => {
    document.documentElement.lang = language === 'ms' ? 'ms' : 'en';
  }, [language]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('xenn-theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('xenn-theme', theme);
    } catch {}
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  const [category, setCategory] = useState('All tools');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Tool | null>(null);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Favorites pinned state persisted locally
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('xenn_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('xenn_favorites', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Hero Drop Zone State
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroDrag, setHeroDrag] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setInfo(null);
        setMobile(false);
        setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const visible = tools.filter((tool) => {
    const matchesCategory =
      category === 'All tools' ||
      (category === 'Favorites' && favorites.includes(tool.id)) ||
      (category === 'PDF tools' && tool.category === 'PDF tools') ||
      (category === 'Image tools' && tool.category === 'Image tools') ||
      (category === 'Audio & Video' && ['audio', 'reverb', 'eq', '8d', 'gate', 'cutter', 'recorder', 'video', 'tiktok', 'livephoto', 'status_hd'].some((k) => tool.id.includes(k))) ||
      (category === 'Dev & Security' && ['json', 'base64', 'code', 'hash', 'encrypt', 'svg', 'qr', 'metadata'].some((k) => tool.id.includes(k)));

    if (!matchesCategory) return false;
    return `${tool.name} ${tool.description} ${t(tool.name)} ${t(tool.description)} ${tool.formats || ''} ${tool.tag || ''}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });

  function openToolWithFiles(tool: Tool, files: File[]) {
    setInitialFiles(files);
    setActive(tool);
    setHeroFile(null);
  }

  function handleHeroFile(f: File | undefined) {
    if (!f) return;
    setHeroFile(f);
  }

  function browse(cat: string) {
    setCategory(cat);
    setMobile(false);
    document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
  }

  const isHeroPdf = heroFile && (heroFile.type === 'application/pdf' || heroFile.name.toLowerCase().endsWith('.pdf'));
  const isHeroVideo = heroFile && (heroFile.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(heroFile.name));

  return (
    <>
      <header>
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Xenn for all home">
            <img src={brandIcon} alt="" className="brand-mark-img" width={34} height={34} />
            xenn<span className="brand-light">for all<span className="brand-dot">.</span></span>
          </a>

          <nav className={mobile ? 'nav open' : 'nav'}>
            <button onClick={() => browse('All tools')}>
              {t("All tools")}
              <ChevronDown size={14} />
            </button>
            <button onClick={() => browse('PDF tools')}>{t("PDF tools")}</button>
            <button onClick={() => browse('Image tools')}>{t("Image tools")}</button>
            <button onClick={() => setInfo('How it works')}>{t("How it works")}</button>
            <button onClick={() => setInfo('About Xenn for all')}>{t("About")}</button>
          </nav>

          <div className="header-actions">
            <button
              className="cmd-search-trigger"
              onClick={() => setCmdOpen(true)}
              title={t("Search 54 tools (Ctrl + K)")}
              aria-label={t("Search tools")}
            >
              <Search size={14} />
              <span>{t("Search tools…")}</span>
              <kbd>Ctrl K</kbd>
            </button>

            <label className="language-switch">
              <span className="language-label">{language === 'ms' ? 'Bahasa' : 'Language'}</span>
              <select
                aria-label="Language / Bahasa"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'ms')}
              >
                <option value="en">English</option>
                <option value="ms">Bahasa Melayu</option>
              </select>
            </label>

            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t("Switch to light mode") : t("Switch to dark mode")}
              title={theme === 'dark' ? t("Switch to light mode") : t("Switch to dark mode")}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              className="mobile-menu"
              aria-label={t("Toggle navigation")}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Expansive Hero Section */}
        <section className="hero">
          <div className="hero-container">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-pill" />
                {t("PRIVATE CLIENT-SIDE WORKSTATION")}
              </div>
              <h1>
                {t("Simple, private tools for your PDFs and images.")}
              </h1>
              <p className="hero-description">
                {t("Runs 100% in your browser. No accounts, no subscriptions, and zero file uploads to any server.")}
              </p>

              <div className="hero-cta-group">
                <button className="primary" onClick={() => browse('All tools')}>
                  {t("Explore all tools")}
                  <ArrowRight size={17} />
                </button>
                <button className="secondary-btn" onClick={() => setInfo('How it works')}>
                  {t("How it works")}
                </button>
              </div>

              {/* Concrete proof metrics */}
              <div className="hero-metrics">
                <div className="metric-pill">
                  <strong>{tools.length}</strong>
                  <span>{t("Browser-Native Tools")}</span>
                </div>
                <div className="metric-pill">
                  <strong>100 MB</strong>
                  <span>{t("100 MB File Limit")}</span>
                </div>
                <div className="metric-pill">
                  <strong>0 KB</strong>
                  <span>{t("0 KB Uploaded")}</span>
                </div>
                <div className="metric-pill">
                  <strong>AGPL-3.0</strong>
                  <span>{t("AGPL-3.0 License")}</span>
                </div>
              </div>
            </div>

            {/* Interactive Hero Workstation Card */}
            <div className="hero-workstation-card" aria-label="Interactive client-side file hub">
              <div className="workstation-top">
                <div className="sandbox-indicator">
                  <span className="pipeline-dot" />
                  <span>{t("Local sandbox active")}</span>
                </div>
                <div className="workstation-formats">
                  <span>PDF · PNG · JPG · MP4</span>
                </div>
              </div>

              <input
                ref={heroInputRef}
                type="file"
                hidden
                accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.m4v"
                onChange={(e) => {
                  handleHeroFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {heroFile ? (
                <div className="hero-file-selected">
                  <div className="selected-meta">
                    <span className="file-badge">{isHeroPdf ? 'PDF' : isHeroVideo ? 'VIDEO' : 'IMAGE'}</span>
                    <div className="file-titles">
                      <strong>{heroFile.name}</strong>
                      <small>{(heroFile.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>
                    <button className="clear-btn" onClick={() => setHeroFile(null)} aria-label={t("Clear file")}>
                      <X size={16} />
                    </button>
                  </div>

                  <p className="action-prompt">
                    {isHeroPdf
                      ? t("Choose an action for your PDF:")
                      : isHeroVideo
                      ? t("Choose an action for your video:")
                      : t("Choose an action for your image:")}
                  </p>

                  <div className="hero-actions-grid">
                    {isHeroPdf ? (
                      <>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'signpdf')!, [heroFile])}>
                          <PenTool size={16} /> Sign & Watermark
                        </button>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'redact')!, [heroFile])}>
                          <EyeOff size={16} /> Redact PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'merge')!, [heroFile])}>
                          <Merge size={16} /> Merge PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'split')!, [heroFile])}>
                          <Scissors size={16} /> Split PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'organize')!, [heroFile])}>
                          <Layers size={16} /> Organize PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'rotate')!, [heroFile])}>
                          <RotateCw size={16} /> Rotate PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'pdfimage')!, [heroFile])}>
                          <FileImage size={16} /> PDF to image
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'pdfgrayscale')!, [heroFile])}>
                          <Printer size={16} /> Ink Saver PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'encrypt')!, [heroFile])}>
                          <Lock size={16} /> Encrypt Vault
                        </button>
                      </>
                    ) : isHeroVideo ? (
                      <>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'status_hd')!, [heroFile])}>
                          <Smartphone size={16} /> WhatsApp Status HD
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'videotogif')!, [heroFile])}>
                          <Film size={16} /> Make Animated GIF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'livephoto')!, [heroFile])}>
                          <Sparkles size={16} /> Video to Live Photo
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'audioextract')!, [heroFile])}>
                          <Volume2 size={16} /> Extract Audio & Mute
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'faceblur')!, [heroFile])}>
                          <EyeOff size={16} /> Blur Faces & Plates
                        </button>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'exifcleaner')!, [heroFile])}>
                          <ShieldAlert size={16} /> Erase GPS & EXIF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'passport')!, [heroFile])}>
                          <Camera size={16} /> Passport & IC Photo
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'scandoc')!, [heroFile])}>
                          <Scan size={16} /> Scan Document
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'status_hd')!, [heroFile])}>
                          <Smartphone size={16} /> Status HD (9:16)
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'background')!, [heroFile])}>
                          <Scissors size={16} /> Remove background
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'compress')!, [heroFile])}>
                          <ArrowDownToLine size={16} /> Compress image
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'crop')!, [heroFile])}>
                          <Scissors size={16} /> Crop image
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'convert')!, [heroFile])}>
                          <Image size={16} /> Convert format
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'gridsplit')!, [heroFile])}>
                          <Columns size={16} /> Carousel Splitter
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'encrypt')!, [heroFile])}>
                          <Lock size={16} /> Encrypt Vault
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`hero-dropzone ${heroDrag ? 'drag' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setHeroDrag(true);
                  }}
                  onDragLeave={() => setHeroDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setHeroDrag(false);
                    handleHeroFile(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => heroInputRef.current?.click()}
                >
                  <div className="dropzone-icon">
                    <Upload size={24} />
                  </div>
                  <strong>{t("Drop your file here, or browse")}</strong>
                  <span>{t("Select a PDF, image, or video to quickly launch the right tool.")}</span>
                </div>
              )}

              {/* Suite Quick-Pill Row */}
              <div className="workstation-suites">
                <div className="suite-group">
                  <span className="suite-title">
                    <Files size={13} /> {t("PDF & Docs")}:
                  </span>
                  <div className="suite-chips">
                    <button onClick={() => setActive(tools.find((x) => x.id === 'signpdf')!)}>Sign</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'merge')!)}>Merge</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'split')!)}>Split</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'organize')!)}>Organize</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'rotate')!)}>Rotate</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'pdfgrayscale')!)}>Ink Saver</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'pdf_metadata')!)}>PDF Meta</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'markdown_studio')!)}>Markdown</button>
                  </div>
                </div>

                <div className="suite-group">
                  <span className="suite-title">
                    <Image size={13} /> {t("Image & Photo")}:
                  </span>
                  <div className="suite-chips">
                    <button onClick={() => setActive(tools.find((x) => x.id === 'passport')!)}>Passport</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'scandoc')!)}>Scan</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'watermark_img')!)}>Watermark</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'faceblur')!)}>Face Blur</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'exifcleaner')!)}>EXIF Clean</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'aspect_fit')!)}>Aspect Fit</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'favicongen')!)}>Favicon</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'meme_gen')!)}>Meme</button>
                  </div>
                </div>

                <div className="suite-group">
                  <span className="suite-title">
                    <Volume2 size={13} /> {t("Audio & Media")}:
                  </span>
                  <div className="suite-chips">
                    <button onClick={() => setActive(tools.find((x) => x.id === 'status_hd')!)}>Status HD</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'tiktok')!)}>TikTok</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'audioreverb')!)}>Reverb</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'audio_eq')!)}>Vocal EQ</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'audio_8d')!)}>8D Audio</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'audio_gate')!)}>Voice Gate</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'audiocutter')!)}>Ringtone</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'video_captions')!)}>Captions</button>
                  </div>
                </div>

                <div className="suite-group">
                  <span className="suite-title">
                    <Code2 size={13} /> {t("Dev & Security")}:
                  </span>
                  <div className="suite-chips">
                    <button onClick={() => setActive(tools.find((x) => x.id === 'json_studio')!)}>JSON</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'hash_verifier')!)}>Hash Verify</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'base64_studio')!)}>Base64</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'code_to_img')!)}>Code Card</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'encrypt')!)}>Vault</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'svgoptimize')!)}>SVG Minify</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'qrstudio')!)}>QR Studio</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'batch_renamer')!)}>Renamer</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Expansive Tool Directory Section */}
        <section className="tools-section" id="tools">
          <div className="section-container">
            <div className="section-top">
              <div>
                <div className="eyebrow">{t("YOUR EVERYDAY TOOLKIT")}</div>
                <h2>{t("Select a tool to begin")}</h2>
                <p>{t("A focused suite of browser-native utilities for daily file tasks.")}</p>
              </div>
              <label className="search">
                <Search size={18} />
                <input
                  ref={searchRef}
                  placeholder={t("Find a tool or press Ctrl+K…")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={t("Search tools")}
                />
                <button
                  type="button"
                  className="kbd-btn"
                  onClick={() => setCmdOpen(true)}
                  title={t("Open Command Palette")}
                  style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
                >
                  <kbd>Ctrl K</kbd>
                </button>
              </label>
            </div>

            <div className="filter-row">
              <div className="filters">
                <button
                  className={category === 'All tools' ? 'selected' : ''}
                  onClick={() => setCategory('All tools')}
                >
                  <Layers size={15} /> {t("All tools")}
                  <span>{tools.length}</span>
                </button>
                {favorites.length > 0 && (
                  <button
                    className={category === 'Favorites' ? 'selected' : ''}
                    onClick={() => setCategory('Favorites')}
                  >
                    <Star size={15} fill="#f59e0b" color="#f59e0b" /> {t("Favorites")}
                    <span>{favorites.length}</span>
                  </button>
                )}
                <button
                  className={category === 'PDF tools' ? 'selected' : ''}
                  onClick={() => setCategory('PDF tools')}
                >
                  <Files size={15} /> {t("PDF & Docs")}
                  <span>{tools.filter((t) => t.category === 'PDF tools').length}</span>
                </button>
                <button
                  className={category === 'Image tools' ? 'selected' : ''}
                  onClick={() => setCategory('Image tools')}
                >
                  <Image size={15} /> {t("Image & Photo")}
                  <span>{tools.filter((t) => t.category === 'Image tools' && !['audio', 'reverb', 'eq', '8d', 'gate', 'cutter', 'recorder'].some((k) => t.id.includes(k))).length}</span>
                </button>
                <button
                  className={category === 'Audio & Video' ? 'selected' : ''}
                  onClick={() => setCategory('Audio & Video')}
                >
                  <Volume2 size={15} /> {t("Audio & Video")}
                  <span>{tools.filter((t) => ['audio', 'reverb', 'eq', '8d', 'gate', 'cutter', 'recorder', 'video', 'tiktok', 'livephoto', 'status_hd'].some((k) => t.id.includes(k))).length}</span>
                </button>
                <button
                  className={category === 'Dev & Security' ? 'selected' : ''}
                  onClick={() => setCategory('Dev & Security')}
                >
                  <Code2 size={15} /> {t("Dev & Security")}
                  <span>{tools.filter((t) => ['json', 'base64', 'code', 'hash', 'encrypt', 'svg', 'qr', 'metadata'].some((k) => t.id.includes(k))).length}</span>
                </button>
              </div>
              <span className="local-note">
                <ShieldCheck size={15} />
                {t("Your files stay on your device")}
              </span>
            </div>

            {/* Pinned Favorites Quick Shelf */}
            {favorites.length > 0 && category === 'All tools' && !query && (
              <div className="favorites-shelf">
                <div className="favorites-shelf-header">
                  <span className="favorites-shelf-title">
                    <Star size={14} className="shelf-star" fill="currentColor" /> {t("Pinned Favorites")}
                  </span>
                  <span className="favorites-shelf-count">
                    {favorites.length} {favorites.length === 1 ? t("tool pinned") : t("tools pinned")}
                  </span>
                </div>
                <div className="favorites-shelf-grid">
                  {favorites.map((favId) => {
                    const favTool = tools.find((t) => t.id === favId);
                    if (!favTool) return null;
                    const FavIcon = favTool.icon;
                    return (
                      <div
                        key={favTool.id}
                        className="fav-chip-card"
                        onClick={() => openToolWithFiles(favTool, [])}
                      >
                        <span className={`fav-chip-icon ${favTool.color}`}>
                          <FavIcon size={16} strokeWidth={2} />
                        </span>
                        <span className="fav-chip-name">{t(favTool.name)}</span>
                        <button
                          type="button"
                          className="fav-chip-unpin"
                          title={t("Unpin")}
                          aria-label={t("Unpin")}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(favTool.id, e);
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="tool-grid">
              {visible.map((tool) => (
                <button
                  key={tool.id}
                  className="tool-card"
                  onClick={() => openToolWithFiles(tool, [])}
                >
                  <div className="card-top">
                    <span className={`tool-icon ${tool.color}`}>
                      <tool.icon size={22} strokeWidth={1.8} />
                    </span>
                    <div className="card-badges">
                      {tool.tag && <span className="tag">{t(tool.tag)}</span>}
                      <span className="card-format-tag">{tool.formats}</span>
                    </div>
                    <button
                      type="button"
                      className={`card-star-btn ${favorites.includes(tool.id) ? 'pinned' : ''}`}
                      title={favorites.includes(tool.id) ? t("Unpin from favorites") : t("Pin to favorites")}
                      aria-label={favorites.includes(tool.id) ? t("Unpin from favorites") : t("Pin to favorites")}
                      onClick={(e) => toggleFavorite(tool.id, e)}
                    >
                      <Star size={16} fill={favorites.includes(tool.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <h3>{t(tool.name)}</h3>
                  <p>{t(tool.description)}</p>
                  <div className="card-footer">
                    <span className="card-category">
                      {tool.category === 'PDF tools' ? t('PDF TOOL') : t('IMAGE TOOL')}
                    </span>
                    <span className="card-action-link">
                      Open <ArrowRight size={14} />
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {visible.length === 0 && (
              <div className="empty">
                {t("No tools found. Try “PDF” or “image”.")}
                <button
                  onClick={() => {
                    setQuery('');
                    setCategory('All tools');
                  }}
                >
                  {t("Show all tools")}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 4-Pillar Architectural Proof Section */}
        <section className="architecture-section">
          <div className="section-container">
            <div className="architecture-header">
              <div className="eyebrow">{t("PRIVACY & ARCHITECTURE")}</div>
              <h2>{t("Why in-browser processing matters")}</h2>
              <p>
                {t("Traditional web tools send your sensitive files to cloud servers. Xenn for all processes every byte locally on your machine.")}
              </p>
            </div>

            <div className="architecture-grid">
              <div className="arch-card">
                <span className="arch-icon">
                  <ShieldCheck size={24} />
                </span>
                <h3>{t("Zero server uploads")}</h3>
                <p>
                  {t("Your files never leave your device. Processing occurs in sandboxed browser memory and is discarded when done.")}
                </p>
              </div>

              <div className="arch-card">
                <span className="arch-icon">
                  <Cpu size={24} />
                </span>
                <h3>{t("Powered by your hardware")}</h3>
                <p>
                  {t("PDF reordering, image compression, and AI background removal run locally via WebAssembly and ONNX Runtime.")}
                </p>
              </div>

              <div className="arch-card">
                <span className="arch-icon">
                  <LockKeyhole size={24} />
                </span>
                <h3>{t("No accounts or tracking")}</h3>
                <p>
                  {t("No sign-up screens, usage limits, email requests, or paywalls. Open the page and complete your task.")}
                </p>
              </div>

              <div className="arch-card">
                <span className="arch-icon">
                  <Zap size={24} />
                </span>
                <h3>{t("Offline capable")}</h3>
                <p>
                  {t("Once loaded into your browser cache, core tools operate without depending on external web services.")}
                </p>
              </div>
            </div>

            {/* Architecture Comparison Table */}
            <div className="comparison-container">
              <div className="comparison-header">
                <h3>{t("Privacy & Architecture Comparison")}</h3>
                <p>{t("How Xenn for all compares with cloud-based file tools.")}</p>
              </div>

              <div className="comparison-table-wrapper">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Capability</th>
                      <th>{t("Traditional Cloud Converters")}</th>
                      <th>{t("Xenn for all (Local WebAssembly)")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>{t("File Upload to Server")}</strong></td>
                      <td><span className="bad-pill">✕ {t("Yes, files sent over network")}</span></td>
                      <td><span className="good-pill">✓ {t("Zero bytes uploaded (100% in-browser)")}</span></td>
                    </tr>
                    <tr>
                      <td><strong>{t("Document Privacy")}</strong></td>
                      <td>{t("Stored on third-party cloud")}</td>
                      <td><strong>{t("Never leaves your device RAM")}</strong></td>
                    </tr>
                    <tr>
                      <td><strong>{t("Account Requirement")}</strong></td>
                      <td>{t("Often requires sign-up")}</td>
                      <td><strong>{t("Never required")}</strong></td>
                    </tr>
                    <tr>
                      <td><strong>{t("Pricing & Subscriptions")}</strong></td>
                      <td>{t("Free trial with recurring fee")}</td>
                      <td><span className="good-pill">✓ {t("100% Free and open source")}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="bottom-note">
          <p>
            {t("Open source under the AGPL-3.0 license. Inspect the code on GitHub or host it on your own infrastructure.")}
          </p>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <a className="brand" href="/" aria-label="Xenn for all home">
            <img src={brandIcon} alt="" className="brand-mark-img footer-logo" width={26} height={26} />
            xenn<span className="brand-light">for all.</span>
          </a>
          <span>{t("Private client-side file tools.")}</span>
          <div className="footer-links">
            <button onClick={() => setInfo('Privacy')}>{t("Privacy")}</button>
            <button onClick={() => setInfo('About Xenn for all')}>{t("About")}</button>
            <a href="https://github.com/i0zfnr/xennforall" target="_blank" rel="noreferrer">
              {t("Source code")}
            </a>
          </div>
        </div>
      </footer>

      {active &&
        (active.id === 'batch' ? <Suspense fallback={<div role="status">{t('Loading your tool…')}</div>}><BatchImages close={() => setActive(null)} /></Suspense> : ['pdfimage', 'organize', 'crop', 'number'].includes(active.id) ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <NewTools
              kind={active.id as 'pdfimage' | 'organize' | 'crop' | 'number'}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'status_hd' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <StatusHdTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'tiktok' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <TikTokTool
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
              onSendToStatusHd={(file) => {
                setActive(tools.find((x) => x.id === 'status_hd')!);
                setInitialFiles([file]);
              }}
              onSendToLivePhoto={(file) => {
                setActive(tools.find((x) => x.id === 'livephoto')!);
                setInitialFiles([file]);
              }}
            />
          </Suspense>
        ) : active.id === 'livephoto' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <LivePhotoTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'passport' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <PassportPhotoTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'signpdf' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <SignPdfTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'scandoc' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <ScanDocTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'redact' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <RedactPdfTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audioextract' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioExtractTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'exifcleaner' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <ExifCleanerTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'cinematic' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <CinematicStudioTool
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
              onSendToStatusHd={(file) => {
                setActive(tools.find((x) => x.id === 'status_hd')!);
                setInitialFiles([file]);
              }}
            />
          </Suspense>
        ) : active.id === 'faceblur' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <FaceBlurTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'qrstudio' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <QrStudioTool
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audiorecorder' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioRecorderTool
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'videotogif' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <VideoToGifTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'screenrecord' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <ScreenRecordTool
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
              onSendToStatusHd={(file) => {
                setActive(tools.find((x) => x.id === 'status_hd')!);
                setInitialFiles([file]);
              }}
            />
          </Suspense>
        ) : active.id === 'audiocutter' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioCutterTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'gridsplit' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <GridSplitTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'encrypt' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <EncryptTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'pdfgrayscale' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <PdfGrayscaleTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audioshift' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioShiftTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'palette' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <PaletteTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audiomerge' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioMergeTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'svgoptimize' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <SvgOptimizeTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'modernconvert' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <ModernConvertTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'ocr_reader' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <OcrReaderTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'watermark_img' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <WatermarkImageTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'favicongen' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <FaviconGenTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'base64_studio' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <Base64StudioTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'code_to_img' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <CodeToImgTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audioreverb' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioReverbTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audio_eq' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioEqTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audio_8d' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <Audio8dTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audio_gate' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioGateTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'aspect_fit' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AspectFitTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'video_captions' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <VideoCaptionTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'meme_gen' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <MemeGenTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'batch_renamer' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <BatchRenamerTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'pdf_metadata' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <PdfMetadataTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'hash_verifier' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <HashVerifierTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'json_studio' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <JsonStudioTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'markdown_studio' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <MarkdownStudioTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : (
          <ToolDialog
            tool={active}
            initialFiles={initialFiles}
            close={() => {
              setActive(null);
              setInitialFiles([]);
            }}
          />
        ))}

      {info && (
        <div className="modal-backdrop" onClick={() => setInfo(null)}>
          <section
            className="modal info-modal"
            role="dialog"
            aria-modal="true"
            aria-label={info}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" aria-label={t("Close")} onClick={() => setInfo(null)}>
              <X size={18} />
            </button>
            <span className="tool-icon green">
              <ShieldCheck size={24} />
            </span>
            <h2>{t(info)}</h2>
            {info === 'How it works' ? (
              <ol>
                <li>{t("Pick a PDF or image tool.")}</li>
                <li>{t("Choose your files and settings.")}</li>
                <li>{t("Process and download the result. No account needed.")}</li>
              </ol>
            ) : (
              <p>
                {t(
                  "Xenn for all is a free toolkit for everyday file tasks. Processing happens on your own device, with no file uploads, tracking, or accounts. Background removal downloads an AI model on first use, so an internet connection is required. Your device’s memory determines the size of files you can process."
                )}
              </p>
            )}
            <p className="muted">
              {t(
                "Built with React and TypeScript. Background removal powered by IMG.LY (AGPL-3.0). See the project README for source and license details."
              )}
            </p>
          </section>
        </div>
      )}

      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        tools={tools}
        onSelectTool={(tool) => openToolWithFiles(tool, [])}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />
    </>
  );
}

function ToolDialog({
  tool,
  initialFiles = [],
  close
}: {
  tool: Tool;
  initialFiles?: File[];
  close: () => void;
}) {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [value, setValue] = useState(
    tool.id === 'rotate' ? '90' : tool.id === 'resize' ? '1200' : tool.id === 'split' ? '1' : ''
  );
  const [format, setFormat] = useState('image/png');
  const [quality, setQuality] = useState(72);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    setResult(null);
    setStatus('');
  }, [value, format, quality]);

  const workspace = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    workspace.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    if (busy) workspace.current?.focus();
    else if (result) {
      workspace.current?.querySelector<HTMLButtonElement>('.workspace-action .primary')?.focus({ preventScroll: true });
    }
  }, [busy, result]);

  const input = useRef<HTMLInputElement>(null);
  const isPdf = ['merge', 'split', 'rotate'].includes(tool.id);
  const multiple = ['merge', 'imagepdf'].includes(tool.id);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function add(incoming: File[]) {
    const valid = incoming.filter((f) =>
      isPdf
        ? f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        : ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    if (valid.length !== incoming.length) {
      setError(isPdf ? 'Please choose PDF files.' : 'Please choose JPG, PNG, or WebP images.');
      return;
    }
    if (incoming.some((f) => f.size > 100 * 1024 * 1024)) {
      setError('Please use files smaller than 100 MB for reliable browser processing.');
      return;
    }
    setFiles((prev) => (multiple ? [...prev, ...valid] : valid.slice(0, 1)));
    setResult(null);
    setError('');
    setStatus('');
  }

  async function run() {
    setBusy(true);
    setError('');
    setResult(null);
    setStatus('Working on your device…');
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    try {
      let blob: Blob;
      let name: string;

      if (isPdf || tool.id === 'imagepdf') {
        const { PDFDocument, degrees } = await import('pdf-lib');
        const out = await PDFDocument.create();

        if (tool.id === 'imagepdf') {
          for (const file of files) {
            const img = await loadImage(file);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            const image = await out.embedPng(canvas.toDataURL('image/png'));
            const scale = Math.min(555 / image.width, 802 / image.height, 1);
            const page = out.addPage([image.width * scale + 40, image.height * scale + 40]);
            page.drawImage(image, { x: 20, y: 20, width: image.width * scale, height: image.height * scale });
          }
        } else {
          for (const file of files) {
            const source = await PDFDocument.load(await file.arrayBuffer());
            let indices = source.getPageIndices();

            if (tool.id === 'split') {
              const pages: number[] = [];
              for (const part of value.split(',')) {
                const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
                if (!match) throw new Error('Enter pages like 1, 3-5.');
                const start = Number(match[1]);
                const end = Number(match[2] || match[1]);
                if (start < 1 || end < start || end > source.getPageCount()) {
                  throw new Error(`Choose pages between 1 and ${source.getPageCount()}.`);
                }
                for (let n = start; n <= end; n++) pages.push(n - 1);
              }
              indices = [...new Set(pages)];
            }

            for (const page of await out.copyPages(source, indices)) {
              if (tool.id === 'rotate') {
                page.setRotation(degrees((page.getRotation().angle + Number(value)) % 360));
              }
              out.addPage(page);
            }
          }
        }
        const bytes = await out.save();
        blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
        name = `xenn-${tool.id}.pdf`;
      } else if (tool.id === 'background') {
        setStatus('Loading AI model. First use may take a few minutes…');
        const { removeBackground } = await import('@imgly/background-removal');
        blob = await removeBackground(files[0], {
          device: 'cpu',
          model: 'isnet_quint8',
          progress: (key, current, total) => {
            setStatus(
              `${key.startsWith('fetch') ? 'Downloading AI model' : 'Processing image'}${
                total ? ` · ${Math.round((current / total) * 100)}%` : ''
              }`
            );
          }
        });
        name = 'xenn-no-background.png';
      } else {
        const img = await loadImage(files[0]);
        const canvas = document.createElement('canvas');
        const width = tool.id === 'resize' ? Number(value) : img.naturalWidth;
        if (!Number.isFinite(width) || width < 1 || width > 16000) {
          throw new Error('Enter a width between 1 and 16000 pixels.');
        }
        canvas.width = width;
        canvas.height = Math.max(1, Math.round((img.naturalHeight * width) / img.naturalWidth));
        const ctx = canvas.getContext('2d')!;
        const mime = tool.id === 'compress' ? 'image/jpeg' : format;
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This image could not be converted.'))), mime, tool.id === 'compress' ? quality / 100 : 0.92)
        );
        name = `xenn-${tool.id}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`;
      }

      setResult({ blob, name });
      setStatus('All done! Your file is ready.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try a different file.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  const currentStep = result ? 3 : busy ? 2 : 1;
  const fileSize = (size: number) =>
    size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={workspace}
        tabIndex={-1}
        className="tool-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            if (!busy) close();
          }
          if (e.key === 'Tab') {
            const controls = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not([type="hidden"]):not(:disabled),select:not(:disabled),a[href],[tabindex="0"]'
              )
            ).filter((el) => el.getClientRects().length > 0);
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === e.currentTarget)) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={busy} onClick={close}>
            <ArrowRight size={15} />
            {t("All tools")}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t("Private by design")}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t("Close tool")}>
            <X size={19} />
          </button>
        </div>

        <div className="workspace-heading">
          <span className={`tool-icon ${tool.color}`}>
            <tool.icon size={26} />
          </span>
          <div>
            <span className="workspace-category">
              {t(tool.category)} <span>/</span> {t("YOUR WORKSPACE")}
            </span>
            <h2 id="tool-title">{t(tool.name)}</h2>
            <p>{t(tool.description)}</p>
          </div>
        </div>

        <ol className="workspace-steps" aria-label={t("Tool progress")}>
          {[
            { name: t("Choose your files"), detail: t("Start with what you have") },
            { name: t("Process locally"), detail: t("Processed on your device") },
            { name: t("Take it with you"), detail: t("Preview and download") }
          ].map((step, index) => (
            <li
              key={step.name}
              className={currentStep === index + 1 ? 'current' : currentStep > index + 1 ? 'complete' : ''}
              aria-current={currentStep === index + 1 ? 'step' : undefined}
            >
              <span className="step-number">{currentStep > index + 1 ? <Check size={15} /> : index + 1}</span>
              <span>
                <b>{step.name}</b>
                <small>{step.detail}</small>
              </span>
              {index < 2 && <span className="step-connector" />}
            </li>
          ))}
        </ol>

        <div className="workspace-grid">
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className={`canvas-dot ${busy ? 'pulsing' : ''}`} />
                {busy ? t("IN PROGRESS") : result ? t("THE FINISHED THING") : t("A LITTLE ROOM TO CREATE")}
              </span>
              <span>
                {files.length
                  ? t(`${files.length} ${files.length === 1 ? 'file' : 'files'} selected`)
                  : t('Your preview lives here')}
              </span>
            </div>

            {files.length > 0 ? (
              <FilePreview files={files} result={result?.blob} busy={busy} toolId={tool.id} toolName={tool.name} />
            ) : (
              <button
                className={`workspace-empty ${drag ? 'drag' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  add(Array.from(e.dataTransfer.files));
                }}
                onClick={() => input.current?.click()}
              >
                <span className="empty-file-art">
                  <span className="empty-paper back-paper" />
                  <span className="empty-paper">
                    <tool.icon size={36} strokeWidth={1.4} />
                    <i />
                    <i />
                  </span>
                  <span className="empty-plus">
                    <Plus size={18} />
                  </span>
                </span>
                <strong>{t("Choose or drop a file to begin")}</strong>
                <span>
                  {t("Drop your")}{' '}
                  {isPdf ? 'PDF' : t('image')}
                  {multiple && getLanguage() === 'en' ? 's' : ''}{' '}
                  {t('here, or choose')}{' '}
                  {multiple ? t('them') : t('one')}{' '}
                  {t('from your device.')}
                </span>
                <span className="empty-upload">
                  <Upload size={16} />
                  {t('Choose')} {isPdf ? t('PDF files') : t('images')}
                </span>
                <small>
                  {isPdf ? 'PDF' : 'JPG, PNG, WebP'}
                  {t("· Up to 100 MB per file")}
                </small>
              </button>
            )}

            <div className="canvas-footer">
              <LockKeyhole size={13} />
              <span>{t("Your files stay here. On your device. Always.")}</span>
            </div>
          </div>

          <aside className="workspace-controls" aria-label={t("Files and settings")}>
            <div className="controls-section">
              <div className="controls-heading">
                <h3>{t("Your files")}</h3>
                <span>{files.length ? String(files.length).padStart(2, '0') : '01'}</span>
              </div>
              <p className="controls-description">
                {multiple ? t("Add your files in the order you want.") : t("One file. A fresh possibility.")}
              </p>
              <button
                disabled={busy}
                className={`dropzone workspace-upload ${drag ? 'drag' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  if (!busy) add(Array.from(e.dataTransfer.files));
                }}
                onClick={() => input.current?.click()}
              >
                <Upload size={17} />
                <b>
                  {files.length
                    ? multiple
                      ? t("Add more files")
                      : t("Choose a different file")
                    : `${t('Choose')} ${isPdf ? t('PDF files') : t('images')}`}
                </b>
              </button>
              <input
                ref={input}
                type="file"
                hidden
                multiple={multiple}
                accept={isPdf ? '.pdf' : '.jpg,.jpeg,.png,.webp'}
                onChange={(e) => {
                  add(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              <div className="file-list">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`}>
                    <span className="file-order">{String(i + 1).padStart(2, '0')}</span>
                    <span title={f.name}>
                      {f.name}
                      <small>{fileSize(f.size)}</small>
                    </span>
                    {multiple && i > 0 && (
                      <button
                        disabled={busy}
                        aria-label={t(`Move ${f.name} up`)}
                        onClick={() => {
                          setResult(null);
                          setStatus('');
                          setFiles((prev) => {
                            const next = [...prev];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            return next;
                          });
                        }}
                      >
                        ↑
                      </button>
                    )}
                    <button
                      disabled={busy}
                      aria-label={t(`Remove ${f.name}`)}
                      onClick={() => {
                        setFiles(files.filter((_, n) => n !== i));
                        setResult(null);
                        setStatus('');
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="controls-section settings-section">
              <div className="controls-heading">
                <h3>{['split', 'rotate', 'resize', 'convert'].includes(tool.id) ? t("Make it yours") : t("Good to know")}</h3>
                <span>
                  <tool.icon size={15} />
                </span>
              </div>
              {tool.id === 'split' && (
                <label className="field">
                  {t("Pages to extract")}
                  <input disabled={busy} value={value} onChange={(e) => setValue(e.target.value)} placeholder="1, 3-5" />
                  <small>{t("For example: 1, 3-5. Selected pages become one PDF.")}</small>
                </label>
              )}
              {tool.id === 'rotate' && (
                <label className="field">
                  {t("Rotate all pages")}
                  <select disabled={busy} value={value} onChange={(e) => setValue(e.target.value)}>
                    <option value="90">{t("90° clockwise")}</option>
                    <option value="180">180°</option>
                    <option value="270">{t("90° counterclockwise")}</option>
                  </select>
                </label>
              )}
              {tool.id === 'resize' && (
                <label className="field">
                  {t("Width in pixels")}
                  <input
                    disabled={busy}
                    type="number"
                    min="1"
                    max="16000"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                  <small>{t("Aspect ratio is preserved.")}</small>
                </label>
              )}
              {['convert', 'resize'].includes(tool.id) && (
                <label className="field">
                  {t("Output format")}
                  <select disabled={busy} value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="image/png">PNG</option>
                    <option value="image/jpeg">JPG</option>
                    <option value="image/webp">WebP</option>
                  </select>
                </label>
              )}
              {tool.id === 'background' && (
                <p className="workspace-tip">
                  <Cpu size={17} />
                  <span>{t("The first run downloads the AI model. It can take a few minutes. After that, you’re ready for more.")}</span>
                </p>
              )}
              {tool.id === 'compress' && <label className="field">{t('Image quality')}: {quality}%<input type="range" min="10" max="100" value={quality} disabled={busy} onChange={(e) => setQuality(Number(e.target.value))} /><small>{t('Lower quality usually means a smaller file.')}</small></label>}
              {tool.id === 'compress' && result && <p className="workspace-tip">{t('Original')}: {fileSize(files[0].size)} · {t('Result')}: {fileSize(result.blob.size)}{result.blob.size >= files[0].size && <> · {t('The result is not smaller. Try a lower quality.')}</>}</p>}
              {tool.id === 'compress' && (
                <p className="workspace-tip">
                  <Image size={17} />
                  <span>{t("We’ll make a quality-optimized JPG. Transparent areas become white. File size depends on your original.")}</span>
                </p>
              )}
              {tool.id === 'merge' && (
                <p className="workspace-tip">
                  <Layers size={17} />
                  <span>{t("Your files become one PDF, in list order. Use the arrows to move a file up.")}</span>
                </p>
              )}
              {tool.id === 'imagepdf' && (
                <p className="workspace-tip">
                  <FileImage size={17} />
                  <span>{t("Each image becomes a page, with a little breathing room around it. Reorder files with the arrows.")}</span>
                </p>
              )}
            </div>

            <div className={`workspace-action ${result ? 'action-complete' : ''}`}>
              {error && (
                <p role="alert" className="error">
                  {t(error)}
                </p>
              )}
              {status && (
                <p role="status" className="status">
                  {busy ? <span className="spinner" /> : result ? <Check size={16} /> : null}
                  {t(status)}
                </p>
              )}
              {!status && !error && (
                <p className="action-hint">
                  {files.length ? t("A little less busywork starts here.") : t("Choose a file to get started.")}
                </p>
              )}
              {result ? (
                <button className="primary full" onClick={() => download(result.blob, result.name)}>
                  <ArrowDownToLine size={18} />
                  {t("Download result")}
                  <span>{fileSize(result.blob.size)}</span>
                </button>
              ) : (
                <button
                  className="primary full"
                  disabled={busy || files.length === 0 || (tool.id === 'merge' && files.length < 2)}
                  onClick={run}
                >
                  {busy ? (
                    t("Processing on your device…")
                  ) : tool.id === 'merge' && files.length < 2 ? (
                    t("Choose at least 2 PDFs")
                  ) : (
                    t(tool.name)
                  )}
                  {busy ? <span className="spinner" /> : <ArrowRight size={17} />}
                </button>
              )}
              <div className="dialog-privacy">
                <ShieldCheck size={13} />
                {t("No account. No uploads. No payment.")}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
