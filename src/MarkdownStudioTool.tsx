import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Bold,
  Check,
  Code,
  Download,
  Eye,
  FileCode,
  FileText,
  Heading1,
  Heading2,
  Italic,
  List,
  Printer,
  Quote,
  ShieldCheck,
  Table,
  Upload,
  X
} from 'lucide-react';

interface MarkdownStudioToolProps {
  initialFiles?: File[];
  close: () => void;
}

const DEFAULT_MARKDOWN = `# Xenn for all
A private, browser-native file toolkit running 100% in local memory.

## Key Advantages
- **Zero Server Uploads**: Your files never leave your device.
- **WebAssembly Powered**: Blazing fast client-side conversion.
- **Always Free**: No account requirements or subscriptions.

### Tool Categories
| Category | Tool Count | Privacy Guarantee |
| :--- | :--- | :--- |
| PDF Tools | 12+ | Client-side only |
| Image Studio | 18+ | 100% In-Browser |
| Audio Studio | 8+ | Web Audio API |

> *"True privacy means your data never crosses the wire."*

\`\`\`typescript
const isPrivate = true;
console.log("Welcome to secure in-browser productivity!");
\`\`\`
`;

export default function MarkdownStudioTool({ initialFiles = [], close }: MarkdownStudioToolProps) {
  const [markdown, setMarkdown] = useState<string>(DEFAULT_MARKDOWN);
  const [activeTab, setActiveTab] = useState<'split' | 'edit' | 'preview'>('split');

  // DOM Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      initialFiles[0].text().then((txt) => {
        if (txt) setMarkdown(txt);
      }).catch((e) => console.error(e));
    }
  }, []);

  // Simple, safe Markdown parser to HTML
  function renderMarkdownToHtml(md: string): string {
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks ```...```
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_m, lang, code) => {
      return `<pre class="md-code-block"><code class="lang-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code `...`
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Bold & Italics
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Simple table parser
    html = html.replace(
      /(\|.+\|\n)(\|[-:\s|]+\|\n)((\|.+\|\n?)+)/g,
      (_match, headerLine, _divider, bodyLines) => {
        const headers = headerLine.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('');
        const rows = bodyLines.trim().split('\n').map((row: string) => {
          const cols = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
          return `<tr>${cols}</tr>`;
        }).join('');
        return `<table class="md-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    );

    // Unordered lists
    html = html.replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>').replace(/<\/ul>\n<ul>/g, '');

    // Paragraphs
    html = html.replace(/\n\n/g, '<br/><br/>');

    return html;
  }

  function insertFormatting(tag: string, placeholder = 'text') {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = markdown.substring(start, end) || placeholder;

    let replacement = '';
    if (tag === 'bold') replacement = `**${selected}**`;
    else if (tag === 'italic') replacement = `*${selected}*`;
    else if (tag === 'h1') replacement = `# ${selected}\n`;
    else if (tag === 'h2') replacement = `## ${selected}\n`;
    else if (tag === 'code') replacement = `\`\`\`\n${selected}\n\`\`\`\n`;
    else if (tag === 'quote') replacement = `> ${selected}\n`;
    else if (tag === 'list') replacement = `- ${selected}\n`;
    else if (tag === 'table') {
      replacement = `\n| Header 1 | Header 2 |\n| :--- | :--- |\n| Row 1 | Data 1 |\n| Row 2 | Data 2 |\n\n`;
    }

    const nextVal = markdown.substring(0, start) + replacement + markdown.substring(end);
    setMarkdown(nextVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 50);
  }

  function downloadHtmlFile() {
    const rendered = renderMarkdownToHtml(markdown);
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Exported Document - Xenn for all</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
h1, h2, h3 { color: #111827; }
pre { background: #f3f4f6; padding: 14px; border-radius: 8px; overflow-x: auto; }
code { font-family: monospace; font-size: 0.9em; }
blockquote { border-left: 4px solid #6366f1; margin: 0; padding-left: 16px; color: #4b5563; font-style: italic; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th, td { border: 1px solid #e5e7eb; padding: 10px 14px; text-align: left; }
th { background: #f9fafb; font-weight: 600; }
</style>
</head>
<body>
${rendered}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `document-${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function printDocument() {
    window.print();
  }

  const renderedHtml = renderMarkdownToHtml(markdown);

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace markdownstudio-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="markdownstudio-title"
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
          <span className="tool-icon orange">
            <FileText size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Document tools')} <span>/</span> {t('MARKDOWN DOCUMENT STUDIO')}
              </span>
              <span className="hd-pill">LIVE PREVIEW</span>
            </div>
            <h2 id="markdownstudio-title">{t('Markdown Document Studio')}</h2>
            <p>
              {t('Write and preview rich formatted documents with GitHub-flavored Markdown. Export clean HTML or print directly to PDF.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Instant Preview · HTML & PDF')}
          </span>
        </div>

        {/* Toolbar */}
        <div className="md-toolbar-strip">
          <button type="button" onClick={() => insertFormatting('bold')} title="Bold" className="md-tool-btn">
            <Bold size={15} />
          </button>
          <button type="button" onClick={() => insertFormatting('italic')} title="Italic" className="md-tool-btn">
            <Italic size={15} />
          </button>
          <button type="button" onClick={() => insertFormatting('h1')} title="Heading 1" className="md-tool-btn">
            <Heading1 size={15} />
          </button>
          <button type="button" onClick={() => insertFormatting('h2')} title="Heading 2" className="md-tool-btn">
            <Heading2 size={15} />
          </button>
          <button type="button" onClick={() => insertFormatting('quote')} title="Quote" className="md-tool-btn">
            <Quote size={15} />
          </button>
          <button type="button" onClick={() => insertFormatting('list')} title="Bullet List" className="md-tool-btn">
            <List size={15} />
          </button>
          <button type="button" onClick={() => insertFormatting('code')} title="Code Block" className="md-tool-btn">
            <Code size={15} />
          </button>
          <button type="button" onClick={() => insertFormatting('table')} title="Insert Table" className="md-tool-btn">
            <Table size={15} />
          </button>

          <div className="md-tab-toggle ml-auto">
            <button
              type="button"
              className={`md-tab-btn ${activeTab === 'split' ? 'active' : ''}`}
              onClick={() => setActiveTab('split')}
            >
              {t('Split')}
            </button>
            <button
              type="button"
              className={`md-tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              {t('Editor')}
            </button>
            <button
              type="button"
              className={`md-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              {t('Preview')}
            </button>
          </div>
        </div>

        {/* Split Stage Area */}
        <div className={`markdown-panes-wrap mode-${activeTab}`}>
          {/* Editor Pane */}
          {(activeTab === 'split' || activeTab === 'edit') && (
            <div className="md-editor-pane">
              <textarea
                ref={textareaRef}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                className="md-textarea"
                placeholder="# Start writing markdown here..."
              />
            </div>
          )}

          {/* Rendered Live HTML Preview Pane */}
          {(activeTab === 'split' || activeTab === 'preview') && (
            <div className="md-preview-pane">
              <div
                className="md-rendered-content"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="markdown-bottom-bar">
          <button
            type="button"
            className="download-btn-green"
            onClick={downloadHtmlFile}
          >
            <Download size={15} />
            {t('Download Clean HTML')}
          </button>

          <button
            type="button"
            className="primary-action"
            onClick={printDocument}
          >
            <Printer size={15} />
            {t('Print / Save PDF')}
          </button>

          <button
            type="button"
            className="btn-change-file"
            style={{ width: 'auto', marginTop: 0 }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            {t('Open Markdown File')}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".md,.txt,.markdown"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                e.target.files[0].text().then((txt) => {
                  if (txt) setMarkdown(txt);
                });
              }
              e.target.value = '';
            }}
          />
        </div>
      </section>
    </div>
  );
}
