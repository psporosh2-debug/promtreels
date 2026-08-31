import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft,
  Sparkles, 
  Film, 
  Music2,
  X,
  SlidersHorizontal,
  Flame,
  Volume2,
  VolumeX,
  Layers,
  Wand2,
  Compass,
  Video,
  RefreshCw,
  Heart,
  MessageCircle,
  Copy,
  MoreVertical,
  WandSparkles,
  Check,
  Volume1
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { ReelPost, MainReelTab, ReelCategory, REELS_CATEGORIES } from '@/types/reels';
import { ReelCustomPlayer } from '@/components/reels/ReelCustomPlayer';
import { ReelSideActions } from '@/components/reels/ReelSideActions';
import { ReelInfoModal } from '@/components/reels/ReelInfoModal';
import { UploadReelModal } from '@/components/reels/UploadReelModal';
import { deduplicateReelsList } from '@/lib/reelsDeduplication';
import { extractTikTokVideo } from '@/api/tiktokApi';
import { supabase } from '@/lib/supabase';
import { soundEffects } from '@/lib/sound';
import { useToast } from '@/hooks/use-toast';
import { fetchFeed } from '@/services/phase3';

export default function ReelsFeed() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [reels, setReels] = useState<ReelPost[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<'next' | 'prev'>('next');
  const [activeTab, setActiveTab] = useState<MainReelTab>('explore');
  const [feedMode, setFeedMode] = useState<'for_you'|'following'|'trending'>('for_you');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expandedDescription, setExpandedDescription] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  // Modals (No auth requirement for uploading)
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [infoReel, setInfoReel] = useState<ReelPost | null>(null);

  // Touch & Swipe tracking
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const isNavigatingRef = useRef<boolean>(false);

  const switchFeedMode = useCallback(async (mode:'for_you'|'following'|'trending') => {
    setFeedMode(mode); setCurrentIndex(0); setIsLoading(true);
    try { const rows = await fetchFeed(mode); if (rows.length) setReels(deduplicateReelsList(rows as ReelPost[])); else if (mode==='following') setReels([]); }
    catch (e:any) { toast({title:'Feed unavailable',description:e.message,variant:'destructive'}); }
    finally { setIsLoading(false); }
  }, [toast]);

  // 1. Load ONLY Real Data directly from Supabase reels_posts table
  const loadReels = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('reels_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase reels_posts query error:', error);
        toast({
          title: 'Database connection issue',
          description: error.message || 'Could not fetch reels from database',
          variant: 'destructive',
        });
        setReels([]);
      } else if (data) {
        // Render purely real database records
        const unique = deduplicateReelsList(data as ReelPost[]);
        setReels(unique);

        // If Home opened a specific Reel, select that Reel after loading
        // the real database records.
        const requestedReelId = new URLSearchParams(window.location.search).get('reelId');

        if (requestedReelId) {
          const targetIndex = unique.findIndex(
            (reel) => String(reel.id) === String(requestedReelId)
          );

          if (targetIndex !== -1) {
            setActiveTab('explore');
            setSelectedSubCategory('All');
            setSearchQuery('');
            setCurrentIndex(targetIndex);
          }
        }

        // Async background sync of original TikTok likes count and photo audio/music if unpopulated
        unique.forEach(async (reel) => {
          const needsLikesSync = (reel.tiktok_likes === undefined || reel.tiktok_likes === null || reel.tiktok_likes === 0) && reel.tiktok_url;
          const isPhoto = reel.media_type === 'photo' || (Array.isArray(reel.images) && reel.images.length > 0);
          const needsMusicSync = (isPhoto || !reel.music_url) && reel.tiktok_url;

          if (needsLikesSync || needsMusicSync) {
            try {
              const res = await extractTikTokVideo(reel.tiktok_url!);
              if (res.success && res.data) {
                const originalLikes = res.data.stats?.diggCount || reel.tiktok_likes || 0;
                const totalLikesNew = originalLikes + (reel.website_likes || 0);
                const fetchedAudioUrl = res.data.audioUrl || reel.music_url || '';
                const fetchedMusicTitle = res.data.musicInfo?.title || reel.music_title || '';
                const fetchedImages = res.data.images || reel.images || [];
                const fetchedMediaType = (res.data.isSlideShow || fetchedImages.length > 0) ? 'photo' : (reel.media_type || 'video');

                setReels(prev => prev.map(r => r.id === reel.id ? { 
                  ...r, 
                  tiktok_likes: originalLikes, 
                  likes_count: totalLikesNew,
                  music_url: r.music_url || fetchedAudioUrl,
                  music_title: r.music_title || fetchedMusicTitle,
                  media_type: fetchedMediaType,
                  images: (r.images && r.images.length > 0) ? r.images : fetchedImages
                } : r));

                await supabase.from('reels_posts').update({ 
                  tiktok_likes: originalLikes,
                  likes_count: totalLikesNew,
                  music_url: reel.music_url || fetchedAudioUrl || null,
                  music_title: reel.music_title || fetchedMusicTitle || null,
                  media_type: fetchedMediaType,
                  images: (reel.images && reel.images.length > 0) ? reel.images : fetchedImages
                }).eq('id', reel.id);
              }
            } catch {
              // Ignore background sync errors
            }
          }
        });
      }
    } catch (err: any) {
      console.error('Error fetching reels_posts:', err);
      setReels([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReels();

    // Supabase real-time updates for reels_posts table
    const channel = supabase
      .channel('realtime_reels_posts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reels_posts' },
        (payload) => {
          console.log('Realtime reels_posts update:', payload);
          loadReels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadReels]);

  // 2. Filtered Reels by Top Tab & Search
  const filteredReels = useMemo(() => {
    return reels.filter((reel) => {
      // Tab filter
      let matchesTab = true;
      if (activeTab === 'video_edit') {
        matchesTab =
          (reel.category && (
            reel.category.toLowerCase().includes('video') ||
            reel.category.toLowerCase().includes('capcut') ||
            reel.category.toLowerCase().includes('vfx') ||
            reel.category.toLowerCase().includes('color')
          )) || false;
      } else if (activeTab === 'prompt') {
        matchesTab =
          (reel.category && (
            reel.category.toLowerCase().includes('prompt') ||
            reel.category.toLowerCase().includes('photo') ||
            reel.category.toLowerCase().includes('blender') ||
            reel.category.toLowerCase().includes('3d')
          )) || false;
      }

      // Sub-category filter (if not 'All')
      const matchesSubCat =
        selectedSubCategory === 'All' ||
        (reel.category && reel.category.toLowerCase() === selectedSubCategory.toLowerCase());

      // Search query filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (reel.title && reel.title.toLowerCase().includes(q)) ||
        (reel.prompt_text && reel.prompt_text.toLowerCase().includes(q)) ||
        (reel.category && reel.category.toLowerCase().includes(q)) ||
        (reel.author_name && reel.author_name.toLowerCase().includes(q));

      return matchesTab && matchesSubCat && matchesSearch;
    });
  }, [reels, activeTab, selectedSubCategory, searchQuery]);

  // Reset index if filtered list shrinks
  useEffect(() => {
    if (currentIndex >= filteredReels.length && filteredReels.length > 0) {
      setCurrentIndex(0);
    }
  }, [filteredReels.length, currentIndex]);

  // Next / Prev Reel Handlers
  const handleNextReel = useCallback(() => {
    if (isNavigatingRef.current) return;
    if (currentIndex < filteredReels.length - 1) {
      isNavigatingRef.current = true;
      setSwipeDirection('next');
      setCurrentIndex((prev) => prev + 1);
      setExpandedDescription(false);
      soundEffects.play('tick');
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 350);
    }
  }, [currentIndex, filteredReels.length]);

  const handlePrevReel = useCallback(() => {
    if (isNavigatingRef.current) return;
    if (currentIndex > 0) {
      isNavigatingRef.current = true;
      setSwipeDirection('prev');
      setCurrentIndex((prev) => prev - 1);
      setExpandedDescription(false);
      soundEffects.play('tick');
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 350);
    }
  }, [currentIndex]);

  // Keyboard navigation (ArrowUp, ArrowDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNextReel();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrevReel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextReel, handlePrevReel]);

  // Touch Swipe Handling (TikTok mobile feel with overscroll prevention)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
    // Prevent browser pull-to-refresh on mobile Chrome
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartY.current || !touchEndY.current) return;
    const distance = touchStartY.current - touchEndY.current;
    const minSwipeDistance = 45;

    if (distance > minSwipeDistance) {
      // Swiped UP -> Next Reel
      handleNextReel();
    } else if (distance < -minSwipeDistance) {
      // Swiped DOWN -> Prev Reel
      handlePrevReel();
    }

    touchStartY.current = null;
    touchEndY.current = null;
  };

  // Mouse Wheel Handling
  const wheelLockRef = useRef<boolean>(false);
  const handleWheel = (e: React.WheelEvent) => {
    if (wheelLockRef.current) return;

    if (e.deltaY > 35) {
      wheelLockRef.current = true;
      handleNextReel();
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 500);
    } else if (e.deltaY < -35) {
      wheelLockRef.current = true;
      handlePrevReel();
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 500);
    }
  };

  // Live Copy Sync
  const handleCopySuccess = async (reelId: string, newCount: number) => {
    setReels((prev) =>
      prev.map((r) => (r.id === reelId ? { ...r, copy_count: newCount } : r))
    );
    try {
      await supabase.from('reels_posts').update({ copy_count: newCount }).eq('id', reelId);
    } catch (err) {
      console.warn('Could not update copy_count on reels_posts:', err);
    }
  };

  // Live Like Sync
  const handleLikeToggle = async (reelId: string, newCount: number) => {
    setReels((prev) =>
      prev.map((r) => (r.id === reelId ? { ...r, likes_count: newCount } : r))
    );
    try {
      await supabase.from('reels_posts').update({ likes_count: newCount }).eq('id', reelId);
    } catch (err) {
      console.warn('Could not update likes_count on reels_posts:', err);
    }
  };

  const handleReelAdded = (newReel: ReelPost) => {
    setReels((prev) => [newReel, ...prev.filter(r => r.id !== newReel.id)]);
    setActiveTab('explore');
    setSelectedSubCategory('All');
    setCurrentIndex(0);
  };

  // Keep the Reel opened from Home selected after filtering.
  useEffect(() => {
    const requestedReelId = new URLSearchParams(window.location.search).get('reelId');

    if (!requestedReelId || filteredReels.length === 0) return;

    const targetIndex = filteredReels.findIndex(
      (reel) => String(reel.id) === String(requestedReelId)
    );

    if (targetIndex !== -1 && targetIndex !== currentIndex) {
      setCurrentIndex(targetIndex);
      setSwipeDirection('next');
    }
  }, [filteredReels, currentIndex]);

  const activeReel = filteredReels[currentIndex];

  const handlePromptCopy = async () => {
    if (!activeReel?.prompt_text) return;
    try {
      await navigator.clipboard.writeText(activeReel.prompt_text);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 1400);
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy the prompt.', variant: 'destructive' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 h-[100dvh] w-full overflow-hidden bg-black text-white select-none overscroll-none touch-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Screenshot-inspired top navigation */}
      <div className="absolute inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4 pointer-events-none">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2">
          <Link
            href="/"
            onClick={() => soundEffects.play('click')}
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-xl transition hover:bg-black/55 active:scale-95"
            title="Back to Home"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>

          <div className="pointer-events-auto mr-1 flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 shadow-2xl backdrop-blur-xl">
            {[['for_you','For You'],['following','Following'],['trending','Trending']].map(([id,label]) => (
              <button key={id} onClick={() => switchFeedMode(id as 'for_you'|'following'|'trending')} className={`rounded-full px-2.5 py-1.5 text-[10px] font-black sm:px-3 ${feedMode===id?'bg-cyan-400 text-black':'text-white/55'}`}>{label}</button>
            ))}
          </div>
          <div className="pointer-events-auto flex h-10 items-center rounded-full border border-white/10 bg-black/30 px-1.5 shadow-2xl backdrop-blur-xl">
            {[
              { id: 'video_edit' as MainReelTab, label: 'Video Edit' },
              { id: 'prompt' as MainReelTab, label: 'Prompt' },
              { id: 'explore' as MainReelTab, label: 'Reels' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedSubCategory('All');
                  setSearchQuery('');
                  setCurrentIndex(0);
                  soundEffects.play('tab');
                }}
                className={`relative rounded-full px-4 py-2 text-[12px] font-extrabold tracking-wide transition sm:px-5 sm:text-sm ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-violet-700/90 via-fuchsia-600/80 to-indigo-600/90 text-white shadow-[0_0_24px_rgba(124,58,237,.28)]'
                    : 'text-white/45 hover:text-white/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => {
                setIsSearchOpen((v) => !v);
                soundEffects.play('click');
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/85 backdrop-blur-xl transition hover:bg-black/55 active:scale-95"
              title="Search"
            >
              {isSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <button
              onClick={() => {
                soundEffects.play('click');
                setLocation('/reels/upload');
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-700 text-white shadow-[0_6px_25px_rgba(37,99,235,.4)] transition hover:scale-105 active:scale-95"
              title="Create Reel"
            >
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {isSearchOpen && (
          <div className="pointer-events-auto mx-auto mt-2 w-full max-w-sm">
            <div className="relative rounded-full border border-white/15 bg-black/65 shadow-2xl backdrop-blur-xl">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentIndex(0);
                }}
                placeholder="Search prompt, creator or category..."
                className="w-full rounded-full bg-transparent py-2.5 pl-11 pr-10 text-sm text-white outline-none placeholder:text-white/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sound badge */}
      {activeReel && !isLoading && (
        <button
          onClick={() => setSoundOn((v) => !v)}
          className="absolute right-4 top-[88px] z-40 flex items-center gap-2 rounded-full border border-white/10 bg-[#554a37]/75 px-4 py-2 text-xs font-extrabold tracking-wide text-white/90 shadow-lg backdrop-blur-md transition hover:bg-[#65563e]/85 active:scale-95 sm:right-7"
        >
          {soundOn ? <Volume1 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-white/60" />}
          {soundOn ? 'SOUND ON' : 'SOUND OFF'}
        </button>
      )}

      {/* Main reel stage */}
      <div className="relative mx-auto h-full w-full max-w-5xl overflow-hidden bg-black">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/70">
            <Film className="h-10 w-10 animate-bounce" />
            <span className="font-mono text-xs tracking-wider">Loading Reels...</span>
          </div>
        ) : filteredReels.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5">
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950/80 p-7 text-center shadow-2xl backdrop-blur-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Film className="h-7 w-7 text-white/75" />
              </div>
              <h3 className="text-base font-bold">No Reels in Database</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/55">
                {reels.length === 0
                  ? 'No posts in reels_posts table yet. Be the first to create one!'
                  : 'No reels match the selected category or search filter.'}
              </p>
              <button
                onClick={() => setLocation('/reels/upload')}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-xs font-bold shadow-lg"
              >
                <Plus className="h-4 w-4" />
                Create New Reel
              </button>
            </div>
          </div>
        ) : activeReel ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={activeReel.id}
              initial={{ opacity: 0.9, y: swipeDirection === 'next' ? 55 : -55 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0.9, y: swipeDirection === 'next' ? -55 : 55 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative h-full w-full overflow-hidden"
            >
              {/* Media */}
              <div className="absolute inset-0">
                <ReelCustomPlayer
                  key={activeReel.id}
                  reel={activeReel}
                  isActive={true}
                  onDoubleTapLike={() =>
                    handleLikeToggle(activeReel.id, (activeReel.likes_count || 0) + 1)
                  }
                />
              </div>

              {/* Cinematic overlays */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/75 via-black/25 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

              {/* Right action rail — screenshot style */}
              <div className="absolute bottom-20 right-3 z-40 flex w-[76px] flex-col items-center gap-1.5 sm:right-5">
                <button
                  onClick={() => handleCopySuccess(activeReel.id, (activeReel.copy_count || 0) + 1)}
                  className="group flex w-[72px] flex-col items-center rounded-[25px] bg-black/45 py-2.5 backdrop-blur-xl transition hover:bg-black/60 active:scale-95"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 shadow-[0_0_22px_rgba(37,99,235,.45)] ring-2 ring-white/10">
                    <Copy className="h-6 w-6" />
                  </span>
                  <span className="mt-1 text-[11px] font-bold text-cyan-300">PTCopy</span>
                </button>

                <button
                  onClick={() => handleLikeToggle(activeReel.id, (activeReel.likes_count || 0) + 1)}
                  className="flex w-[72px] flex-col items-center rounded-[22px] py-2 text-white transition hover:bg-black/25 active:scale-95"
                >
                  <Heart
                    className={`h-8 w-8 ${
                      (activeReel.likes_count || 0) > 0 ? 'fill-current text-rose-400' : 'text-white'
                    }`}
                    strokeWidth={1.7}
                  />
                  <span className="mt-0.5 text-[11px] font-semibold">{activeReel.likes_count || 0}</span>
                </button>

                <button
                  onClick={() => setInfoReel(activeReel)}
                  className="flex w-[72px] flex-col items-center rounded-[22px] py-2 text-white transition hover:bg-black/25 active:scale-95"
                >
                  <MessageCircle className="h-8 w-8 text-cyan-300" strokeWidth={1.7} />
                  <span className="mt-0.5 text-[11px] font-semibold">{activeReel.comments_count || 0}</span>
                </button>

                <button
                  onClick={() => setInfoReel(activeReel)}
                  className="flex w-[72px] flex-col items-center rounded-[22px] py-2 text-white transition hover:bg-black/25 active:scale-95"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 bg-black/25">
                    <WandSparkles className="h-5 w-5 text-cyan-300" />
                  </span>
                  <span className="mt-0.5 text-[11px] font-bold text-cyan-300">Recipe</span>
                </button>

                <button
                  onClick={() => setInfoReel(activeReel)}
                  className="flex h-11 w-[72px] items-center justify-center rounded-[22px] text-white/80 transition hover:bg-black/30 active:scale-95"
                  title="More"
                >
                  <MoreVertical className="h-7 w-7" />
                </button>

                <button
                  onClick={() => setInfoReel(activeReel)}
                  className="mt-1 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400/50 bg-black/50 shadow-[0_0_20px_rgba(34,211,238,.25)]"
                  title="Audio / Reel info"
                >
                  {activeReel.images?.[0] ? (
                    <img
                      src={activeReel.images[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Music2 className="h-5 w-5 text-cyan-300" />
                  )}
                </button>
              </div>

              {/* Creator + title + prompt panel */}
              <div className="absolute bottom-4 left-4 right-[88px] z-40 sm:bottom-7 sm:left-6 sm:max-w-[650px]">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 text-[11px] font-black ring-1 ring-white/30">
                    {(activeReel.author_name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-sm font-extrabold tracking-tight sm:text-base">
                    @{activeReel.author_name || 'Anonymous'}
                  </span>
                </div>

                <p className="mb-2 truncate text-sm font-semibold text-white/90 sm:text-base">
                  ✨ {activeReel.title || 'Trending AI Creation'}
                </p>

                {activeReel.prompt_text && (
                  <div className="overflow-hidden rounded-[18px] border border-white/10 bg-black/65 shadow-[0_12px_40px_rgba(0,0,0,.4)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-cyan-300" />
                        <span className="font-mono text-[10px] font-black tracking-[0.16em] text-cyan-300">
                          PROMPT FORMULA
                        </span>
                      </div>
                      <button
                        onClick={handlePromptCopy}
                        className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-white/75 transition hover:text-white"
                      >
                        {copiedPrompt ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedPrompt ? 'Copied' : '1-Click Copy'}
                      </button>
                    </div>
                    <button
                      onClick={() => setExpandedDescription((v) => !v)}
                      className="block w-full px-4 py-3 text-left"
                    >
                      <p
                        className={`font-mono text-[11px] leading-relaxed text-white/80 sm:text-xs ${
                          expandedDescription ? '' : 'line-clamp-2'
                        }`}
                      >
                        {activeReel.prompt_text}
                      </p>
                    </button>
                  </div>
                )}

                <div className="mt-2 flex max-w-full items-center gap-2 overflow-hidden text-xs text-white/60">
                  <Music2 className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <span className="truncate">
                    {activeReel.music_title || 'Original Audio • Trending Reel'}
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>

      {/* Modals */}
      <UploadReelModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onReelCreated={handleReelAdded}
      />

      {infoReel && (
        <ReelInfoModal
          reel={infoReel}
          isOpen={!!infoReel}
          onClose={() => setInfoReel(null)}
          onCopySuccess={(newCount) => handleCopySuccess(infoReel.id, newCount)}
        />
      )}
    </div>
  );
}
