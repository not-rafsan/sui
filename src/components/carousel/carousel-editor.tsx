'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Download, Save, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Edit3, Eye } from 'lucide-react';
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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [zoom, setZoom] = useState(0.38);
  const [isEditing, setIsEditing] = useState(true);
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
          try {
            (slide as any).bulletPoints = JSON.parse(value);
          } catch {
            /* ignore parse errors */
          }
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
      subtitle: 'Add your description here',
      bulletPoints: ['Key point 1', 'Key point 2', 'Key point 3'],
      earningPotential: '$X,XXX/mo',
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

  const handleMoveSlide = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 1 || newIdx >= slides.length - 1) return;
    setSlides((prev) => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
    if (currentSlide === idx) setCurrentSlide(newIdx);
    else if (currentSlide === newIdx) setCurrentSlide(idx);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ title, caption, slides });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        setExportProgress(`Exporting slide ${i + 1} of ${slides.length}...`);
        const ref = slideRefs.current[i];
        if (!ref) continue;
        try {
          const { toPng } = await import('html-to-image');
          const dataUrl = await toPng(ref, {
            width: 1080,
            height: 1350,
            pixelRatio: 2,
            cacheBust: true,
            style: { transform: 'none', transformOrigin: 'top left' },
          });
          const link = document.createElement('a');
          link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_slide_${i + 1}.png`;
          link.href = dataUrl;
          link.click();
        } catch (e) {
          console.error(`Failed to export slide ${i + 1}:`, e);
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  const handleExportCurrent = async () => {
    const ref = slideRefs.current[currentSlide];
    if (!ref) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(ref, {
        width: 1080,
        height: 1350,
        pixelRatio: 2,
        cacheBust: true,
        style: { transform: 'none', transformOrigin: 'top left' },
      });
      const link = document.createElement('a');
      link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_slide_${currentSlide + 1}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Thumbnail strip */}
      <div className="w-48 border-r border-white/8 flex flex-col bg-black/40 p-2 gap-1.5 overflow-y-auto">
        <p className="text-[10px] text-white/30 tracking-widest uppercase px-1 mb-1">Slides</p>
        {slides.map((slide, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => setCurrentSlide(i)}
            onKeyDown={(e) => e.key === 'Enter' && setCurrentSlide(i)}
            className={`relative rounded-md overflow-hidden flex-shrink-0 transition-all cursor-pointer ${
              i === currentSlide ? 'ring-1 ring-white/40' : 'ring-1 ring-white/5 hover:ring-white/15'
            }`}
            style={{ width: '100%', aspectRatio: '1080/1350' }}
          >
            <div style={{ width: 1080, height: 1350, transform: `scale(${164 / 1080})`, transformOrigin: 'top left' }}>
              <SlideRenderer slide={slide} index={i} totalSlides={slides.length} />
            </div>
            <div className="absolute bottom-0.5 left-0.5 text-[8px] text-white/30 bg-black/60 px-1 rounded font-mono">
              {String(i + 1).padStart(2, '0')}
            </div>
            {slide.type === 'cover' || slide.type === 'cta' ? null : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveSlide(i);
                }}
                className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-white/30 hover:text-red-400 bg-black/60 rounded-full text-[10px]"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddSlide}
          className="flex-shrink-0 rounded-md border border-dashed border-white/10 hover:border-white/25 text-white/20 hover:text-white/50 flex items-center justify-center text-xs tracking-wider uppercase transition-all py-2"
          style={{ width: '100%', aspectRatio: '1080/1350' }}
        >
          + Add
        </button>
      </div>

      {/* Center: Slide Preview */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] p-6 overflow-auto relative">
        {/* Top toolbar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-white/40 hover:text-white/70 h-8 text-xs gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-1.5 rounded-md text-xs transition-all ${isEditing ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
              title={isEditing ? 'Editing ON (click to disable)' : 'Editing OFF (click to enable)'}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.06))} className="p-1.5 rounded-md text-white/30 hover:text-white/60 transition-all">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-white/20 text-[10px] font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(0.7, z + 0.06))} className="p-1.5 rounded-md text-white/30 hover:text-white/60 transition-all">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Slide navigation */}
        <div className="flex items-center gap-3 mb-4 mt-8">
          <button
            onClick={() => setCurrentSlide((c) => Math.max(0, c - 1))}
            disabled={currentSlide === 0}
            className="p-1.5 rounded-full bg-white/5 text-white/30 hover:bg-white/10 disabled:opacity-20 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white/40 text-xs font-mono tracking-wider">
            {String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </span>
          <button
            onClick={() => setCurrentSlide((c) => Math.min(slides.length - 1, c + 1))}
            disabled={currentSlide === slides.length - 1}
            className="p-1.5 rounded-full bg-white/5 text-white/30 hover:bg-white/10 disabled:opacity-20 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Render */}
        <div
          ref={(el) => { slideRefs.current[currentSlide] = el; }}
        >
          <SlideRenderer
            slide={slides[currentSlide]}
            index={currentSlide}
            totalSlides={slides.length}
            editable={isEditing}
            onEdit={handleEdit}
            scale={zoom}
          />
        </div>

        {/* Bottom actions */}
        <div className="flex items-center gap-2 mt-4">
          {slides[currentSlide].type === 'content' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveSlide(currentSlide, -1)}
                disabled={currentSlide <= 0}
                className="text-white/30 hover:text-white/60 h-8 text-xs"
              >
                ← Move Left
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveSlide(currentSlide, 1)}
                disabled={currentSlide >= slides.length - 1}
                className="text-white/30 hover:text-white/60 h-8 text-xs"
              >
                Move Right →
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Right: Settings Panel */}
      <div className="w-72 border-l border-white/8 bg-black/40 flex flex-col overflow-y-auto">
        <div className="p-4 space-y-5 flex-1">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 tracking-widest uppercase">Carousel Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Caption */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 tracking-widest uppercase">Instagram Caption</label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xs resize-none"
            />
          </div>

          {/* Current Slide Info */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 tracking-widest uppercase">Current Slide</label>
            <div className="p-3 rounded-md bg-white/[0.03] border border-white/5 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/20 uppercase tracking-wider">Type:</span>
                <span className="text-xs text-white/60 font-medium capitalize">{slides[currentSlide].type}</span>
              </div>
              {slides[currentSlide].type === 'content' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/20 uppercase tracking-wider">Chapter:</span>
                  <span className="text-xs text-white/60 font-mono">{String((slides[currentSlide] as any).chapterNumber).padStart(2, '0')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Zoom */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/30 tracking-widest uppercase">Preview Zoom</label>
            <Slider
              value={[zoom * 100]}
              onValueChange={([v]) => setZoom(v / 100)}
              min={20}
              max={70}
              step={5}
            />
          </div>

          {/* Export section */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/30 tracking-widest uppercase">Export</label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCurrent}
              className="w-full border-white/10 text-white/60 hover:bg-white/5 text-xs gap-2 h-9"
            >
              <Eye className="w-3.5 h-3.5" />
              Export Current Slide
            </Button>
            <Button
              size="sm"
              onClick={handleExportAll}
              disabled={isExporting}
              className="w-full bg-white text-black hover:bg-white/90 text-xs gap-2 h-9"
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />
                  {exportProgress}
                </span>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Export All as PNG
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Bottom: Save */}
        <div className="p-4 border-t border-white/8">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-white text-black hover:bg-white/90 font-semibold text-xs tracking-wider h-10 gap-2"
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {carouselId ? 'Update Carousel' : 'Save Carousel'}
          </Button>
        </div>
      </div>
    </div>
  );
}