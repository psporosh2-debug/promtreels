-- PromptReels relational layer. Compatible with an existing reels_posts table.
create extension if not exists pgcrypto;

alter table public.reels_posts add column if not exists updated_at timestamptz default now();
alter table public.reels_posts add column if not exists is_published boolean default true;
alter table public.reels_posts add column if not exists tags text[] default '{}';
create index if not exists reels_posts_author_idx on public.reels_posts(author_id);
create index if not exists reels_posts_created_idx on public.reels_posts(created_at desc);
create index if not exists reels_posts_category_idx on public.reels_posts(category);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text,
  bio text,
  avatar_url text,
  followers_count bigint not null default 0,
  following_count bigint not null default 0,
  prompt_copies bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reel_likes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reel_id text not null, created_at timestamptz not null default now(), unique(user_id,reel_id)
);
create index if not exists reel_likes_reel_idx on public.reel_likes(reel_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(), reel_id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade, body text not null check(length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists comments_reel_idx on public.comments(reel_id,created_at);
create index if not exists comments_parent_idx on public.comments(parent_id);

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade, created_at timestamptz not null default now(), unique(user_id,comment_id)
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(), follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(),
  unique(follower_id,following_id), check(follower_id<>following_id)
);
create index if not exists follows_following_idx on public.follows(following_id);

create table if not exists public.saved_reels (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reel_id text not null, created_at timestamptz not null default now(), unique(user_id,reel_id)
);
create table if not exists public.saved_prompts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reel_id text not null, created_at timestamptz not null default now(), unique(user_id,reel_id)
);

create table if not exists public.prompt_copies (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reel_id text not null, created_at timestamptz not null default now(), unique(user_id,reel_id)
);

