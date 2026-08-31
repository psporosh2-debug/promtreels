import { supabase } from '@/lib/supabase';

export type TrendWindow = '24h'|'7d'|'30d'|'all';
export type PromptAction = 'generate'|'enhance'|'fix'|'translate'|'variation'|'analyze'|'image_to_video'|'video_to_image';

export async function aiPromptLab(action: PromptAction, promptText: string, extra = '', language = 'English') {
  const r = await fetch('/api/ai/prompt-lab', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({action,promptText,extra,language}) });
  const d = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(d.message || d.error || 'AI request failed. Try again.');
  return d.data || d;
}

export async function fetchTrending(window: TrendWindow='7d', kind:'reels'|'prompts'|'creators'='reels') {
  const { data, error } = await supabase.rpc('get_trending', { p_window: window, p_kind: kind, p_limit: 30 });
  if (error) throw error; return data || [];
}

export async function fetchFeed(mode:'for_you'|'following'|'trending'='for_you') {
  const { data, error } = await supabase.rpc('get_personalized_feed', { p_mode: mode, p_limit: 30 });
  if (error) throw error; return data || [];
}

export async function savePromptVersion(input:{reelId?:string; promptText:string; negativePrompt?:string; recipe?:unknown; source:string}) {
  const { data:{user} } = await supabase.auth.getUser(); if(!user) throw new Error('Authentication required');
  const { data, error } = await supabase.from('prompt_versions').insert({ user_id:user.id, reel_id:input.reelId||null, prompt_text:input.promptText, negative_prompt:input.negativePrompt||null, recipe:input.recipe||null, source:input.source }).select().single();
  if(error) throw error; return data;
}

export async function toggleBlock(targetId:string, blocked:boolean) {
  const { data:{user} } = await supabase.auth.getUser(); if(!user) throw new Error('Authentication required');
  if(blocked) { const {error}=await supabase.from('blocks').delete().eq('blocker_id',user.id).eq('blocked_id',targetId); if(error)throw error; return false; }
  const {error}=await supabase.from('blocks').insert({blocker_id:user.id,blocked_id:targetId}); if(error && error.code!=='23505')throw error; return true;
}
