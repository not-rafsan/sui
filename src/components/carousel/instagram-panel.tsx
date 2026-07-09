'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Instagram, Link2, Unlink, Calendar, Send, CheckCircle2, AlertCircle, Loader2, ExternalLink, RefreshCw, Music, Search, X, TrendingUp, Play, Disc3 } from 'lucide-react';
import SlideRenderer, { type SlideData } from '@/components/carousel/slide-renderer';

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  display_name: string;
  genre?: string;
  vibe?: string;
  cover_url?: string | null;
  duration_ms?: number;
}

interface InstagramPanelProps {
  selectedCarousel: { id: string; title: string; caption: string | null; slides?: SlideData[] } | null;
  onActionComplete: () => void;
}

const TRENDING_QUERIES = [
  'Phonk', 'Lo-fi', 'Motivational', 'Cinematic',
  'Trap', 'Synthwave', 'Aesthetic', 'EDM',
  'Hip Hop', 'Chill',
];

export default function InstagramPanel({ selectedCarousel, onActionComplete }: InstagramPanelProps) {
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postProgress, setPostProgress] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleCaption, setScheduleCaption] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  const [formUsername, setFormUsername] = useState('');
  const [formToken, setFormToken] = useState('');
  const [formUserId, setFormUserId] = useState('');
  const [isRegeneratingCaption, setIsRegeneratingCaption] = useState(false);

  // Music state
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [musicResults, setMusicResults] = useState<MusicTrack[]>([]);
  const [isSearchingMusic, setIsSearchingMusic] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const musicSearchTimer = useRef<NodeJS.Timeout | null>(null);

  // Off-screen container for rendering slides to images
  const offscreenRef = useRef<HTMLDivElement>(null);

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/instagram/connect');
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        if (data.connected) setUsername(data.username);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { checkConnection(); }, []);

  // Music search with debounce
  const searchMusic = useCallback(async (query: string) => {
    if (!query.trim()) { setMusicResults([]); return; }
    setIsSearchingMusic(true);
    try {
      const res = await fetch(`/api/instagram/music/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setMusicResults(data.tracks || []);
    } catch { setMusicResults([]); }
    setIsSearchingMusic(false);
  }, []);

  const handleMusicSearchChange = (value: string) => {
    setMusicSearchQuery(value);
    if (musicSearchTimer.current) clearTimeout(musicSearchTimer.current);
    musicSearchTimer.current = setTimeout(() => searchMusic(value), 500);
  };

  const handleTrendingClick = (query: string) => {
    setMusicSearchQuery(query);
    searchMusic(query);
  };

  const handleSelectTrack = (track: MusicTrack) => {
    setSelectedTrack(track);
    setShowMusicPicker(false);
    setMusicResults([]);
    setMusicSearchQuery('');
  };

  const handleRemoveMusic = () => {
    setSelectedTrack(null);
  };

  // Generate PNG images from slides using html-to-image
  const generateSlideImages = useCallback(async (slides: SlideData[]): Promise<string[]> => {
    const { toPng } = await import('html-to-image');

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.zIndex = '-1';
    document.body.appendChild(container);

    const images: string[] = [];

    try {
      for (let i = 0; i < slides.length; i++) {
        setPostProgress(`Generating image ${i + 1} of ${slides.length}...`);

        const wrapper = document.createElement('div');
        container.appendChild(wrapper);

        const ReactDOM = await import('react-dom/client');
        const root = ReactDOM.createRoot(wrapper);
        await new Promise<void>((resolve) => {
          root.render(
            React.createElement(SlideRenderer, {
              slide: slides[i],
              width: 1080,
              height: 1350,
            })
          );
          setTimeout(resolve, 300);
        });

        const dataUrl = await toPng(wrapper.firstElementChild as HTMLElement || wrapper, {
          width: 1080,
          height: 1350,
          pixelRatio: 1,
          cacheBust: true,
          style: { transform: 'none', transformOrigin: 'top left' },
        });

        images.push(dataUrl);
        root.unmount();
        container.removeChild(wrapper);
      }
    } finally {
      document.body.removeChild(container);
    }

    return images;
  }, []);

  const handleConnect = async () => {
    if (!formUsername || !formToken || !formUserId) return;
    setIsConnecting(true);
    try {
      const res = await fetch('/api/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername.replace('@', ''),
          accessToken: formToken,
          instagramUserId: formUserId,
        }),
      });
      if (res.ok) {
        setConnected(true);
        setUsername(formUsername.replace('@', ''));
        setConnectDialogOpen(false);
      }
    } catch { /* ignore */ }
    setIsConnecting(false);
  };

  const handleRegenerateCaption = async () => {
    if (!selectedCarousel?.slides?.length) return;
    setIsRegeneratingCaption(true);
    try {
      const res = await fetch('/api/caption/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: selectedCarousel.title, slides: selectedCarousel.slides }),
      });
      if (!res.ok) throw new Error('Failed to regenerate');
      const data = await res.json();
      if (data.caption) setScheduleCaption(data.caption);
    } catch { /* keep current caption */ }
    setIsRegeneratingCaption(false);
  };

  const handleDisconnect = async () => {
    setConnected(false);
    setUsername('');
  };

  const handleSchedule = async () => {
    if (!selectedCarousel || !scheduleTime) return;

    const slides = selectedCarousel.slides;
    if (!slides || slides.length === 0) {
      setResult({
        success: false,
        message: 'No slides found. Open the carousel in the editor first, then come back.',
      });
      return;
    }

    setIsScheduling(true);
    setPostProgress('Generating slide images for schedule...');
    setResult(null);

    try {
      // Pre-render slides to PNGs (same as Post Now)
      const images = await generateSlideImages(slides);
      setPostProgress('Saving scheduled post...');

      const musicInfo = selectedTrack ? { music_asset_id: selectedTrack.id, music_start_time_in_ms: 0 } : null;

      const res = await fetch('/api/instagram/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId: selectedCarousel.id,
          // Force interpret as Dhaka time (UTC+6) to avoid browser timezone ambiguity
          scheduledTime: new Date(scheduleTime + '+06:00').toISOString(),
          caption: scheduleCaption || selectedCarousel.caption || '',
          images,
          music: musicInfo,
        }),
      });
      const data = await res.json();
      setPostProgress('');
      if (res.ok && scheduleTime) {
        // Show the exact time the user picked, formatted nicely
        const [datePart, timePart] = scheduleTime.split('T');
        const [h, m] = timePart.split(':');
        const hr = parseInt(h);
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
        const dateObj = new Date(datePart + 'T00:00:00+06:00');
        const month = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Dhaka', month: 'short', day: 'numeric' });
        setResult({ success: true, message: `Scheduled for ${month} at ${hr12}:${m} ${ampm} (Dhaka time)` });
      } else {
        setResult({ success: res.ok, message: res.ok ? data.message : data.error });
      }
      if (res.ok) onActionComplete();
    } catch {
      setPostProgress('');
      setResult({ success: false, message: 'Network error' });
    }
    setIsScheduling(false);
  };

  const handlePostNow = async () => {
    if (!selectedCarousel) return;

    const slides = selectedCarousel.slides;
    if (!slides || slides.length === 0) {
      setResult({
        success: false,
        message: 'No slides found. The carousel data could not be loaded. Try opening the carousel in the editor first, then come back.',
      });
      return;
    }

    const musicInfo = selectedTrack ? { music_asset_id: selectedTrack.id, music_start_time_in_ms: 0 } : null;
    if (!confirm(`Post "${selectedCarousel.title}" to @${username} now?${musicInfo ? ` With music: ${selectedTrack.title}` : ''} This will upload ${slides.length} slides.`)) return;

    setIsPosting(true);
    setPostProgress('Generating slide images...');
    setResult(null);

    try {
      const images = await generateSlideImages(slides);
      setPostProgress('Sending to queue...');

      const res = await fetch('/api/instagram/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId: selectedCarousel.id,
          caption: scheduleCaption || selectedCarousel.caption || '',
          images,
          music: musicInfo,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPostProgress('');
        setResult({ success: false, message: data.error || 'Failed to post.' });
        setIsPosting(false);
        return;
      }

      // If the response already has the result (Render inline mode), show it directly
      if (data.status === 'done' || (data.success && data.url)) {
        setPostProgress('');
        setResult({ success: true, message: data.message + (data.url ? `\n\nView: ${data.url}` : '') });
        onActionComplete();
      } else if (data.jobId) {
        // Local dev mode: poll for result
        const jobId = data.jobId;
        setPostProgress('Uploading to Instagram (this takes 30-60s)...');

        const pollResult = await new Promise<{ success: boolean; message: string }>((resolve) => {
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts++;
            try {
              const statusRes = await fetch(`/api/instagram/post?jobId=${jobId}`);
              const statusData = await statusRes.json();

              if (statusData.status === 'done' || statusData.success) {
                clearInterval(interval);
                resolve({ success: true, message: statusData.message + (statusData.url ? `\n\nView: ${statusData.url}` : '') });
              } else if (statusData.status === 'error' || statusData.success === false) {
                clearInterval(interval);
                resolve({ success: false, message: statusData.message || 'Posting failed.' });
              } else if (attempts > 90) {
                clearInterval(interval);
                resolve({ success: false, message: 'Posting timed out. Check your Instagram account manually.' });
              }
            } catch { /* keep polling */ }
          }, 3000);
        });

        setPostProgress('');
        setResult(pollResult);
        if (pollResult.success) onActionComplete();
      } else {
        setPostProgress('');
        setResult({ success: false, message: 'Unexpected response from server.' });
      }

    } catch (err) {
      setPostProgress('');
      setResult({ success: false, message: err instanceof Error ? err.message : 'An unexpected error occurred.' });
    }

    setIsPosting(false);
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold text-white tracking-tight">Instagram Integration</h2>
        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
          Connect your Instagram account to post carousels directly.
        </p>
      </div>

      {/* Connection Status */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${connected ? 'bg-emerald-500/15' : 'bg-white/5'}`}>
              <Instagram className={`w-5 h-5 ${connected ? 'text-emerald-400' : 'text-white/30'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">
                {connected ? `@${username}` : 'Not Connected'}
              </p>
              <p className="text-[11px] text-white/30">
                {connected ? 'Instagram Business account linked' : 'Connect to enable posting'}
              </p>
            </div>
          </div>
          {connected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 text-xs gap-1.5 h-8"
            >
              <Unlink className="w-3 h-3" /> Disconnect
            </Button>
          ) : (
            <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-white text-black hover:bg-white/90 text-xs gap-1.5 h-8">
                  <Link2 className="w-3 h-3" /> Connect
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white">Connect Instagram</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-white/50 text-xs">Username</Label>
                    <Input value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="@yourbrand" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/50 text-xs">Access Token</Label>
                    <Input value={formToken} onChange={(e) => setFormToken(e.target.value)} placeholder="EAA..." type="password" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/50 text-xs">Instagram User ID</Label>
                    <Input value={formUserId} onChange={(e) => setFormUserId(e.target.value)} placeholder="17841400..." className="bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                  </div>
                  <Button onClick={handleConnect} disabled={!formUsername || !formToken || !formUserId || isConnecting} className="w-full bg-white text-black hover:bg-white/90 text-xs h-9">
                    {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
                    Connect Account
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Schedule / Post Section */}
      {selectedCarousel && connected && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white/30" />
            <p className="text-sm font-medium text-white/80">Post: {selectedCarousel.title}</p>
            {selectedCarousel.slides && (
              <span className="text-[10px] text-white/25 ml-auto">{selectedCarousel.slides.length} slides</span>
            )}
          </div>

          {/* Caption */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-white/50 text-xs">Caption</Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleRegenerateCaption} disabled={isRegeneratingCaption || !selectedCarousel?.slides?.length} className="text-white/40 hover:text-white/70 hover:bg-white/5 text-[11px] gap-1.5 h-6 px-2">
                {isRegeneratingCaption ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Regenerate
              </Button>
            </div>
            <Textarea value={scheduleCaption || selectedCarousel?.caption || ''} onChange={(e) => setScheduleCaption(e.target.value)} rows={4} className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xs resize-none" placeholder="Add your caption with hashtags..." />
          </div>

          {/* Music Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-white/40" />
                <Label className="text-white/50 text-xs">Music (optional)</Label>
              </div>
              {!selectedTrack && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowMusicPicker(true)} className="text-white/40 hover:text-white/70 hover:bg-white/5 text-[11px] gap-1.5 h-6 px-2">
                  <Search className="w-3 h-3" />
                  Browse
                </Button>
              )}
            </div>

            {/* Selected track display */}
            {selectedTrack ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/10">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center flex-shrink-0">
                  <Disc3 className="w-5 h-5 text-white/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/80 truncate">{selectedTrack.title}</p>
                  <p className="text-[11px] text-white/40 truncate">{selectedTrack.artist}{selectedTrack.genre ? ` · ${selectedTrack.genre}` : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowMusicPicker(true)} className="text-white/30 hover:text-white/60 hover:bg-white/5 h-7 w-7 p-0">
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveMusic} className="text-white/30 hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div onClick={() => setShowMusicPicker(true)} className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.02] cursor-pointer transition-colors">
                <Music className="w-3.5 h-3.5 text-white/20" />
                <span className="text-[11px] text-white/25">Add music to your carousel</span>
              </div>
            )}
          </div>

          {/* Music Picker Dialog */}
          <Dialog open={showMusicPicker} onOpenChange={setShowMusicPicker}>
            <DialogContent className="bg-[#0d0d0d] border-white/10 text-white max-w-md p-0 gap-0 max-h-[85vh] overflow-hidden">
              <div className="p-4 pb-3 border-b border-white/5">
                <DialogHeader>
                  <DialogTitle className="text-white text-sm font-semibold">Add Music</DialogTitle>
                </DialogHeader>
              </div>

              {/* Search input */}
              <div className="px-4 py-3 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <Input
                    value={musicSearchQuery}
                    onChange={(e) => handleMusicSearchChange(e.target.value)}
                    placeholder="Search songs, artists..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-xs pl-9 h-9"
                    autoFocus
                  />
                  {isSearchingMusic && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 animate-spin" />}
                </div>
              </div>

              {/* Trending suggestions */}
              {!musicSearchQuery.trim() && (
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <TrendingUp className="w-3 h-3 text-white/30" />
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-medium">Trending on Instagram</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TRENDING_QUERIES.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleTrendingClick(q)}
                        className="px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-white/50 text-[11px] hover:bg-white/10 hover:text-white/70 hover:border-white/15 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Results */}
              <div className="overflow-y-auto max-h-[40vh]">
                {musicResults.length === 0 && !isSearchingMusic && musicSearchQuery.trim() && (
                  <div className="p-6 text-center">
                    <Music className="w-8 h-8 text-white/10 mx-auto mb-2" />
                    <p className="text-[11px] text-white/25">No results found. Try a different search.</p>
                  </div>
                )}
                {musicResults.map((track, i) => (
                  <button
                    key={track.id || i}
                    onClick={() => handleSelectTrack(track)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-white/[0.03] last:border-0"
                  >
                    <div className="w-9 h-9 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Play className="w-3.5 h-3.5 text-white/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 truncate">{track.display_name || track.title}</p>
                      <p className="text-[10px] text-white/35 truncate">
                        {track.artist}
                        {track.genre ? ` · ${track.genre}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
                {!musicSearchQuery.trim() && (
                  <div className="p-4 text-center">
                    <p className="text-[11px] text-white/20">Search or tap a trending genre above to find music</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Schedule */}
          <div className="space-y-1.5">
            <Label className="text-white/50 text-xs">Schedule Date & Time</Label>
            <Input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="bg-white/5 border-white/10 text-white placeholder:text-white/20 [color-scheme:dark]" />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSchedule} disabled={!scheduleTime || isScheduling} className="flex-1 bg-white text-black hover:bg-white/90 text-xs gap-1.5 h-9">
              {isScheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              Schedule Post
            </Button>
            <Button onClick={handlePostNow} disabled={isPosting} variant="outline" className="flex-1 border-white/10 text-white/70 hover:bg-white/5 text-xs gap-1.5 h-9">
              {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Post Now
            </Button>
          </div>

          {postProgress && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Loader2 className="w-3 h-3 animate-spin" />
              {postProgress}
            </div>
          )}

          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs whitespace-pre-line ${
              result.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {result.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{result.message}</span>
            </div>
          )}
        </div>
      )}

      {!selectedCarousel && connected && (
        <div className="text-center py-8">
          <p className="text-white/20 text-xs">Select a carousel from the dashboard to post it</p>
        </div>
      )}
    </div>
  );
}