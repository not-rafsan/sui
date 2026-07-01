'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import type { SlideData } from './slide-renderer';

interface CarouselCreatorProps {
  onGenerated: (data: { title: string; caption: string; slides: SlideData[] }) => void;
}

const SUGGESTED_TOPICS = [
  'AI-Powered Dropshipping',
  'AI Content Creation Agency',
  'AI Chatbot Business',
  'AI Faceless YouTube Channel',
  'AI Print on Demand',
  'AI Social Media Management',
  'AI Email Marketing Agency',
  'AI Copywriting Services',
];

export default function CarouselCreator({ onGenerated }: CarouselCreatorProps) {
  const [topic, setTopic] = useState('');
  const [chapterCount, setChapterCount] = useState(5);
  const [isResearching, setIsResearching] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsResearching(true);
    setError('');
    setProgress('Initiating deep AI research...');

    try {
      setProgress('Analyzing trends and gathering business intelligence...');

      const res = await fetch('/api/carousel/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), chapterCount }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Research failed');
      }

      setProgress('Structuring carousel content...');
      const data = await res.json();

      setProgress('Finalizing your carousel...');
      await new Promise((r) => setTimeout(r, 500));

      onGenerated({
        title: data.title,
        caption: data.caption,
        slides: data.slides,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate carousel';
      setError(message);
    } finally {
      setIsResearching(false);
      setProgress('');
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs tracking-widest uppercase text-white/50">
          <Sparkles className="w-3.5 h-3.5" />
          AI-Powered Research
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">
          Generate Viral Carousels
        </h2>
        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
          Enter a business topic and our AI will research, structure, and generate
          a high-quality carousel ready for your 3M+ follower page.
        </p>
      </div>

      {/* Input Section */}
      <div className="max-w-xl mx-auto space-y-6">
        <div className="space-y-2">
          <Label className="text-white/60 text-xs tracking-wider uppercase">Business Topic</Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. AI-Powered Dropshipping Business"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && !isResearching && handleGenerate()}
          />
        </div>

        {/* Chapter Count Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-white/60 text-xs tracking-wider uppercase">Chapters</Label>
            <span className="text-white font-mono text-sm font-medium">{chapterCount}</span>
          </div>
          <Slider
            value={[chapterCount]}
            onValueChange={([v]) => setChapterCount(v)}
            min={4}
            max={7}
            step={1}
            className="py-2"
          />
          <div className="flex justify-between text-[10px] text-white/25 tracking-wider uppercase">
            <span>4 Chapters</span>
            <span>7 Chapters</span>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={!topic.trim() || isResearching}
          className="w-full h-12 bg-white text-black font-semibold tracking-wide hover:bg-white/90 transition-all text-sm"
        >
          {isResearching ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {progress}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Research & Generate
            </span>
          )}
        </Button>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {error}
          </div>
        )}
      </div>

      {/* Suggested Topics */}
      <div className="max-w-xl mx-auto">
        <p className="text-white/30 text-[10px] tracking-widest uppercase mb-3">Suggested Topics</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className="px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-white/50 text-xs hover:bg-white/[0.08] hover:text-white/70 hover:border-white/15 transition-all tracking-wide"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}