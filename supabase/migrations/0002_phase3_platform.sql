-- Phase 3 expansion: discovery, AI prompt lab, versions, collections, analytics, moderation, privacy.
create extension if not exists pgcrypto;

alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.reels_posts add column if not exists is_private boolean not null default false;
alter table public.reels_posts add column if not exists is_archived boolean not null default false;
alter table public.reels_posts add column if not exists saves_count bigint not null default 0;
alter table public.reels_posts add column if not exists comments_count bigint not null default 0;
alter table public.reels_posts add column if not exists share_count bigint not null default 0;

create table if not exists public.prompt_versions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 reel_id text references public.reels_posts(id) on delete cascade, prompt_text text not null, negative_prompt text,
 recipe jsonb, source text not null check(source in ('Original','AI Enhanced','AI Variation','Manual Edit')), created_at timestamptz not null default now()
);
create index if not exists prompt_versions_reel_idx on public.prompt_versions(reel_id,created_at desc);
create index if not exists prompt_versions_user_idx on public.prompt_versions(user_id,created_at desc);

create table if not exists public.collections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80), is_private boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,name)
);
create table if not exists public.collection_items (
 id uuid primary key default gen_random_uuid(), collection_id uuid not null references public.collections(id) on delete cascade,
 reel_id text not null references public.reels_posts(id) on delete cascade, created_at timestamptz not null default now(), unique(collection_id,reel_id)
);
create index if not exists collection_items_collection_idx on public.collection_items(collection_id,created_at desc);

create table if not exists public.blocks (
 id uuid primary key default gen_random_uuid(), blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

create table if not exists public.reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id) on delete cascade,
 target_type text not null check(target_type in ('reel','comment','profile','prompt')), target_id text not null,
 reason text not null check(reason in ('Inappropriate content','Spam','Copyright concern','Fake/misleading prompt','Harassment','Broken content','Other')),
 details text, created_at timestamptz not null default now(), unique(reporter_id,target_type,target_id)
);
create table if not exists public.moderation_cases (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','reviewing','resolved','dismissed')), moderator_id uuid references auth.users(id), resolution text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.creator_badges (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 badge text not null check(badge in ('Verified Creator','Prompt Expert','Rising Creator','Top Creator')), granted_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(user_id,badge)
);
create table if not exists public.user_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade, language text not null default 'English', public_profile boolean not null default true,
 notification_likes boolean not null default true, notification_comments boolean not null default true, notification_followers boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.feed_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade, categories text[] not null default '{}', updated_at timestamptz not null default now()
);
create table if not exists public.analytics_events (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, reel_id text references public.reels_posts(id) on delete cascade,
 event_type text not null check(event_type in ('view','like','save','copy','comment','share')), created_at timestamptz not null default now()
);
create index if not exists analytics_events_reel_time_idx on public.analytics_events(reel_id,event_type,created_at desc);
create index if not exists analytics_events_user_time_idx on public.analytics_events(user_id,created_at desc);

create or replace function public.get_trending(p_window text default '7d', p_kind text default 'reels', p_limit int default 30)
returns table(id text, title text, username text, display_name text, cover_url text, prompt_text text, copy_count bigint, likes_count bigint, trending_score numeric)
language sql security definer set search_path=public as $$
with bounds as (select case p_window when '24h' then now()-interval '24 hours' when '30d' then now()-interval '30 days' when 'all' then '1970-01-01'::timestamptz else now()-interval '7 days' end as since),
base as (select r.id::text,r.title,p.username,p.display_name,r.cover_url,r.prompt_text,coalesce(r.copy_count,0)::bigint copy_count,coalesce(r.likes_count,0)::bigint likes_count,
 (coalesce(r.likes_count,0)*1.0+coalesce(r.copy_count,0)*2.0+coalesce(r.saves_count,0)*2.5+coalesce(r.comments_count,0)*1.5+coalesce(r.share_count,0)*2.0)/power(greatest(extract(epoch from now()-r.created_at)/86400.0,0.25),0.55) score
 from reels_posts r left join profiles p on p.id=r.author_id,bounds b where coalesce(r.is_published,true) and not coalesce(r.is_archived,false) and r.created_at>=b.since)
select id,title,username,display_name,cover_url,prompt_text,copy_count,likes_count,score from base where p_kind in ('reels','prompts') order by score desc nulls last limit greatest(p_limit,1);
$$;

