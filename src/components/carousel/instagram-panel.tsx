'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Instagram, Link2, Unlink, Calendar, Send, CheckCircle2, AlertCircle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import SlideRenderer, { type SlideData } from '@/components/carousel/slide-renderer';

interface InstagramPanelProps {
  selectedCarousel: { id: string; title: string; caption: string | null; slides?: SlideData[] } | null;
  onActionComplete: () => void;
}

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

  // Generate PNG images from slides using html-to-image
  const generateSlideImages = useCallback(async (slides: SlideData[]): Promise<string[]> => {
    const { toPng } = await import('html-to-image');

    // Create off-screen container
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

        // Render slide into container
        const wrapper = document.createElement('div');
        container.appendChild(wrapper);

        // Use React to render the slide component into the wrapper
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
          // Wait for render + fonts
          setTimeout(resolve, 300);
        });

        // Capture as PNG
        const dataUrl = await toPng(wrapper.firstElementChild as HTMLElement || wrapper, {
          width: 1080,
          height: 1350,
          pixelRatio: 1,
          cacheBust: true,
          style: {
            transform: 'none',
            transformOrigin: 'top left',
          },
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
    setIsScheduling(true);
    setResult(null);
    try {
      const res = await fetch('/api/instagram/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId: selectedCarousel.id,
          scheduledTime: new Date(scheduleTime).toISOString(),
          caption: scheduleCaption,
        }),
      });
      const data = await res.json();
      setResult({
        success: res.ok,
        message: res.ok ? data.message : data.error,
      });
      if (res.ok) onActionComplete();
    } catch {
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

    if (!confirm(`Post "${selectedCarousel.title}" to @${username} now? This will upload ${slides.length} slides.`)) return;

    setIsPosting(true);
    setPostProgress('Generating slide images...');
    setResult(null);

    try {
      // Step 1: Generate PNG images from slides
      const images = await generateSlideImages(slides);
      setPostProgress('Sending to queue...');

      // Step 2: Queue the post (instant response — no server crash)
      const res = await fetch('/api/instagram/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId: selectedCarousel.id,
          caption: scheduleCaption || selectedCarousel.caption || '',
          images,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPostProgress('');
        setResult({ success: false, message: data.error || 'Failed to queue post.' });
        setIsPosting(false);
        return;
      }

      // Step 3: Poll for result (daemon processes in background)
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
            } else if (attempts > 90) { // 90 * 3s = 4.5 min max
              clearInterval(interval);
              resolve({ success: false, message: 'Posting timed out. Check your Instagram account manually.' });
            }
          } catch {
            // Network blip, keep polling
          }
        }, 3000);
      });

      setPostProgress('');
      setResult(pollResult);
      if (pollResult.success) onActionComplete();

    } catch (err) {
      setPostProgress('');
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }

    setIsPosting(false);
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
                <Button
                  size="sm"
                  className="bg-white text-black hover:bg-white/90 text-xs gap-1.5 h-8"
                >
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
                    <Input
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="@yourbrand"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/50 text-xs">Access Token</Label>
                    <Input
                      value={formToken}
                      onChange={(e) => setFormToken(e.target.value)}
                      placeholder="EAA..."
                      type="password"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/50 text-xs">Instagram User ID</Label>
                    <Input
                      value={formUserId}
                      onChange={(e) => setFormUserId(e.target.value)}
                      placeholder="17841400..."
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    />
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={!formUsername || !formToken || !formUserId || isConnecting}
                    className="w-full bg-white text-black hover:bg-white/90 text-xs h-9"
                  >
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-white/50 text-xs">Caption</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRegenerateCaption}
                disabled={isRegeneratingCaption || !selectedCarousel?.slides?.length}
                className="text-white/40 hover:text-white/70 hover:bg-white/5 text-[11px] gap-1.5 h-6 px-2"
              >
                {isRegeneratingCaption ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Regenerate
              </Button>
            </div>
            <Textarea
              value={scheduleCaption || selectedCarousel?.caption || ''}
              onChange={(e) => setScheduleCaption(e.target.value)}
              rows={4}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xs resize-none"
              placeholder="Add your caption with hashtags..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/50 text-xs">Schedule Date & Time</Label>
            <Input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 [color-scheme:dark]"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSchedule}
              disabled={!scheduleTime || isScheduling}
              className="flex-1 bg-white text-black hover:bg-white/90 text-xs gap-1.5 h-9"
            >
              {isScheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              Schedule Post
            </Button>
            <Button
              onClick={handlePostNow}
              disabled={isPosting}
              variant="outline"
              className="flex-1 border-white/10 text-white/70 hover:bg-white/5 text-xs gap-1.5 h-9"
            >
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