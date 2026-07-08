'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Edit3, Calendar, Upload, Eye, Download } from 'lucide-react';
import SlideRenderer from './slide-renderer';
import type { SlideData } from './slide-renderer';

interface CarouselItem {
  id: string;
  title: string;
  topic: string;
  slides: string;
  status: string;
  caption: string | null;
  createdAt: string;
  scheduledPosts?: { id: string; scheduledTime: string | null; status: string }[];
}

interface CarouselListProps {
  onEdit: (carousel: CarouselItem) => void;
  onSchedule: (carousel: CarouselItem) => void;
  onPost: (carousel: CarouselItem) => void;
  refreshTrigger: number;
}

export default function CarouselList({ onEdit, onSchedule, onPost, refreshTrigger }: CarouselListProps) {
  const [carousels, setCarousels] = useState<CarouselItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCarousels = async () => {
    try {
      const res = await fetch('/api/carousels');
      if (res.ok) {
        const data = await res.json();
        setCarousels(data);
      }
    } catch (e) {
      console.error('Failed to fetch carousels:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCarousels(); }, [refreshTrigger]);

  const handleExport = async (id: string, title: string) => {
    try {
      const res = await fetch('/api/carousel/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carouselId: id }),
      });
      if (!res.ok) { alert('Export failed'); return; }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this carousel? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await fetch(`/api/carousel/${id}`, { method: 'DELETE' });
      setCarousels((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeleting(null);
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-white/10 text-white/50',
    ready: 'bg-emerald-500/15 text-emerald-400',
    scheduled: 'bg-amber-500/15 text-amber-400',
    posted: 'bg-blue-500/15 text-blue-400',
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <Skeleton className="h-48 w-full bg-white/5" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4 bg-white/5" />
              <Skeleton className="h-3 w-1/2 bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (carousels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <Upload className="w-6 h-6 text-white/20" />
        </div>
        <p className="text-white/30 text-sm">No carousels yet</p>
        <p className="text-white/15 text-xs mt-1">Create your first carousel to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
      {carousels.map((carousel) => {
        let slides: SlideData[] = [];
        try {
          slides = JSON.parse(carousel.slides);
        } catch { /* ignore */ }
        const coverSlide = slides[0];
        const date = new Date(carousel.createdAt).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        });

        return (
          <div
            key={carousel.id}
            className="group rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden hover:border-white/10 hover:bg-white/[0.03] transition-all"
          >
            {/* Thumbnail */}
            <div className="relative overflow-hidden bg-black" style={{ aspectRatio: '1080/1350' }}>
              {coverSlide ? (
                <div style={{ width: 1080, height: 1350, transform: `scale(${320 / 1080})`, transformOrigin: 'top left' }}>
                  <SlideRenderer slide={coverSlide} />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/10 text-xs">No preview</div>
              )}
              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onEdit(carousel)}
                  className="bg-white text-black hover:bg-white/90 text-xs h-8 gap-1.5"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSchedule(carousel)}
                  className="border-white/30 text-white hover:bg-white/10 text-xs h-8 gap-1.5"
                >
                  <Calendar className="w-3 h-3" /> Schedule
                </Button>
              </div>
              {/* Slide count badge */}
              <div className="absolute top-2 right-2 bg-black/70 text-white/50 text-[10px] font-mono px-1.5 py-0.5 rounded">
                {slides.length} slides
              </div>
            </div>

            {/* Info */}
            <div className="p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white/90 tracking-tight leading-tight line-clamp-1">
                  {carousel.title}
                </h3>
                <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[carousel.status] || statusColors.draft}`}>
                  {carousel.status}
                </span>
              </div>
              <p className="text-[11px] text-white/30 leading-relaxed line-clamp-2">{carousel.topic}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-white/20 font-mono">{date}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleExport(carousel.id, carousel.title)}
                    className="p-1.5 rounded-md text-white/20 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                    title="Export JSON"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onPost(carousel)}
                    className="p-1.5 rounded-md text-white/20 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    title="Post now"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(carousel.id)}
                    disabled={deleting === carousel.id}
                    className="p-1.5 rounded-md text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}