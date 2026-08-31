import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Sparkles, 
  Video, 
  Upload, 
  Link2, 
  Check, 
  Loader2, 
  AlertCircle, 
  AlertTriangle, 
  Tag, 
  User, 
  FileText, 
  RotateCw, 
  Copy, 
  HelpCircle, 
  Languages, 
  Lightbulb
} from 'lucide-react';
import { ReelPost, REELS_CATEGORIES, ReelCategory } from '@/types/reels';
import { extractTikTokVideo } from '@/api/tiktokApi';
import { supabase } from '@/lib/supabase';
import { soundEffects } from '@/lib/sound';
import { useToast } from '@/hooks/use-toast';
import { useAuthUser } from '@/hooks/useAuthUser';
import { checkReelUrlIsDuplicate } from '@/lib/reelsDeduplication';

export default function ReelsUpload({ onReelCreated }: { onReelCreated?: (reel: ReelPost) => void } = {}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user: currentUser } = useAuthUser();

  // Form States
  const [tiktokUrl, setTiktokUrl] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<ReelCategory>('AI Prompts');
  const [promptText, setPromptText] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>('');

  // Duplication & Extraction States
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    isDuplicate: boolean;
    title?: string;
    author?: string;
  } | null>(null);

  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string>('');
  const [extractedData, setExtractedData] = useState<{
    streamUrl: string;
    coverUrl: string;
    mediaType: 'video' | 'photo' | 'live_photo';
    images?: string[];
    duration?: number;
    musicTitle?: string;
    musicUrl?: string;
    diggCount?: number;
  } | null>(null);

  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Gemini AI States
  const [aiAction, setAiAction] = useState<'enhance' | 'translate' | 'ideas'>('enhance');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiExtraInstructions, setAiExtraInstructions] = useState<string>('');
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState<string>('');

  // Handle URL Blur - check duplicates
  const handleUrlBlur = async () => {
    if (!tiktokUrl.trim()) {
      setDuplicateInfo(null);
      return;
    }

    setIsCheckingDuplicate(true);
    try {
      const dupCheck = await checkReelUrlIsDuplicate(tiktokUrl);
      if (dupCheck.isDuplicate) {
        setDuplicateInfo({
          isDuplicate: true,
          title: dupCheck.duplicateTitle,
          author: dupCheck.author
        });
        soundEffects.play('alert');
      } else {
        setDuplicateInfo(null);
      }
    } catch {
      // Ignore
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // Extract Clean TikTok Stream Details
  const handleExtract = async () => {
    if (!tiktokUrl.trim()) {
      setExtractError('Please enter a TikTok video or photo slide link.');
      return;
    }

    setIsExtracting(true);
    setExtractError('');

    try {
      // 1. Double check duplicates
      const dupCheck = await checkReelUrlIsDuplicate(tiktokUrl);
      if (dupCheck.isDuplicate) {
        setDuplicateInfo({
          isDuplicate: true,
          title: dupCheck.duplicateTitle,
          author: dupCheck.author
        });
        setExtractError(`This URL is already uploaded as "${dupCheck.duplicateTitle || 'Reel'}" by @${dupCheck.author || 'Creator'}.`);
        soundEffects.play('alert');
        setIsExtracting(false);
        return;
      } else {
        setDuplicateInfo(null);
      }

      const res = await extractTikTokVideo(tiktokUrl);
      if (res.success && res.data) {
        const d = res.data;
        const isPhoto = d.isSlideShow || (d.images && d.images.length > 0);
        
        setExtractedData({
          streamUrl: d.videoHdUrl || d.videoUrl || d.cover || '',
          coverUrl: d.cover || d.originCover || '',
          mediaType: isPhoto ? 'photo' : 'video',
          images: d.images && d.images.length > 0 ? d.images : undefined,
          duration: d.duration,
          musicTitle: d.musicInfo?.title || 'Original Audio',
          musicUrl: d.audioUrl || '',
          diggCount: d.stats?.diggCount || 0,
        });

        // Autofill title if empty
        if (!title.trim() && d.title) {
          setTitle(d.title.slice(0, 80));
        }

        soundEffects.play('pop');
        toast({
          title: "TikTok Extracted! 🎬",
          description: `Ready to publish clean ${isPhoto ? 'Photo Slideshow' : 'Video'}.`,
        });
      } else {
        setExtractError(res.error || 'Could not extract video. Check your TikTok link.');
      }
    } catch (err: any) {
      setExtractError(err.message || 'Failed to extract TikTok media.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Run Gemini Prompt Engineering Assistant
  const handleRunAi = async () => {
    if (aiAction === 'enhance' && !promptText.trim()) {
      setAiError('Please type a base prompt or instruction first to enhance.');
      return;
    }
    if (aiAction === 'translate' && !promptText.trim()) {
      setAiError('Please enter some text in the Prompt field to translate.');
      return;
    }

    setIsAiLoading(true);
    setAiError('');
    setAiResult(null);
    soundEffects.play('click');

    try {
      const response = await fetch('/api/ai/reels-prompt-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: aiAction,
          promptText: promptText,
          title: title,
          category: category,
          extraInstructions: aiExtraInstructions,
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setAiResult(resData.data);
        soundEffects.play('pop');
        toast({
          title: "Gemini Assisted! 🧠✨",
          description: "AI prompt formulation is ready to apply.",
        });
      } else {
        setAiError(resData.message || 'Gemini error processing your prompt.');
      }
    } catch (err: any) {
      setAiError(err?.message || 'Failed to connect to prompt assistant server.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Apply Gemini Generated Output directly to Form fields
  const handleApplyAi = (data: any) => {
    if (aiAction === 'enhance') {
      if (data.enhancedPrompt) setPromptText(data.enhancedPrompt);
      if (data.tips && data.tips.length > 0 && !description.trim()) {
        setDescription(data.tips.join('. '));
      }
    } else if (aiAction === 'translate') {
      if (data.translatedPrompt) setPromptText(data.translatedPrompt);
    }
    soundEffects.play('success');
    toast({
      title: "Applied to Form! ✅",
      description: "Prompt text has been updated with Gemini's response.",
    });
  };

  // Apply a Concept from Idea Generation
  const handleApplyConcept = (concept: any) => {
    if (concept.title) setTitle(concept.title.slice(0, 80));
    if (concept.prompt) setPromptText(concept.prompt);
    if (concept.hook && !description.trim()) {
      setDescription(`Hook: ${concept.hook}`);
    }
    soundEffects.play('success');
    toast({
      title: "Concept Applied! 🚀",
      description: `Title and prompt replaced with "${concept.title}".`,
    });
  };

  // Submit and Publish Reel directly to database
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tiktokUrl.trim()) {
      setExtractError('TikTok URL is required to extract clean video stream.');
      return;
    }

    const dupCheck = await checkReelUrlIsDuplicate(tiktokUrl);
    if (dupCheck.isDuplicate) {
      setDuplicateInfo({
        isDuplicate: true,
        title: dupCheck.duplicateTitle,
        author: dupCheck.author
      });
      setExtractError(`Cannot upload: Duplicate TikTok URL detected.`);
      soundEffects.play('alert');
      return;
    }

    if (!title.trim()) {
      setExtractError('Please give this reel a short title.');
      return;
    }

    if (!promptText.trim()) {
      setExtractError('Please enter the prompt, curve recipe, or copyable formula.');
      return;
    }

    setIsPublishing(true);
    setExtractError('');

    try {
      let finalStreamUrl = extractedData?.streamUrl || '';
      let finalCoverUrl = extractedData?.coverUrl || '';
      let finalMediaType = extractedData?.mediaType || 'video';
      let finalImages = extractedData?.images || [];
      let finalLikesCount = extractedData?.diggCount || 0;
      let finalMusicUrl = extractedData?.musicUrl || '';
      let finalMusicTitle = extractedData?.musicTitle || '';

      // Force instant extraction if the user bypassed preview
      if (!extractedData) {
        const res = await extractTikTokVideo(tiktokUrl);
        if (res.success && res.data) {
          const d = res.data;
          const isPhoto = d.isSlideShow || (d.images && d.images.length > 0);
          finalStreamUrl = d.videoHdUrl || d.videoUrl || d.cover || '';
          finalCoverUrl = d.cover || d.originCover || '';
          finalMediaType = isPhoto ? 'photo' : 'video';
          finalImages = d.images || [];
          finalLikesCount = d.stats?.diggCount || 0;
          finalMusicUrl = d.audioUrl || '';
          finalMusicTitle = d.musicInfo?.title || '';
        } else {
          finalStreamUrl = tiktokUrl;
        }
      }

      const creatorDisplayName = 
        authorName.trim() || 
        currentUser?.user_metadata?.full_name || 
        currentUser?.email?.split('@')[0] || 
        'Anonymous';

      const reelId = `reel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const createdAt = new Date().toISOString();

      const dbRecord = {
        id: reelId,
        title: title.trim(),
        tiktok_url: tiktokUrl.trim(),
        media_type: finalMediaType,
        stream_url: finalStreamUrl,
        cover_url: finalCoverUrl || null,
        images: finalImages && finalImages.length > 0 ? finalImages : [],
        category: category === 'All' ? 'AI Prompts' : category,
        prompt_text: promptText.trim(),
        description: description.trim() || null,
        copy_count: 0,
        likes_count: finalLikesCount,
        tiktok_likes: finalLikesCount,
        website_likes: 0,
        music_url: finalMusicUrl || null,
        music_title: finalMusicTitle || null,
        author_name: creatorDisplayName,
        author_id: currentUser?.id ? currentUser.id : null,
        created_at: createdAt
      };

      const { error } = await supabase
        .from('reels_posts')
        .insert([dbRecord]);

      if (error) {
        console.error('Supabase reels_posts insert error:', error);
        throw new Error(error.message || 'Database insert failed');
      }

      soundEffects.play('resonantHit');
      toast({
        title: "Reel Published! 🚀",
        description: `Successfully added to feed database by @${creatorDisplayName}.`,
      });

      onReelCreated?.(dbRecord as ReelPost);
      // Clear states and redirect
      setLocation('/reels');
    } catch (err: any) {
      console.error('Publish reel error:', err);
      setExtractError(err.message || 'Failed to publish reel to database.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white px-3 sm:px-5 lg:px-8 pb-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-fuchsia-600/10 blur-[110px]" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>
      {/* 1. Header with Back Button */}
      <header className="relative z-10 max-w-7xl mx-auto pt-4 sm:pt-6">
        <div className="flex items-center justify-between gap-3 h-14 px-3 sm:px-5 rounded-2xl border border-white/10 bg-black/45 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                soundEffects.play('click');
                setLocation('/reels');
              }}
              className="w-9 h-9 shrink-0 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-cyan-400" />
                <h1 className="text-sm sm:text-base font-black truncate">Create Reel</h1>
              </div>
              <p className="hidden sm:block text-[10px] text-white/45 mt-0.5">Publish a prompt-powered visual post</p>
            </div>
          </div>

          <div className="hidden md:flex items-center p-1 rounded-xl border border-white/10 bg-white/[0.04]">
            <button type="button" className="px-4 py-2 rounded-lg text-[11px] font-bold bg-white/10 text-white">Upload</button>
            <button type="button" onClick={() => setLocation('/reels')} className="px-4 py-2 rounded-lg text-[11px] font-bold text-white/45 hover:text-white transition-colors">Reels</button>
            <span className="px-4 py-2 text-[11px] font-bold text-white/30">Sound</span>
          </div>

          <button
            onClick={() => {
              soundEffects.play('click');
              setLocation('/reels');
            }}
            className="shrink-0 px-3 sm:px-4 h-9 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-[10px] sm:text-[11px] font-black shadow-lg shadow-cyan-500/20"
          >
            View Feed
          </button>
        </div>

        <div className="flex md:hidden items-center justify-center gap-1 mt-3 p-1 rounded-xl border border-white/10 bg-white/[0.035]">
          <span className="flex-1 text-center py-2 rounded-lg bg-white/10 text-[10px] font-black">UPLOAD</span>
          <button type="button" onClick={() => setLocation('/reels')} className="flex-1 py-2 text-white/45 text-[10px] font-black">REELS</button>
          <span className="flex-1 text-center py-2 text-white/30 text-[10px] font-black">SOUND</span>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start mt-5">

        {/* ==================== LEFT COLUMN: EXTRACTION & GEMINI AI ASSISTANT ==================== */}
        <div className="lg:col-span-5 space-y-5">
          {/* TikTok link Extraction box */}
          <div className="p-4 sm:p-5 rounded-[28px] bg-white/[0.045] border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden relative">
            <div className="absolute -top-16 -right-10 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-4 relative">
              <h2 className="text-xs font-black flex items-center gap-2 text-white uppercase tracking-[0.12em]">
                <span className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5 text-cyan-300" />
                </span>
                Source Media
              </h2>
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Step 01</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  TikTok Video or Photo Slideshow Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://www.tiktok.com/@username/video/..."
                    value={tiktokUrl}
                    onChange={(e) => {
                      setTiktokUrl(e.target.value);
                      setExtractedData(null);
                      setDuplicateInfo(null);
                      setExtractError('');
                    }}
                    onBlur={handleUrlBlur}
                    className={`flex-1 min-w-0 px-3.5 py-3 rounded-xl bg-black/35 border text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 transition-all ${
                      duplicateInfo?.isDuplicate 
                        ? 'border-rose-500 focus:ring-rose-500/30' 
                        : 'border-border focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={isExtracting || !tiktokUrl.trim() || !!duplicateInfo?.isDuplicate}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-50 h-[44px] shadow-lg shadow-cyan-500/15"
                  >
                    {isExtracting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-primary" />
                    )}
                    Extract
                  </button>
                </div>
              </div>

              {/* Duplicate Detection Alert */}
              {duplicateInfo?.isDuplicate && (
                <div className="p-4 rounded-2xl bg-rose-500/[0.08] border border-rose-500/20 text-xs flex items-start gap-2.5 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-rose-500">Already in Database!</p>
                    <p className="text-foreground/90 mt-0.5 leading-relaxed">
                      This link has been published as <span className="font-semibold text-rose-400">"{duplicateInfo.title || 'Existing Reel'}"</span> by <span className="font-semibold">@{duplicateInfo.author || 'Creator'}</span>.
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Duplicate links are blocked to preserve feed quality.
                    </p>
                  </div>
                </div>
              )}

              {/* Extraction Preview Detail */}
              {extractedData && !duplicateInfo?.isDuplicate && (
                <div className="p-3.5 bg-black/30 rounded-2xl border border-white/10 flex gap-4 animate-fade-in">
                  <img
                    src={extractedData.coverUrl || extractedData.streamUrl || undefined}
                    alt="Preview Cover"
                    className="w-16 h-24 object-cover rounded-xl bg-black border border-white/10 shrink-0 shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                        {extractedData.mediaType} Ready
                      </span>
                      <p className="text-xs text-muted-foreground mt-1.5 truncate">
                        {extractedData.musicTitle || 'Original Audio'}
                      </p>
                    </div>
                    <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Clean watermark-free stream resolved.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* GEMINI AI ASSISTANT PANEL */}
          <div className="p-4 sm:p-5 rounded-[28px] bg-white/[0.045] border border-white/10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4 relative">
              <h2 className="text-xs font-black flex items-center gap-2 text-white uppercase tracking-[0.12em]">
                <span className="w-7 h-7 rounded-lg bg-fuchsia-500/15 border border-fuchsia-400/20 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
                </span>
                AI Prompt Crafter
              </h2>
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Gemini</span>
            </div>

            <div className="space-y-4">
              {/* Segmented Actions */}
              <div className="grid grid-cols-3 p-1 rounded-xl bg-muted/60 border border-border text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAiAction('enhance');
                    setAiResult(null);
                    setAiError('');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                    aiAction === 'enhance'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  Enhance
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiAction('translate');
                    setAiResult(null);
                    setAiError('');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                    aiAction === 'translate'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Languages className="w-3.5 h-3.5 text-indigo-500" />
                  Translate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiAction('ideas');
                    setAiResult(null);
                    setAiError('');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                    aiAction === 'ideas'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  Ideas
                </button>
              </div>

              {/* Instructions field */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  {aiAction === 'ideas' 
                    ? 'Theme/Topic of interest (e.g. Vintage Cyberpunk)' 
                    : 'Extra guidelines for Gemini (Optional)'
                  }
                </label>
                <input
                  type="text"
                  placeholder={
                    aiAction === 'ideas'
                      ? 'e.g. Neon Bengal, CapCut Cinematic, VFX Curve'
                      : 'e.g. Photorealistic 8k, Midjourney aspect 16:9, Niji style'
                  }
                  value={aiExtraInstructions}
                  onChange={(e) => setAiExtraInstructions(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl bg-black/25 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400/50 transition-all"
                />
              </div>

              <button
                type="button"
                onClick={handleRunAi}
                disabled={isAiLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-95 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all disabled:opacity-50"
              >
                {isAiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating details via Gemini 3.7...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analyze & Craft with Gemini AI
                  </>
                )}
              </button>

              {aiError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* GEMINI AI OUTPUT CONTAINER */}
              <AnimatePresence mode="wait">
                {aiResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 rounded-2xl border border-border bg-muted/30 space-y-3 max-h-[300px] overflow-y-auto"
                  >
                    <div className="flex items-center justify-between border-b border-border/80 pb-2">
                      <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Gemini Proposal
                      </span>
                      {aiAction !== 'ideas' && (
                        <button
                          type="button"
                          onClick={() => handleApplyAi(aiResult)}
                          className="px-2.5 py-1 rounded bg-primary/20 hover:bg-primary/35 text-[10px] font-black text-primary transition-all"
                        >
                          Apply to Form
                        </button>
                      )}
                    </div>

                    {/* Enhance Prompt Proposal */}
                    {aiAction === 'enhance' && (
                      <div className="space-y-2.5 text-xs text-foreground/95">
                        <div>
                          <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Enhanced Copyable Prompt:</p>
                          <p className="p-2.5 bg-background border border-border/60 rounded-lg font-mono text-xs select-all mt-1 whitespace-pre-wrap leading-relaxed">
                            {aiResult.enhancedPrompt}
                          </p>
                        </div>
                        {aiResult.suggestedTags && aiResult.suggestedTags.length > 0 && (
                          <div>
                            <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider mb-1">Suggested Tags:</p>
                            <div className="flex flex-wrap gap-1">
                              {aiResult.suggestedTags.map((t: string) => (
                                <span key={t} className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] border border-cyan-500/15">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {aiResult.tips && aiResult.tips.length > 0 && (
                          <div>
                            <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Usage Tips:</p>
                            <ul className="list-disc pl-4 space-y-1 mt-1 font-medium text-muted-foreground">
                              {aiResult.tips.map((t: string, i: number) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Translate Prompt Proposal */}
                    {aiAction === 'translate' && (
                      <div className="space-y-2.5 text-xs text-foreground/95">
                        <div>
                          <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Translated Copyable Result:</p>
                          <p className="p-2.5 bg-background border border-border/60 rounded-lg font-mono text-xs select-all mt-1 whitespace-pre-wrap">
                            {aiResult.translatedPrompt}
                          </p>
                        </div>
                        {aiResult.explanation && (
                          <div>
                            <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Translation Insight:</p>
                            <p className="text-muted-foreground mt-1 leading-relaxed">{aiResult.explanation}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Concept Ideas Proposal */}
                    {aiAction === 'ideas' && aiResult.concepts && (
                      <div className="space-y-3.5">
                        {aiResult.concepts.map((concept: any, index: number) => (
                          <div key={index} className="p-3 bg-background border border-border/60 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <p className="font-extrabold text-foreground">{concept.title}</p>
                              <button
                                type="button"
                                onClick={() => handleApplyConcept(concept)}
                                className="px-2 py-0.5 bg-primary/20 hover:bg-primary/35 text-[9px] font-black text-primary rounded transition-all"
                              >
                                Apply Idea
                              </button>
                            </div>
                            <p className="text-muted-foreground leading-normal"><span className="font-bold text-emerald-400">Hook:</span> {concept.hook}</p>
                            <div className="p-2 bg-muted/60 border border-border/40 rounded font-mono text-[11px] select-all whitespace-pre-wrap leading-relaxed">
                              {concept.prompt}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ==================== RIGHT COLUMN: REELS POSTS FORM DETAILS ==================== */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 p-4 sm:p-6 lg:p-7 rounded-[30px] bg-white/[0.045] border border-white/10 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h2 className="text-xs font-black flex items-center gap-2 text-white uppercase tracking-[0.12em]">
              <span className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-400/20 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-blue-300" />
              </span>
              Reel Details
            </h2>
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Step 03</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-3 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
              {extractedData ? <Video className="w-5 h-5 text-cyan-300" /> : <Video className="w-5 h-5 text-white/35" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Live publish preview</p>
              <p className="text-xs font-bold text-white/80 truncate mt-1">
                {extractedData ? `${extractedData.mediaType === 'photo' ? 'Photo slideshow' : 'Video reel'} ready to publish` : 'Extract a TikTok link to unlock preview'}
              </p>
            </div>
            <ArrowLeft className="w-4 h-4 text-white/20 rotate-180" />
          </div>

          {/* Title input */}
          <div>
            <label className="text-[10px] font-bold text-white/45 uppercase tracking-widest block mb-2">
              Reel / Prompt Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cyberpunk Samurai 8K Prompt"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl bg-black/25 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400/50 transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="text-[10px] font-bold text-white/45 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Tag className="w-3.5 h-3.5 text-primary" />
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ReelCategory)}
              className="w-full px-3.5 py-3 rounded-xl bg-black/25 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400/50 transition-all"
            >
              {REELS_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt Formula textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                Prompt / Formula / Instructions *
              </label>
              <span className="text-[10px] text-muted-foreground font-medium">This will be copied with 1-Click</span>
            </div>
            <textarea
              required
              rows={5}
              placeholder="Enter full Midjourney prompt, CapCut curve settings, FLUX formula, or VFX preset recipe..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full px-3.5 py-3.5 rounded-xl bg-black/25 border border-white/10 text-xs sm:text-sm font-mono text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400/50 transition-all resize-y leading-relaxed"
            />
          </div>

          {/* Description input */}
          <div>
            <label className="text-[10px] font-bold text-white/45 uppercase tracking-widest block mb-2">
              Extra Description / Tips (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Set CFG scale to 7.0 and use Niji v6 with raw style"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl bg-black/25 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400/50 transition-all"
            />
          </div>

          {/* Author input */}
          <div>
            <label className="text-[10px] font-bold text-white/45 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <User className="w-3.5 h-3.5 text-primary" />
              Creator / Author Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Rony, Anonymous, PromptMaster..."
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl bg-black/25 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400/50 transition-all"
            />
          </div>

          {/* Extract Error Alert */}
          {extractError && !duplicateInfo?.isDuplicate && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{extractError}</span>
            </div>
          )}

          {/* Submit Action Block */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                soundEffects.play('click');
                setLocation('/reels');
              }}
              className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-bold text-white/55 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPublishing || !!duplicateInfo?.isDuplicate}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-blue-600 to-cyan-500 hover:opacity-95 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 h-[44px]"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing to Feed...
                </>
              ) : duplicateInfo?.isDuplicate ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-300" />
                  Duplicate Blocked
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Publish Reel
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