create table if not exists public.prompt_recipes (
  id uuid primary key default gen_random_uuid(), reel_id text not null unique,
  main_prompt text, negative_prompt text, ai_model text, model_version text, parameters jsonb,
  aspect_ratio text, style text, camera text, lens text, lighting text, effects text, seed text,
  workflow text, reference_settings text, creator_notes text, tags text[] default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.prompt_requests (
  id uuid primary key default gen_random_uuid(), requester_id uuid not null references auth.users(id) on delete cascade,
  reel_id text not null, request_type text not null check(request_type in ('variation','tutorial','explain','optimize')),
  body text, status text not null default 'pending' check(status in ('pending','accepted','completed','rejected')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.reel_tags (
  reel_id text not null, tag text not null, created_at timestamptz not null default now(), primary key(reel_id,tag)
);
create index if not exists reel_tags_tag_idx on public.reel_tags(tag);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text, description text, prompt_text text, negative_prompt text, category text, tags text[] default '{}',
  media_reference jsonb, cover_reference text, music jsonb, source_url text, recipe jsonb, editing_state jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists drafts_user_idx on public.drafts(user_id,updated_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null, type text not null, message text not null,
  reel_id text, related_id text, read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id,created_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare base text; candidate text; begin
  base:=lower(regexp_replace(coalesce(new.raw_user_meta_data->>'user_name',new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1),'creator'),'[^a-z0-9_]+','','g'));
  base:=left(case when length(base)<3 then base||'creator' else base end,24); candidate:=base;
  while exists(select 1 from public.profiles where username=candidate) loop candidate:=left(base,20)||substr(encode(gen_random_bytes(3),'hex'),1,6); end loop;
  insert into public.profiles(id,username,display_name) values(new.id,candidate,new.raw_user_meta_data->>'full_name') on conflict(id) do nothing; return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.sync_reel_like_count() returns trigger language plpgsql security definer set search_path=public as $$
declare rid text; c bigint; original bigint; begin rid:=coalesce(new.reel_id,old.reel_id); select count(*) into c from public.reel_likes where reel_id=rid; select coalesce(tiktok_likes,0) into original from public.reels_posts where id=rid; update public.reels_posts set website_likes=c, likes_count=original+c, updated_at=now() where id=rid; return coalesce(new,old); end $$;
drop trigger if exists reel_like_count_trigger on public.reel_likes;
create trigger reel_like_count_trigger after insert or delete on public.reel_likes for each row execute procedure public.sync_reel_like_count();

create or replace function public.sync_prompt_copy_count() returns trigger language plpgsql security definer set search_path=public as $$
declare c bigint; begin select count(*) into c from public.prompt_copies where reel_id=new.reel_id; update public.reels_posts set copy_count=c,updated_at=now() where id=new.reel_id; return new; end $$;
drop trigger if exists prompt_copy_count_trigger on public.prompt_copies;
create trigger prompt_copy_count_trigger after insert on public.prompt_copies for each row execute procedure public.sync_prompt_copy_count();

create or replace function public.notify_like() returns trigger language plpgsql security definer set search_path=public as $$
declare owner uuid; begin select author_id into owner from public.reels_posts where id=new.reel_id; if owner is not null and owner<>new.user_id then insert into public.notifications(user_id,actor_id,type,message,reel_id) values(owner,new.user_id,'reel_like','Someone liked your reel.',new.reel_id); end if; return new; end $$;
drop trigger if exists notify_like_trigger on public.reel_likes;
create trigger notify_like_trigger after insert on public.reel_likes for each row execute procedure public.notify_like();

create or replace function public.notify_follow() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.notifications(user_id,actor_id,type,message) values(new.following_id,new.follower_id,'new_follower','You have a new follower.'); update public.profiles set followers_count=(select count(*) from public.follows where following_id=new.following_id) where id=new.following_id; update public.profiles set following_count=(select count(*) from public.follows where follower_id=new.follower_id) where id=new.follower_id; return new; end $$;
drop trigger if exists notify_follow_trigger on public.follows;
create trigger notify_follow_trigger after insert on public.follows for each row execute procedure public.notify_follow();

alter table public.profiles enable row level security; alter table public.reel_likes enable row level security; alter table public.comments enable row level security; alter table public.comment_likes enable row level security; alter table public.follows enable row level security; alter table public.saved_reels enable row level security; alter table public.saved_prompts enable row level security; alter table public.prompt_copies enable row level security; alter table public.prompt_recipes enable row level security; alter table public.prompt_requests enable row level security; alter table public.reel_tags enable row level security; alter table public.drafts enable row level security; alter table public.notifications enable row level security;

create policy profiles_read on public.profiles for select using (true);
create policy profiles_own_update on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);
create policy profiles_own_insert on public.profiles for insert with check(auth.uid()=id);
create policy likes_read on public.reel_likes for select using(true); create policy likes_own_insert on public.reel_likes for insert with check(auth.uid()=user_id); create policy likes_own_delete on public.reel_likes for delete using(auth.uid()=user_id);
create policy comments_read on public.comments for select using(true); create policy comments_own_insert on public.comments for insert with check(auth.uid()=user_id); create policy comments_own_update on public.comments for update using(auth.uid()=user_id); create policy comments_own_delete on public.comments for delete using(auth.uid()=user_id);
create policy comment_likes_read on public.comment_likes for select using(true); create policy comment_likes_own_insert on public.comment_likes for insert with check(auth.uid()=user_id); create policy comment_likes_own_delete on public.comment_likes for delete using(auth.uid()=user_id);
create policy follows_read on public.follows for select using(true); create policy follows_own_insert on public.follows for insert with check(auth.uid()=follower_id); create policy follows_own_delete on public.follows for delete using(auth.uid()=follower_id);
create policy saved_reels_own_all on public.saved_reels for all using(auth.uid()=user_id) with check(auth.uid()=user_id); create policy saved_prompts_own_all on public.saved_prompts for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy copies_read on public.prompt_copies for select using(true); create policy copies_own_insert on public.prompt_copies for insert with check(auth.uid()=user_id);
create policy recipes_read on public.prompt_recipes for select using(true); create policy recipes_author_all on public.prompt_recipes for all using(exists(select 1 from public.reels_posts r where r.id=prompt_recipes.reel_id and r.author_id=auth.uid())) with check(exists(select 1 from public.reels_posts r where r.id=prompt_recipes.reel_id and r.author_id=auth.uid()));
create policy requests_read on public.prompt_requests for select using(auth.uid()=requester_id or exists(select 1 from public.reels_posts r where r.id=prompt_requests.reel_id and r.author_id=auth.uid())); create policy requests_own_insert on public.prompt_requests for insert with check(auth.uid()=requester_id);
create policy tags_read on public.reel_tags for select using(true); create policy tags_author_all on public.reel_tags for all using(exists(select 1 from public.reels_posts r where r.id=reel_tags.reel_id and r.author_id=auth.uid())) with check(exists(select 1 from public.reels_posts r where r.id=reel_tags.reel_id and r.author_id=auth.uid()));
create policy drafts_own_all on public.drafts for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy notifications_own_read on public.notifications for select using(auth.uid()=user_id); create policy notifications_own_update on public.notifications for update using(auth.uid()=user_id) with check(auth.uid()=user_id);

-- Storage policies. Create the buckets in Storage if they do not already exist.
insert into storage.buckets(id,name,public) values('reels','reels',true) on conflict(id) do nothing;
insert into storage.buckets(id,name,public) values('profiles','profiles',true) on conflict(id) do nothing;
drop policy if exists reels_upload_own on storage.objects; drop policy if exists reels_update_own on storage.objects; drop policy if exists reels_delete_own on storage.objects;
create policy reels_upload_own on storage.objects for insert to authenticated with check(bucket_id='reels' and (storage.foldername(name))[1]=auth.uid()::text);
create policy reels_update_own on storage.objects for update to authenticated using(bucket_id='reels' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='reels' and (storage.foldername(name))[1]=auth.uid()::text);
create policy reels_delete_own on storage.objects for delete to authenticated using(bucket_id='reels' and (storage.foldername(name))[1]=auth.uid()::text);
create policy profiles_upload_own on storage.objects for insert to authenticated with check(bucket_id='profiles' and (storage.foldername(name))[1]=auth.uid()::text);
create policy profiles_update_own on storage.objects for update to authenticated using(bucket_id='profiles' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='profiles' and (storage.foldername(name))[1]=auth.uid()::text);
create policy profiles_delete_own on storage.objects for delete to authenticated using(bucket_id='profiles' and (storage.foldername(name))[1]=auth.uid()::text);
