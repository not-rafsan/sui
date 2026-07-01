'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Instagram, Link2, Unlink, Calendar, Send, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

interface InstagramPanelProps {
  selectedCarousel: { id: string; title: string; caption: string | null } | null;
  onActionComplete: () => void;
}

export default function InstagramPanel({ selectedCarousel, onActionComplete }: InstagramPanelProps) {
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleCaption, setScheduleCaption] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  // Form state
  const [formUsername, setFormUsername] = useState('');
  const [formToken, setFormToken] = useState('');
  const [formUserId, setFormUserId] = useState('');

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

  React.useEffect(() => {
    const controller = new AbortController();
    checkConnection();
    return () => controller.abort();
  }, []);

  const handleConnect = async () => {
    if (!formUsername || !formToken || !formUserId) return;
    setIsConnecting(true);
    try {
      const res = await fetch('/api/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername,
          accessToken: formToken,
          instagramUserId: formUserId,
        }),
      });
      if (res.ok) {
        setConnected(true);
        setUsername(formUsername);
        setConnectDialogOpen(false);
      }
    } catch { /* ignore */ }
    setIsConnecting(false);
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
    if (!confirm(`Post "${selectedCarousel.title}" to Instagram now? (Simulation mode)`)) return;
    setIsPosting(true);
    setResult(null);
    try {
      const res = await fetch('/api/instagram/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId: selectedCarousel.id,
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
    setIsPosting(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold text-white tracking-tight">Instagram Integration</h2>
        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
          Connect your Instagram account to schedule and auto-post carousels directly.
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
                      placeholder="IGQVJ..."
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
                  <p className="text-[10px] text-white/25 leading-relaxed">
                    Get these from Meta for Developers → Instagram Graph API. Your token needs instagram_basic and instagram_content_publish permissions.
                  </p>
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

        {/* Info box */}
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
          <p className="text-[10px] text-white/25 leading-relaxed">
            <strong className="text-white/40">How it works:</strong> Connect via Instagram Graph API with a Business/Creator account.
            Schedule carousels for auto-posting, or post immediately. Carousels are uploaded as multi-image carousel posts with your caption and hashtags.
          </p>
        </div>
      </div>

      {/* Schedule / Post Section */}
      {selectedCarousel && connected && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white/30" />
            <p className="text-sm font-medium text-white/80">Schedule: {selectedCarousel.title}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/50 text-xs">Caption</Label>
            <Textarea
              value={scheduleCaption || selectedCarousel?.caption || ''}
              onChange={(e) => setScheduleCaption(e.target.value)}
              rows={3}
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

          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
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
          <p className="text-white/20 text-xs">Select a carousel from the dashboard to schedule or post it</p>
        </div>
      )}
    </div>
  );
}