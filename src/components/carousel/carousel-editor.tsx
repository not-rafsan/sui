'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, Save, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Edit3, Pencil, ArrowLeft, Trash2, Plus } from 'lucide-react';
import type { SlideData } from './slide-renderer';
import SlideRenderer from './slide-renderer';

interface CarouselEditorProps {
  initialSlides: SlideData[];
  initialTitle: string;
  initialCaption: string;
  carouselId?: string;
  onSave: (data: { title: string; caption: string; slides: SlideData[] }) => Promise<void>;
  onBack: () => void;
}

export default function CarouselEditor({
  initialSlides,
  initialTitle,
  initialCaption,
  carouselId,
  onSave,
  onBack,
}: CarouselEditorProps) {
  const [slides, setSlides] = useState<SlideData[]>(initialSlides);
  const [title, setTitle] = useState(initialTitle);
  const [caption, setCaption] = useState(initialCaption);
  const [editMode, setEditMode] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [zoom, setZoom] = useState(0.38);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleEdit = useCallback((path: string, value: string) => {
    const parts = path.split('.');
    if (parts[0] === 'slides' && parts.length >= 3) {
      const slideIdx = parseInt(parts[1], 10);
      const field = parts[2];
      setSlides((prev) => {
        const updated = [...prev];
        const slide = { ...updated[slideIdx] };
        if (field === 'bulletPoints') {
          try { (slide as any).bulletPoints = JSON.parse(value); } catch { /* ignore */ }
        } else if (field === 'chapterNumber') {
          (slide as any).chapterNumber = parseInt(value, 10) || 1;
        } else {
          (slide as any)[field] = value;
        }
        updated[slideIdx] = slide;
        return updated;
      });
    }
  }, []);

  const handleAddSlide = () => {
    const lastContent = [...slides].reverse().find((s) => s.type === 'content');
    const newSlide: SlideData = {
      type: 'content',
      chapterNumber: (lastContent?.type === 'content' ? lastContent.chapterNumber + 1 : slides.length),
      title: 'NEW CHAPTER',
      subtitle: '',
      bulletPoints: ['Key point 1', 'Key point 2', 'Key point 3'],
      earningPotential: '',
    };
    const ctaIdx = slides.findIndex((s) => s.type === 'cta');
    if (ctaIdx > -1) {
      setSlides((prev) => [...prev.slice(0, ctaIdx), newSlide, ...prev.slice(ctaIdx)]);
      setCurrentSlide(ctaIdx);
    } else {
      setSlides((prev) => [...prev, newSlide]);
      setCurrentSlide(slides.length);
    }
  };

  const handleRemoveSlide = (idx: number) => {
    if (slides.length <= 3) return;
    const slide = slides[idx];
    if (slide.type === 'cover' || slide.type === 'cta') return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    if (currentSlide >= slides.length - 1) setCurrentSlide(Math.max(0, slides.length - 2));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try { await onSave({ title, caption, slides }); } finally { setIsSaving(false); }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      for (let i = 0; i < slides.length; i++) {
        setExportProgress(`Exporting slide ${i + 1} of ${slides.length}...`);
        const ref = slideRefs.current[i];
        if (!ref) continue;
        try {
          const dataUrl = await toPng(ref, {
            width: 1080, height: 1350, pixelRatio: 2, cacheBust: true,
            style: { transform: 'none', transformOrigin: 'top left' },
          });
          const link = document.createElement('a');
          link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_slide_${i + 1}.png`;
          link.href = dataUrl;
          link.click();
        } catch (e) { console.error(`Export slide ${i + 1} failed:`, e); }
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally { setIsExporting(false); setExportProgress(''); }
  };

  const handleExportCurrent = async () => {
    const ref = slideRefs.current[currentSlide];
    if (!ref) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(ref, {
        width: 1080, height: 1350, pixelRatio: 2, cacheBust: true,
        style: { transform: 'none', transformOrigin: 'top left' },
      });
      const link = document.createElement('a');
      link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_slide_${currentSlide + 1}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) { console.error('Export failed:', e); }
  };

  /* ─── PREVIEW MODE: beautiful vertical scroll of all slides ─── */
  if (!editMode) {
    return (
      <div className="min-h-screen bg-[#080808]">
        {/* Top bar */}
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-sm font-semibold text-white tracking-tight leading-none">{title}</h1>
                <p className="text-[10px] text-white/30 mt-0.5">{slides.length} slides</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditMode(true)} className="text-white/50 hover:text-white/80 h-8 text-xs gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportCurrent} className="text-white/50 hover:text-white/80 h-8 text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export Current
              </Button>
              <Button size="sm" onClick={handleExportAll} disabled={isExporting} className="bg-white text-black hover:bg-white/90 text-xs gap-1.5 h-8 px-3">
                {isExporting ? <span className="flex items-center gap-1.5"><div className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />{exportProgress}</span> : <><Download className="w-3.5 h-3.5" /> Export All PNG</>}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-white text-black hover:bg-white/90 text-xs gap-1.5 h-8 px-3">
                {isSaving ? <div className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {carouselId ? 'Update' : 'Save'}
              </Button>
            </div>
          </div>
        </header>

        {/* Slides — vertical scroll, centered */}
        <main className="flex flex-col items-center gap-6 py-10 px-4 pb-20">
          {slides.map((slide, i) => (
            <div
              key={i}
              ref={(el) => { slideRefs.current[i] = el; }}
              className="cursor-pointer"
              onClick={() => setCurrentSlide(i)}
            >
              <SlideRenderer
                slide={slide}
                index={i}
                totalSlides={slides.length}
                scale={0.5}
              />
            </div>
          ))}
        </main>
      </div>
    );
  }

  /* ─── EDIT MODE: 3-panel editor ─── */
  return (
    <div className="h-screen flex flex-col bg-[#080808]">
      {/* Edit mode top bar */}
      <header className="h-10 border-b border-white/[0.06] bg-black/60 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setEditMode(false)} className="p-1 rounded text-white/40 hover:text-white/70 hover:bg-white/5 text-xs flex items-center gap-1 transition-all">
            <ArrowLeft className="w-3.5 h-3.5" /> Preview
          </button>
        </div>
        <span className="text-[10px] text-white/25 tracking-widest uppercase">Edit Mode — click any text to edit</span>
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-white text-black hover:bg-white/90 text-[10px] gap-1.5 h-7 px-3">
          {isSaving ? <div className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
          {carouselId ? 'Update' : 'Save'}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Thumbnail strip */}
        <div className="w-40 border-r border-white/8 flex flex-col bg-black/40 p-1.5 gap-1 overflow-y-auto flex-shrink-0">
          <p className="text-[9px] text-white/25 tracking-widest uppercase px-1 mb-0.5">Slides</p>
          {slides.map((slide, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => setCurrentSlide(i)}
              onKeyDown={(e) => e.key === 'Enter' && setCurrentSlide(i)}
              className={`relative rounded overflow-hidden flex-shrink-0 transition-all cursor-pointer ${
                i === currentSlide ? 'ring-1 ring-white/40' : 'ring-1 ring-white/5 hover:ring-white/15'
              }`}
              style={{ width: '100%', aspectRatio: '1080/1350' }}
            >
              <div style={{ width: 1080, height: 1350, transform: `scale(${136 / 1080})`, transformOrigin: 'top left' }}>
                <SlideRenderer slide={slide} index={i} totalSlides={slides.length} />
              </div>
              <div className="absolute bottom-0.5 left-0.5 text-[7px] text-white/25 bg-black/70 px-1 rounded font-mono">
                {String(i + 1).padStart(2, '0')}
              </div>
              {slide.type !== 'cover' && slide.type !== 'cta' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveSlide(i); }}
                  className="absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center text-white/25 hover:text-red-400 bg-black/70 rounded-full text-[9px] transition-colors"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
          <div
            role="button" tabIndex={0} onClick={handleAddSlide}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSlide()}
            className="flex-shrink-0 rounded border border-dashed border-white/8 hover:border-white/20 text-white/15 hover:text-white/40 flex items-center justify-center text-[10px] tracking-wider uppercase transition-all cursor-pointer"
            style={{ width: '100%', aspectRatio: '1080/1350' }}
          >
            <Plus className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Center: Slide Preview */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] p-4 overflow-auto relative">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setCurrentSlide((c) => Math.max(0, c - 1))} disabled={currentSlide === 0} className="p-1 rounded-full bg-white/5 text-white/25 hover:bg-white/10 disabled:opacity-15 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-white/30 text-[10px] font-mono tracking-wider min-w-[60px] text-center">
              {String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
            </span>
            <button onClick={() => setCurrentSlide((c) => Math.min(slides.length - 1, c + 1))} disabled={currentSlide === slides.length - 1} className="p-1 rounded-full bg-white/5 text-white/25 hover:bg-white/10 disabled:opacity-15 transition-all">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div ref={(el) => { slideRefs.current[currentSlide] = el; }}>
            <SlideRenderer
              slide={slides[currentSlide]}
              index={currentSlide}
              totalSlides={slides.length}
              editable={true}
              onEdit={handleEdit}
              scale={zoom}
            />
          </div>

          <div className="flex items-center gap-1.5 mt-3">
            <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.05))} className="p-1 rounded text-white/25 hover:text-white/50 transition-all"><ZoomOut className="w-3.5 h-3.5" /></button>
            <span className="text-white/15 text-[9px] font-mono w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(0.65, z + 0.05))} className="p-1 rounded text-white/25 hover:text-white/50 transition-all"><ZoomIn className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Right: Settings */}
        <div className="w-64 border-l border-white/8 bg-black/40 flex flex-col overflow-y-auto flex-shrink-0">
          <div className="p-3.5 space-y-4 flex-1">
            <div className="space-y-1">
              <label className="text-[9px] text-white/25 tracking-widest uppercase">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/20 transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-white/25 tracking-widest uppercase">Caption</label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} className="bg-white/5 border-white/10 text-white text-[11px] resize-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-white/25 tracking-widest uppercase">Current Slide</label>
              <div className="p-2 rounded bg-white/[0.03] border border-white/5 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[9px] text-white/20 uppercase">Type</span>
                  <span className="text-[10px] text-white/50 capitalize">{slides[currentSlide].type}</span>
                </div>
                {slides[currentSlide].type === 'content' && (
                  <div className="flex justify-between">
                    <span className="text-[9px] text-white/20 uppercase">Chapter</span>
                    <span className="text-[10px] text-white/50 font-mono">{String((slides[currentSlide] as any).chapterNumber).padStart(2, '0')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-3.5 border-t border-white/8 space-y-2">
            <Button variant="outline" size="sm" onClick={handleExportCurrent} className="w-full border-white/10 text-white/50 hover:bg-white/5 text-[10px] gap-1.5 h-8">
              <Download className="w-3 h-3" /> Export This Slide
            </Button>
            <Button size="sm" onClick={handleExportAll} disabled={isExporting} className="w-full bg-white text-black hover:bg-white/90 text-[10px] gap-1.5 h-8">
              {isExporting ? <span className="flex items-center gap-1.5"><div className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />{exportProgress}</span> : <><Download className="w-3 h-3" /> Export All PNG</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}