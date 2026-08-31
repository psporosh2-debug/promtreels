import {supabase} from './supabase'; import type {ReelPost} from '@/types/reels';
export function deduplicateReelsList(items:ReelPost[]){const seen=new Set<string>(); return items.filter(r=>{const k=String(r.id); if(seen.has(k)) return false; seen.add(k); return true;});}
export async function checkReelUrlIsDuplicate(url:string){const {data,error}=await supabase.from('reels_posts').select('id,title,author_name').eq('tiktok_url',url.trim()).limit(1).maybeSingle(); if(error) throw error; return {isDuplicate:Boolean(data),duplicateTitle:data?.title,author:data?.author_name};}
