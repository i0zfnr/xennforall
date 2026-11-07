import React, { useState, useEffect, useRef } from 'react';
import { Search, Star, ArrowRight, CornerDownLeft, X, Layers, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { t } from './i18n';

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: LucideIcon;
  color: string;
  tag?: string;
  formats?: string;
}

interface CommandPaletteProps<T extends ToolItem = ToolItem> {
  isOpen: boolean;
  onClose: () => void;
  tools: T[];
  onSelectTool: (tool: T) => void;
  favorites: string[];
  onToggleFavorite: (id: string, e?: React.MouseEvent) => void;
}

export function CommandPalette<T extends ToolItem = ToolItem>({
  isOpen,
  onClose,
  tools,
  onSelectTool,
  favorites,
  onToggleFavorite
}: CommandPaletteProps<T>) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedCategory('all');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter tools
  const filteredTools = tools.filter((tool) => {
    const q = query.trim().toLowerCase();
    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'favorites' && favorites.includes(tool.id)) ||
      (selectedCategory === 'pdf' && (tool.category === 'PDF tools' || tool.id.includes('pdf') || tool.id.includes('doc') || tool.id === 'markdown_studio')) ||
      (selectedCategory === 'image' && (tool.category === 'Image tools' && !['audio', 'reverb', 'eq', '8d', 'gate', 'cutter', 'recorder'].some(k => tool.id.includes(k)))) ||
      (selectedCategory === 'media' && ['audio', 'reverb', 'eq', '8d', 'gate', 'cutter', 'recorder', 'video', 'tiktok', 'livephoto', 'status_hd'].some(k => tool.id.includes(k))) ||
      (selectedCategory === 'dev' && ['json', 'base64', 'code', 'hash', 'encrypt', 'svg', 'qr'].some(k => tool.id.includes(k)));

    if (!matchesCategory) return false;
    if (!q) return true;

    const searchable = `${tool.name} ${tool.description} ${t(tool.name)} ${t(tool.description)} ${tool.formats || ''} ${tool.tag || ''}`.toLowerCase();
    return searchable.includes(q);
  });

  // Ensure active index is within bounds
  useEffect(() => {
    setActiveIndex(0);
  }, [query, selectedCategory]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (filteredTools.length > 0 ? (prev + 1) % filteredTools.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (filteredTools.length > 0 ? (prev - 1 + filteredTools.length) % filteredTools.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTools[activeIndex]) {
        onSelectTool(filteredTools[activeIndex]);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="cmd-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("Command Palette")}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Top Search Bar */}
        <div className="cmd-search-box">
          <Search size={18} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Type to search 54 tools, formats, or tasks…")}
            aria-label={t("Search tools")}
          />
          {query ? (
            <button className="cmd-clear-btn" onClick={() => setQuery('')} aria-label={t("Clear search")}>
              <X size={15} />
            </button>
          ) : (
            <kbd className="cmd-esc-badge">ESC</kbd>
          )}
        </div>

        {/* Quick Filter Categories */}
        <div className="cmd-filter-tabs">
          <button
            className={`cmd-tab ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            {t("All")} <span>{tools.length}</span>
          </button>
          {favorites.length > 0 && (
            <button
              className={`cmd-tab ${selectedCategory === 'favorites' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('favorites')}
            >
              <Star size={12} className="tab-star-icon" /> {t("Favorites")} <span>{favorites.length}</span>
            </button>
          )}
          <button
            className={`cmd-tab ${selectedCategory === 'pdf' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('pdf')}
          >
            {t("PDF & Docs")}
          </button>
          <button
            className={`cmd-tab ${selectedCategory === 'image' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('image')}
          >
            {t("Image")}
          </button>
          <button
            className={`cmd-tab ${selectedCategory === 'media' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('media')}
          >
            {t("Audio & Video")}
          </button>
          <button
            className={`cmd-tab ${selectedCategory === 'dev' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('dev')}
          >
            {t("Dev & Security")}
          </button>
        </div>

        {/* Results List */}
        <div className="cmd-list" ref={listRef}>
          {filteredTools.length > 0 ? (
            filteredTools.map((tool, index) => {
              const isFav = favorites.includes(tool.id);
              const isActive = index === activeIndex;
              const Icon = tool.icon;

              return (
                <div
                  key={tool.id}
                  data-index={index}
                  className={`cmd-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectTool(tool);
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className={`cmd-item-icon ${tool.color}`}>
                    <Icon size={18} strokeWidth={1.8} />
                  </span>

                  <div className="cmd-item-details">
                    <div className="cmd-item-header">
                      <strong className="cmd-item-name">{t(tool.name)}</strong>
                      {tool.tag && <span className="cmd-item-tag">{t(tool.tag)}</span>}
                      {tool.formats && <span className="cmd-item-format">{tool.formats}</span>}
                    </div>
                    <p className="cmd-item-desc">{t(tool.description)}</p>
                  </div>

                  <div className="cmd-item-actions">
                    <button
                      type="button"
                      className={`cmd-fav-btn ${isFav ? 'pinned' : ''}`}
                      title={isFav ? t("Unpin from favorites") : t("Pin to favorites")}
                      aria-label={isFav ? t("Unpin from favorites") : t("Pin to favorites")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(tool.id, e);
                      }}
                    >
                      <Star size={15} fill={isFav ? 'currentColor' : 'none'} />
                    </button>

                    <span className="cmd-item-enter">
                      <CornerDownLeft size={13} />
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="cmd-empty">
              <p>{t("No tools match your query.")}</p>
              <button
                className="cmd-empty-reset"
                onClick={() => {
                  setQuery('');
                  setSelectedCategory('all');
                }}
              >
                {t("Show all tools")}
              </button>
            </div>
          )}
        </div>

        {/* Palette Footer */}
        <div className="cmd-footer">
          <div className="cmd-shortcuts">
            <span><kbd>↑</kbd> <kbd>↓</kbd> {t("Navigate")}</span>
            <span><kbd>↵</kbd> {t("Open")}</span>
            <span><kbd>ESC</kbd> {t("Close")}</span>
          </div>
          <div className="cmd-footer-privacy">
            <ShieldCheck size={13} />
            <span>{t("100% Client-Side Local Execution")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
export default CommandPalette;
