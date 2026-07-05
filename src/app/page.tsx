'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FileDown, Instagram, LayoutGrid, Sparkles } from 'lucide-react';
import CarouselCreator from '@/components/carousel/carousel-creator';
import CarouselEditor from '@/components/carousel/carousel-editor';
import CarouselList from '@/components/carousel/carousel-list';
import SheetsImport from '@/components/carousel/sheets-import';
import InstagramPanel from '@/components/carousel/instagram-panel';
import type { SlideData } from '@/components/carousel/slide-renderer';

type Tab = 'dashboard' | 'create' | 'import' | 'instagram';
type View = 'tabs' | 'editor';

interface SelectedCarousel {
  id: string;
  title: string;
  topic: string;
  slides: string;
  status: string;
  caption: string | null;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode; shortLabel: string }[] = [
  { id: 'dashboard', label: 'My Carousels', icon: <LayoutGrid className="w-4 h-4" />, shortLabel: 'Carousels' },
  { id: 'create', label: 'Create New', icon: <Plus className="w-4 h-4" />, shortLabel: 'Create' },
  { id: 'import', label: 'Import Sheets', icon: <FileDown className="w-4 h-4" />, shortLabel: 'Import' },
  { id: 'instagram', label: 'Instagram', icon: <Instagram className="w-4 h-4" />, shortLabel: 'Insta' },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [view, setView] = useState<View>('tabs');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingCarousel, setEditingCarousel] = useState<{
    id?: string;
    title: string;
    caption: string;
    slides: SlideData[];
  } | null>(null);
  const [selectedForSchedule, setSelectedForSchedule] = useState<{ id: string; title: string; caption: string | null; slides?: SlideData[] } | null>(null);

  const refresh = useCallback(() => setRefreshTrigger((n) => n + 1), []);

  const handleGenerated = (data: { title: string; caption: string; slides: SlideData[] }) => {
    setEditingCarousel({ title: data.title, caption: data.caption, slides: data.slides });
    setView('editor');
  };

  const handleEditCarousel = (carousel: SelectedCarousel) => {
    let slides: SlideData[] = [];
    try {
      slides = JSON.parse(carousel.slides);
    } catch { /* ignore */ }
    setEditingCarousel({
      id: carousel.id,
      title: carousel.title,
      caption: carousel.caption || '',
      slides,
    });
    setView('editor');
  };

  const handleSave = async (data: { title: string; caption: string; slides: SlideData[] }) => {
    const payload = {
      title: data.title,
      topic: data.title,
      slides: JSON.stringify(data.slides),
      caption: data.caption,
    };

    if (editingCarousel?.id) {
      await fetch(`/api/carousel/${editingCarousel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, status: 'ready' }),
      });
    } else {
      const res = await fetch('/api/carousels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setEditingCarousel((prev) => prev ? { ...prev, id: created.id } : null);
      }
    }
    refresh();
  };

  const handleBack = () => {
    setView('tabs');
    setTab('dashboard');
    setEditingCarousel(null);
    refresh();
  };

  const handleSchedule = (carousel: SelectedCarousel) => {
    let slides: SlideData[] = [];
    try { slides = JSON.parse(carousel.slides); } catch { /* ignore */ }
    setSelectedForSchedule({ id: carousel.id, title: carousel.title, caption: carousel.caption, slides });
    setTab('instagram');
    setView('tabs');
  };

  const handlePost = (carousel: SelectedCarousel) => {
    let slides: SlideData[] = [];
    try { slides = JSON.parse(carousel.slides); } catch { /* ignore */ }
    setSelectedForSchedule({ id: carousel.id, title: carousel.title, caption: carousel.caption, slides });
    setTab('instagram');
    setView('tabs');
  };

  // Editor view — smooth transition with fade-in
  if (view === 'editor' && editingCarousel) {
    return (
      <div className="h-screen flex flex-col bg-[#080808] animate-in fade-in duration-300">
        <CarouselEditor
          initialSlides={editingCarousel.slides}
          initialTitle={editingCarousel.title}
          initialCaption={editingCarousel.caption}
          carouselId={editingCarousel.id}
          onSave={handleSave}
          onBack={handleBack}
        />
      </div>
    );
  }

  // Main tabbed view
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-black font-bold text-sm tracking-tighter">C</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white tracking-tight leading-none">CarouselForge</h1>
              <p className="text-[9px] text-white/25 tracking-wider uppercase mt-0.5">AI Carousel Generator</p>
            </div>
          </div>

          {/* Desktop Tabs */}
          <nav className="hidden sm:flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs tracking-wide transition-all ${
                  tab === t.id
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/35 hover:text-white/60 hover:bg-white/[0.03]'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>

          {/* Quick Create Button */}
          <Button
            onClick={() => { setTab('create'); }}
            className="bg-white text-black hover:bg-white/90 text-xs gap-1.5 h-8 px-3 tracking-wide font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Carousel</span>
          </Button>
        </div>

        {/* Mobile Tabs */}
        <div className="sm:hidden flex border-t border-white/[0.04]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] tracking-wider uppercase transition-all ${
                tab === t.id ? 'text-white border-b-2 border-white' : 'text-white/25'
              }`}
            >
              {t.icon}
              {t.shortLabel}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">My Carousels</h2>
                <p className="text-xs text-white/30 mt-0.5">Manage, edit, schedule, and export your carousel content</p>
              </div>
            </div>
            <CarouselList
              onEdit={handleEditCarousel}
              onSchedule={handleSchedule}
              onPost={handlePost}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {tab === 'create' && (
          <CarouselCreator onGenerated={handleGenerated} />
        )}

        {tab === 'import' && (
          <SheetsImport onImported={() => { setTab('dashboard'); refresh(); }} />
        )}

        {tab === 'instagram' && (
          <InstagramPanel
            selectedCarousel={selectedForSchedule}
            onActionComplete={refresh}
          />
        )}
      </main>
    </div>
  );
}