create or replace function public.get_personalized_feed(p_mode text default 'for_you', p_limit int default 30)
returns setof public.reels_posts language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); begin
 if p_mode='following' and uid is not null then return query select r.* from reels_posts r where r.author_id in (select following_id from follows where follower_id=uid) and coalesce(r.is_published,true) and not coalesce(r.is_archived,false) and not exists(select 1 from blocks b where b.blocker_id=uid and b.blocked_id=r.author_id) order by r.created_at desc limit p_limit;
 elsif p_mode='trending' then return query select r.* from reels_posts r where r.id in (select id from get_trending('7d','reels',p_limit)) order by r.created_at desc limit p_limit;
 else return query select r.* from reels_posts r where coalesce(r.is_published,true) and not coalesce(r.is_archived,false) and (uid is null or not exists(select 1 from blocks b where b.blocker_id=uid and b.blocked_id=r.author_id)) order by (coalesce(r.copy_count,0)*2+coalesce(r.likes_count,0)+coalesce(r.saves_count,0)*2+coalesce(r.comments_count,0)) desc,r.created_at desc limit p_limit; end if;
end $$;

create or replace function public.get_creator_analytics(p_window text default '30d') returns table(views bigint,likes bigint,saves bigint,prompt_copies bigint,followers_gained bigint,copy_rate numeric,save_rate numeric,engagement_rate numeric,top_reel_title text,top_category text,top_tag text) language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); since_at timestamptz:=case p_window when '7d' then now()-interval '7 days' when '90d' then now()-interval '90 days' when 'all' then '1970-01-01'::timestamptz else now()-interval '30 days' end; v_views bigint;v_likes bigint;v_saves bigint;v_copies bigint;v_followers bigint; begin
 select count(*) filter(where e.event_type='view'),count(*) filter(where e.event_type='like'),count(*) filter(where e.event_type='save'),count(*) filter(where e.event_type='copy') into v_views,v_likes,v_saves,v_copies from analytics_events e join reels_posts r on r.id=e.reel_id where r.author_id=uid and e.created_at>=since_at;
 select count(*) into v_followers from follows where following_id=uid and created_at>=since_at;
 return query select v_views,v_likes,v_saves,v_copies,v_followers,case when v_views>0 then v_copies::numeric/v_views else 0 end,case when v_views>0 then v_saves::numeric/v_views else 0 end,case when v_views>0 then (v_likes+v_saves+v_copies)::numeric/v_views else 0 end,
 (select title from reels_posts where author_id=uid order by likes_count+copy_count+saves_count desc nulls last limit 1),(select category from reels_posts where author_id=uid group by category order by count(*) desc limit 1),
 (select tag from reel_tags t join reels_posts r on r.id=t.reel_id where r.author_id=uid group by tag order by count(*) desc limit 1);
end $$;

create or replace function public.get_leaderboard(p_metric text default 'top', p_limit int default 50) returns table(id uuid,username text,display_name text,metric_value bigint) language sql security definer set search_path=public as $$
select p.id,p.username,p.display_name,case p_metric when 'copies' then p.prompt_copies when 'likes' then coalesce((select sum(likes_count) from reels_posts r where r.author_id=p.id),0) when 'saves' then coalesce((select count(*) from saved_prompts s join reels_posts r on r.id=s.reel_id where r.author_id=p.id),0) else coalesce(p.followers_count,0) end::bigint from profiles p order by metric_value desc nulls last limit greatest(p_limit,1);$$;

alter table public.prompt_versions enable row level security; alter table public.collections enable row level security; alter table public.collection_items enable row level security; alter table public.blocks enable row level security; alter table public.reports enable row level security; alter table public.moderation_cases enable row level security; alter table public.creator_badges enable row level security; alter table public.user_preferences enable row level security; alter table public.feed_preferences enable row level security; alter table public.analytics_events enable row level security;

create policy prompt_versions_own on public.prompt_versions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy collections_own on public.collections for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy collection_items_own on public.collection_items for all using(exists(select 1 from collections c where c.id=collection_items.collection_id and c.user_id=auth.uid())) with check(exists(select 1 from collections c where c.id=collection_items.collection_id and c.user_id=auth.uid()));
create policy blocks_own on public.blocks for all using(auth.uid()=blocker_id) with check(auth.uid()=blocker_id);
create policy reports_own_insert on public.reports for insert with check(auth.uid()=reporter_id); create policy reports_own_read on public.reports for select using(auth.uid()=reporter_id);
drop policy if exists moderation_admin_read on public.moderation_cases;
create policy moderation_admin_read on public.moderation_cases for select using((auth.jwt()->'app_metadata'->>'role') in ('admin','moderator'));
create policy moderation_admin_write on public.moderation_cases for all using((auth.jwt()->'app_metadata'->>'role') in ('admin','moderator')) with check((auth.jwt()->'app_metadata'->>'role') in ('admin','moderator'));
create policy badges_public_read on public.creator_badges for select using(true);
create policy preferences_own on public.user_preferences for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy feed_preferences_own on public.feed_preferences for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy analytics_own_insert on public.analytics_events for insert with check(auth.uid()=user_id or user_id is null); create policy analytics_creator_read on public.analytics_events for select using(auth.uid()=user_id or exists(select 1 from reels_posts r where r.id=analytics_events.reel_id and r.author_id=auth.uid()));
